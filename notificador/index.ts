// notificador/index.ts
// Serviço que manda as notificações do Diário para os celulares (Web Push).
// Roda ao lado do PocketBase (deploy/docker-compose.yml) e, a cada ciclo:
//   1. lê as inscrições dos aparelhos e o estado de cada bebê;
//   2. decide os avisos (src/lib/notificacoes/planejar.ts, a mesma regra testada);
//   3. grava a chave do aviso (push_enviados, única) e só então envia: nada repete.
//
// Configuração (sem nada no .env): a pasta PUSH_DIR é compartilhada com o PocketBase.
//   - vapid.json: chaves VAPID, geradas aqui na primeira subida;
//   - notificador.json: login de superusuário criado pelo hook push.js do PocketBase.

import fs from 'node:fs'
import path from 'node:path'
import PocketBase, { ClientResponseError } from 'pocketbase'
import webpush from 'web-push'
import {
  avisosDeRegistro,
  planejarAvisos,
  type Aviso,
  type Inscricao,
} from '../src/lib/notificacoes/planejar'
import { getLocalTodayDateString } from '../src/lib/regras/fuso'

const PB_URL = process.env.PB_URL || 'http://pocketbase:8090'
const PUSH_DIR = process.env.PUSH_DIR || '/chaves'
const APP_URL = process.env.APP_URL || 'https://localhost'
const CICLO_MS = Number(process.env.CICLO_MS || 20_000)

const log = (...a: unknown[]) => console.log('[notificador]', new Date().toISOString(), ...a)
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ---------- Chaves VAPID ----------
function chavesVapid(): { publicKey: string; privateKey: string } {
  const arquivo = path.join(PUSH_DIR, 'vapid.json')
  try {
    const salvo = JSON.parse(fs.readFileSync(arquivo, 'utf8'))
    if (salvo.publicKey && salvo.privateKey) return salvo
  } catch {
    /* primeira subida */
  }
  const novas = webpush.generateVAPIDKeys()
  fs.mkdirSync(PUSH_DIR, { recursive: true })
  fs.writeFileSync(arquivo, JSON.stringify(novas), { mode: 0o600 })
  log('chaves VAPID geradas')
  return novas
}

// ---------- PocketBase (superusuário) ----------
const pb = new PocketBase(PB_URL)
pb.autoCancellation(false)

async function entrar() {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const cred = JSON.parse(fs.readFileSync(path.join(PUSH_DIR, 'notificador.json'), 'utf8'))
      await pb.collection('_superusers').authWithPassword(cred.email, cred.senha)
      return
    } catch (err) {
      if (tentativa % 10 === 1) log('aguardando o PocketBase...', (err as Error).message)
      await esperar(3000)
    }
  }
}

/** Repete a operação uma vez com login novo se o token expirou (ex.: PocketBase reiniciou). */
async function comLogin<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ClientResponseError && (err.status === 401 || err.status === 403)) {
      await entrar()
      return await fn()
    }
    throw err
  }
}

// ---------- Envio ----------
interface InscricaoRec extends Inscricao {
  endpoint: string
  p256dh: string
  auth: string
  falhas: number
}

async function marcarEnviado(chave: string): Promise<boolean> {
  try {
    await pb.collection('push_enviados').create({ chave })
    return true
  } catch (err) {
    if (err instanceof ClientResponseError && err.status === 400) return false // já enviado
    throw err
  }
}

async function enviar(aviso: Aviso, inscricoes: Map<string, InscricaoRec>) {
  const i = inscricoes.get(aviso.inscricaoId)
  if (!i) return
  if (!(await comLogin(() => marcarEnviado(aviso.chave)))) return
  const payload = JSON.stringify({
    title: aviso.titulo,
    body: aviso.corpo,
    url: aviso.url,
    tag: aviso.tag,
  })
  try {
    await webpush.sendNotification(
      { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
      payload,
      { TTL: aviso.tag === 'mamada' ? 1800 : 6 * 3600, urgency: 'high' },
    )
    log('enviado', aviso.chave)
    if (i.falhas) await pb.collection('push_inscricoes').update(i.id, { falhas: 0 })
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode || 0
    if (status === 404 || status === 410) {
      // O aparelho desinstalou o app ou revogou a permissão: a inscrição não vale mais.
      log('inscrição expirada, removendo', i.id)
      await pb.collection('push_inscricoes').delete(i.id).catch(() => {})
      inscricoes.delete(i.id)
      return
    }
    log('falha ao enviar', aviso.chave, status, (err as Error).message)
    const falhas = (i.falhas || 0) + 1
    i.falhas = falhas
    if (falhas >= 20) await pb.collection('push_inscricoes').delete(i.id).catch(() => {})
    else await pb.collection('push_inscricoes').update(i.id, { falhas }).catch(() => {})
  }
}

// ---------- Ciclo ----------
let ultimaChecagemRegistros = new Date()
let ultimaLimpeza = 0

async function ciclo() {
  const agora = new Date()
  const todas = await pb.collection('push_inscricoes').getFullList<InscricaoRec>({ batch: 500 })
  if (!todas.length) {
    ultimaChecagemRegistros = agora
    return
  }
  const porId = new Map(todas.map((i) => [i.id, i]))
  const espacos = [...new Set(todas.map((i) => i.espaco))]
  const hoje = getLocalTodayDateString(agora)

  for (const espacoId of espacos) {
    const doBebe = todas.filter((i) => i.espaco === espacoId)
    let espaco
    try {
      espaco = await pb.collection('espacos').getOne(espacoId)
    } catch {
      continue
    }
    const [ultimas, vacinas, consultas, novos, medicacoes, dosesDeHoje] = await Promise.all([
      pb.collection('eventos').getList(1, 1, {
        filter: pb.filter(
          "espaco = {:e} && deleted_at = '' && (tipo = 'mamada' || tipo = 'mamadeira')",
          { e: espacoId },
        ),
        sort: '-inicio_em',
      }),
      pb.collection('vacinas').getFullList({ filter: pb.filter('espaco = {:e}', { e: espacoId }) }),
      pb.collection('consultas').getFullList({
        filter: pb.filter('espaco = {:e} && proxima_consulta >= {:h}', { e: espacoId, h: hoje }),
      }),
      doBebe.some((i) => i.familia)
        ? pb.collection('eventos').getFullList({
            filter: pb.filter("espaco = {:e} && deleted_at = '' && created >= {:t}", {
              e: espacoId,
              t: new Date(ultimaChecagemRegistros.getTime() - 5000),
            }),
          })
        : Promise.resolve([]),
      doBebe.some((i) => i.remedios)
        ? pb.collection('medicacoes').getFullList({
            filter: pb.filter("espaco = {:e} && ativo = true && tipo = 'fixo'", { e: espacoId }),
          })
        : Promise.resolve([]),
      doBebe.some((i) => i.remedios)
        ? pb.collection('medicacao_doses').getFullList({
            filter: pb.filter("espaco = {:e} && previsto ~ {:h}", { e: espacoId, h: `${hoje}T%` }),
          })
        : Promise.resolve([]),
    ])

    const avisos = planejarAvisos({
      agora,
      inscricoes: doBebe,
      bebe: {
        espaco: {
          id: espaco.id,
          nome: espaco.nome,
          data_nascimento: espaco.data_nascimento,
          intervalo_mamada_minutos: espaco.intervalo_mamada_minutos,
        },
        ultimaMamada: (ultimas.items[0] as never) || null,
        vacinasAplicadas: vacinas as never,
        proximasConsultas: consultas.map((c) => c.proxima_consulta as string),
        medicacoes: medicacoes as never,
        dosesDeHoje: dosesDeHoje as never,
      },
    })
    for (const ev of novos) {
      avisos.push(
        ...avisosDeRegistro({ evento: ev as never, nomeBebe: espaco.nome, inscricoes: doBebe }),
      )
    }
    for (const aviso of avisos) await enviar(aviso, porId)
  }
  ultimaChecagemRegistros = agora

  // Uma vez por dia: esquece chaves com mais de 40 dias
  if (agora.getTime() - ultimaLimpeza > 24 * 3600 * 1000) {
    ultimaLimpeza = agora.getTime()
    const limite = new Date(agora.getTime() - 40 * 24 * 3600 * 1000)
    const velhos = await pb
      .collection('push_enviados')
      .getFullList({ filter: pb.filter('created < {:l}', { l: limite }), fields: 'id' })
    for (const v of velhos) await pb.collection('push_enviados').delete(v.id).catch(() => {})
    if (velhos.length) log('limpeza:', velhos.length, 'chaves antigas')
  }
}

async function main() {
  const vapid = chavesVapid()
  webpush.setVapidDetails(APP_URL, vapid.publicKey, vapid.privateKey)
  await entrar()
  log('pronto; ciclo a cada', CICLO_MS / 1000, 's')
  for (;;) {
    try {
      await comLogin(ciclo)
    } catch (err) {
      log('erro no ciclo:', (err as Error).message)
    }
    await esperar(CICLO_MS)
  }
}

main()
