// Notificações de ponta a ponta: PocketBase real + serviço notificador + um "celular" falso
// (servidor HTTPS local que recebe o Web Push e decifra a mensagem com a chave do aparelho).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { createECDH, randomBytes } from 'node:crypto'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import { ClientResponseError } from 'pocketbase'
import { criarUsuario, subirPocketBase, temBinario, type Servidor } from './pocketbase'

const raiz = path.resolve(__dirname, '../..')
const requireDoWebPush = createRequire(require.resolve('web-push'))
const ece = requireDoWebPush('http_ece') as {
  decrypt: (buf: Buffer, opts: Record<string, unknown>) => Buffer
}

let temOpenssl = true
try {
  execFileSync('openssl', ['version'], { stdio: 'ignore' })
} catch {
  temOpenssl = false
}

interface Recebido {
  caminho: string
  corpo: { title: string; body: string; url: string; tag: string }
}

/** "Celular" falso: um endpoint HTTPS que decifra o push com as chaves do aparelho. */
async function subirCelular(dir: string) {
  execFileSync(
    'openssl',
    ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(dir, 'k.pem'),
      '-out', path.join(dir, 'c.pem'), '-days', '1', '-subj', '/CN=127.0.0.1'],
    { stdio: 'ignore' },
  )
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const authSecret = randomBytes(16)
  const recebidos: Recebido[] = []
  const respostas = new Map<string, number>() // caminho -> status a responder
  const servidor = https.createServer(
    { key: fs.readFileSync(path.join(dir, 'k.pem')), cert: fs.readFileSync(path.join(dir, 'c.pem')) },
    (req, res) => {
      const partes: Buffer[] = []
      req.on('data', (p) => partes.push(p))
      req.on('end', () => {
        const status = respostas.get(req.url || '') ?? 201
        if (status === 201) {
          const claro = ece.decrypt(Buffer.concat(partes), {
            version: 'aes128gcm',
            privateKey: ecdh,
            authSecret: authSecret.toString('base64url'),
          })
          recebidos.push({ caminho: req.url || '', corpo: JSON.parse(claro.toString('utf8')) })
        }
        res.writeHead(status).end()
      })
    },
  )
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r))
  const porta = (servidor.address() as { port: number }).port
  return {
    recebidos,
    respostas,
    endpoint: (nome: string) => `https://127.0.0.1:${porta}/${nome}`,
    p256dh: ecdh.getPublicKey().toString('base64url'),
    auth: authSecret.toString('base64url'),
    parar: () => servidor.close(),
  }
}

async function ate<T>(fn: () => T | undefined | false, ms = 15000): Promise<T> {
  const fim = Date.now() + ms
  for (;;) {
    const v = fn()
    if (v) return v
    if (Date.now() > fim) throw new Error('tempo esgotado')
    await new Promise((r) => setTimeout(r, 200))
  }
}

describe.skipIf(!temBinario || !temOpenssl)('notificações no celular (Web Push)', () => {
  let s: Servidor
  let dir: string
  let celular: Awaited<ReturnType<typeof subirCelular>>
  let notificador: ChildProcess
  let logs = ''
  let dona: Awaited<ReturnType<typeof criarUsuario>>
  let outra: Awaited<ReturnType<typeof criarUsuario>>
  let estranho: Awaited<ReturnType<typeof criarUsuario>>
  let espacoId: string

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-teste-'))
    process.env.PUSH_DIR = path.join(dir, 'chaves')
    s = await subirPocketBase()
    delete process.env.PUSH_DIR
    celular = await subirCelular(dir)

    dona = await criarUsuario(s, 'Mae')
    outra = await criarUsuario(s, 'Pai')
    estranho = await criarUsuario(s, 'Fora')
    const esp = await dona.cliente.collection('espacos').create({
      nome: 'Sarah',
      data_nascimento: '2026-10-09',
      intervalo_mamada_minutos: 180,
      criador: dona.id,
    })
    espacoId = esp.id
    const conv = await dona.cliente
      .collection('convites')
      .create({ espaco_rel: espacoId, papel: 'editor', token: 'x', criador: dona.id, expira_em: new Date(Date.now() + 86400000).toISOString() })
    await outra.cliente.send('/backend/v1/convites/aceitar', { method: 'POST', body: { token: conv.token } })

    notificador = spawn(path.join(raiz, 'node_modules/.bin/tsx'), ['notificador/index.ts'], {
      cwd: raiz,
      env: {
        ...process.env,
        PB_URL: s.url,
        PUSH_DIR: path.join(dir, 'chaves'),
        APP_URL: 'https://diario.teste',
        CICLO_MS: '500',
        NODE_TLS_REJECT_UNAUTHORIZED: '0', // só para o "celular" falso com certificado próprio
      },
    })
    notificador.stdout?.on('data', (d) => (logs += d))
    notificador.stderr?.on('data', (d) => (logs += d))
    await ate(() => logs.includes('pronto; ciclo'), 30000)
  }, 60000)

  afterAll(() => {
    notificador?.kill()
    celular?.parar()
    s?.parar()
  })

  const inscrever = (cliente: typeof dona.cliente, nome: string) =>
    cliente.send('/backend/v1/push/inscrever', {
      method: 'POST',
      body: { espaco: espacoId, endpoint: celular.endpoint(nome), p256dh: celular.p256dh, auth: celular.auth, aparelho: 'Teste' },
    })

  it('servidor entrega a chave pública gerada pelo notificador', async () => {
    const r = await dona.cliente.send('/backend/v1/push/chave', { method: 'GET' })
    expect(r.chave).toMatch(/^[A-Za-z0-9_-]{80,}$/)
  })

  it('quem não é da família não se inscreve no bebê', async () => {
    const err = await inscrever(estranho.cliente, 'estranho').catch((e) => e)
    expect((err as ClientResponseError).status).toBe(403)
  })

  it('ao ativar, chega o aviso "Notificações ativadas", decifrado no aparelho', async () => {
    await inscrever(dona.cliente, 'mae')
    const r = await ate(() => celular.recebidos.find((x) => x.caminho === '/mae'))
    expect(r.corpo.title).toBe('Notificações ativadas')
    expect(r.corpo.url).toBe('/ajustes')
  })

  it('cada pessoa vê e muda só os próprios aparelhos', async () => {
    await inscrever(outra.cliente, 'pai')
    const daMae = await dona.cliente.collection('push_inscricoes').getFullList()
    expect(daMae.map((i) => i.endpoint)).toEqual([celular.endpoint('mae')])
    const doPai = await outra.cliente.collection('push_inscricoes').getFullList()
    const err = await dona.cliente
      .collection('push_inscricoes')
      .update(doPai[0].id, { familia: true })
      .catch((e) => e)
    expect((err as ClientResponseError).status).toBe(404)
    expect(await estranho.cliente.collection('push_enviados').getFullList().catch((e) => e.status)).toBe(403)
  })

  it('mamada vencida: aviso "hora da mamada" para os dois, uma vez só', async () => {
    const antes = celular.recebidos.length
    // Mamada há 3h01: a próxima (intervalo de 3h) acabou de vencer
    await dona.cliente.collection('eventos').create({
      espaco: espacoId,
      tipo: 'mamada',
      lado: 'esquerdo',
      inicio_em: new Date(Date.now() - 181 * 60000).toISOString(),
      criador: dona.id,
    })
    await ate(() => celular.recebidos.filter((x) => x.corpo.title === 'Sarah: hora da mamada').length >= 2)
    await new Promise((r) => setTimeout(r, 2000)) // mais ciclos: não pode repetir
    const mamadas = celular.recebidos.slice(antes).filter((x) => x.corpo.title === 'Sarah: hora da mamada')
    expect(mamadas.map((m) => m.caminho).sort()).toEqual(['/mae', '/pai'])
    expect(mamadas[0].corpo.body).toContain('peito esquerdo')
  })

  it('registro da família avisa os outros, não quem registrou', async () => {
    const doPai = (await outra.cliente.collection('push_inscricoes').getFullList())[0]
    await outra.cliente.collection('push_inscricoes').update(doPai.id, { familia: true })
    const daMae = (await dona.cliente.collection('push_inscricoes').getFullList())[0]
    await dona.cliente.collection('push_inscricoes').update(daMae.id, { familia: true })
    await new Promise((r) => setTimeout(r, 800))
    await dona.cliente.collection('eventos').create({
      espaco: espacoId,
      tipo: 'xixi',
      inicio_em: new Date().toISOString(),
      criador: dona.id,
      criador_nome: 'Mae',
    })
    const r = await ate(() => celular.recebidos.find((x) => x.corpo.title === 'Sarah: xixi'))
    expect(r.caminho).toBe('/pai')
    expect(r.corpo.body).toMatch(/^Mae registrou às \d\d:\d\d\.$/)
    await new Promise((r) => setTimeout(r, 1500))
    expect(celular.recebidos.filter((x) => x.corpo.title === 'Sarah: xixi')).toHaveLength(1)
  })

  it('remédio na hora: aviso para quem ligou "remédios"', async () => {
    const antes = celular.recebidos.length
    // Horário de 1 minuto atrás, no fuso de Brasília
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(Date.now() - 60000))
    const v = (t: string) => p.find((x) => x.type === t)!.value
    await dona.cliente.collection('medicacoes').create({
      espaco: espacoId,
      nome: 'Vitamina D',
      dose: '2 gotas',
      tipo: 'fixo',
      horarios: [`${v('hour')}:${v('minute')}`],
      inicio: `${v('year')}-${v('month')}-${v('day')}`,
      ativo: true,
      criador: dona.id,
    })
    const r = await ate(() =>
      celular.recebidos.slice(antes).find((x) => x.corpo.title === 'Sarah: hora do remédio'),
    )
    expect(r.corpo.body).toContain('Vitamina D, 2 gotas')
  })

  it('aparelho que desinstalou (410) sai da lista sozinho', async () => {
    celular.respostas.set('/pai', 410)
    const doPai = (await outra.cliente.collection('push_inscricoes').getFullList())[0]
    await outra.cliente.collection('push_inscricoes').update(doPai.id, { teste_em: new Date().toISOString() })
    await ate(() => logs.includes('inscrição expirada'))
    expect(await outra.cliente.collection('push_inscricoes').getFullList()).toHaveLength(0)
  })
}, 30000)
