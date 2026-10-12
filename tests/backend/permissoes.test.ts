// Testes de segurança obrigatórios (seção 8) contra um PocketBase real.
// Rode ./scripts/baixar-pocketbase.sh uma vez; sem o binário a suíte é pulada.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import PocketBase, { ClientResponseError } from 'pocketbase'
import { criarUsuario, subirPocketBase, temBinario, type Servidor } from './pocketbase'

type Usuario = Awaited<ReturnType<typeof criarUsuario>>

async function falha(p: Promise<unknown>): Promise<number> {
  try {
    await p
  } catch (err) {
    if (err instanceof ClientResponseError) return err.status
    throw err
  }
  throw new Error('A operação deveria ter sido recusada')
}

async function convidar(dono: PocketBase, espacoId: string, papel: string, email = '') {
  return dono.collection('convites').create({
    espaco_rel: espacoId,
    papel,
    email,
    token: 'token-escolhido-pelo-cliente',
    criador: dono.authStore.record!.id,
    expira_em: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
  })
}

function aceitar(cliente: PocketBase, token: string) {
  return cliente.send('/backend/v1/convites/aceitar', { method: 'POST', body: { token } })
}

function evento(cliente: PocketBase, espacoId: string, extra: Record<string, unknown> = {}) {
  return cliente.collection('eventos').create({
    espaco: espacoId,
    tipo: 'mamada',
    inicio_em: new Date().toISOString(),
    criador: cliente.authStore.record!.id,
    ...extra,
  })
}

describe.skipIf(!temBinario)('permissões no PocketBase', () => {
  let s: Servidor
  let dona: Usuario // owner
  let editor: Usuario
  let leitor: Usuario // viewer
  let estranho: Usuario
  let espacoId: string
  let eventoDaDona: string

  beforeAll(async () => {
    s = await subirPocketBase()
    dona = await criarUsuario(s, 'Dona')
    editor = await criarUsuario(s, 'Editor')
    leitor = await criarUsuario(s, 'Leitor')
    estranho = await criarUsuario(s, 'Estranho')

    const espaco = await dona.cliente.collection('espacos').create({
      nome: 'Bebê Teste',
      data_nascimento: '2026-10-09',
      intervalo_mamada_minutos: 180,
      criador: dona.id,
    })
    espacoId = espaco.id

    const cEditor = await convidar(dona.cliente, espacoId, 'editor')
    await aceitar(editor.cliente, cEditor.token)
    const cLeitor = await convidar(dona.cliente, espacoId, 'viewer', leitor.email)
    await aceitar(leitor.cliente, cLeitor.token)

    eventoDaDona = (await evento(dona.cliente, espacoId)).id
  })

  afterAll(() => s?.parar())

  describe('bebê e membros', () => {
    it('quem cria o bebê vira owner automaticamente', async () => {
      const m = await dona.cliente
        .collection('membros')
        .getFirstListItem(`usuario = "${dona.id}" && espaco_rel = "${espacoId}"`)
      expect(m.papel).toBe('owner')
    })

    it('ninguém se adiciona como membro pela API', async () => {
      const status = await falha(
        estranho.cliente
          .collection('membros')
          .create({ espaco_rel: espacoId, usuario: estranho.id, papel: 'owner' }),
      )
      expect(status).toBe(403)
    })

    it('estranho não vê o bebê nem os membros', async () => {
      expect(await falha(estranho.cliente.collection('espacos').getOne(espacoId))).toBe(404)
      expect(await estranho.cliente.collection('espacos').getFullList()).toHaveLength(0)
      const membros = await estranho.cliente
        .collection('membros')
        .getFullList({ filter: `espaco_rel = "${espacoId}"` })
      expect(membros).toHaveLength(0)
    })

    it('membro vê o nome de quem divide o bebê; estranho não', async () => {
      const u = await editor.cliente.collection('users').getOne(dona.id)
      expect(u.name).toBe('Dona')
      expect(await falha(estranho.cliente.collection('users').getOne(dona.id))).toBe(404)
    })

    it('editor não muda o próprio papel nem edita o bebê', async () => {
      const m = await editor.cliente
        .collection('membros')
        .getFirstListItem(`usuario = "${editor.id}" && espaco_rel = "${espacoId}"`)
      expect(await falha(editor.cliente.collection('membros').update(m.id, { papel: 'owner' }))).toBe(
        404,
      )
      expect(
        await falha(editor.cliente.collection('espacos').update(espacoId, { nome: 'X' })),
      ).toBe(404)
    })

    it('owner não pode ser removido por outro owner nem pelo editor', async () => {
      const m = await editor.cliente
        .collection('membros')
        .getFirstListItem(`usuario = "${dona.id}" && espaco_rel = "${espacoId}"`)
      expect(await falha(editor.cliente.collection('membros').delete(m.id))).toBe(404)
    })
  })

  describe('eventos', () => {
    it('registro de um membro aparece para os outros, com o autor', async () => {
      const lista = await leitor.cliente
        .collection('eventos')
        .getFullList({ filter: `espaco = "${espacoId}"` })
      expect(lista.map((e) => e.id)).toContain(eventoDaDona)
    })

    it('estranho não lê nada', async () => {
      expect(await estranho.cliente.collection('eventos').getFullList()).toHaveLength(0)
      expect(await falha(estranho.cliente.collection('eventos').getOne(eventoDaDona))).toBe(404)
    })

    it('estranho não escreve no bebê dos outros', async () => {
      expect(await falha(evento(estranho.cliente, espacoId))).toBe(400)
    })

    it('viewer não escreve, nem forçando a API', async () => {
      expect(await falha(evento(leitor.cliente, espacoId))).toBe(400)
      expect(
        await falha(leitor.cliente.collection('eventos').update(eventoDaDona, { lado: 'direito' })),
      ).toBe(404)
    })

    it('ser owner de outro bebê não dá escrita neste', async () => {
      await leitor.cliente
        .collection('espacos')
        .create({ nome: 'Outro bebê', criador: leitor.id, intervalo_mamada_minutos: 180 })
      expect(await falha(evento(leitor.cliente, espacoId))).toBe(400)
      expect(
        await falha(
          leitor.cliente
            .collection('eventos')
            .update(eventoDaDona, { deleted_at: new Date().toISOString() }),
        ),
      ).toBe(404)
    })

    it('ninguém registra em nome de outra pessoa', async () => {
      expect(await falha(evento(editor.cliente, espacoId, { criador: dona.id }))).toBe(400)
    })

    it('editor apaga (exclusão lógica) só o que registrou', async () => {
      const meu = await evento(editor.cliente, espacoId, { tipo: 'xixi' })
      await editor.cliente
        .collection('eventos')
        .update(meu.id, { deleted_at: new Date().toISOString() })
      expect(
        await falha(
          editor.cliente
            .collection('eventos')
            .update(eventoDaDona, { deleted_at: new Date().toISOString() }),
        ),
      ).toBe(404)
      // editar o registro de outra pessoa (sem apagar) é permitido
      await editor.cliente.collection('eventos').update(eventoDaDona, { observacao: 'mamou bem' })
    })

    it('editor não move registro para outro bebê nem troca o autor', async () => {
      const meu = await evento(editor.cliente, espacoId)
      expect(
        await falha(editor.cliente.collection('eventos').update(meu.id, { criador: dona.id })),
      ).toBe(404)
    })

    it('exclusão definitiva só para owner', async () => {
      const meu = await evento(editor.cliente, espacoId)
      expect(await falha(editor.cliente.collection('eventos').delete(meu.id))).toBe(404)
      await dona.cliente.collection('eventos').delete(meu.id)
    })

    it('aceita mamadeira, ordenha, cronômetro e cor do cocô (migração 0007)', async () => {
      const mb = await evento(editor.cliente, espacoId, {
        tipo: 'mamadeira',
        ml: 60,
        conteudo: 'formula',
      })
      expect(mb.ml).toBe(60)
      expect(mb.conteudo).toBe('formula')
      const ord = await evento(editor.cliente, espacoId, { tipo: 'ordenha', ml: 90 })
      expect(ord.tipo).toBe('ordenha')
      const fim = new Date(Date.now() + 15 * 60000).toISOString()
      const m = await evento(editor.cliente, espacoId, { fim_em: fim, lado: 'direito' })
      expect(m.fim_em).toBe(fim)
      const c = await evento(editor.cliente, espacoId, { tipo: 'coco', coco_cor: 'amarelo' })
      expect(c.coco_cor).toBe('amarelo')
      expect(await falha(evento(editor.cliente, espacoId, { tipo: 'coco', coco_cor: 'roxo' }))).toBe(
        400,
      )
      expect(await falha(evento(leitor.cliente, espacoId, { tipo: 'mamadeira', ml: 30 }))).toBe(400)
    })

    it('reenvio com o mesmo id gerado no aparelho não duplica', async () => {
      const id = 'abcdefghij12345'
      await evento(editor.cliente, espacoId, { id })
      try {
        await evento(editor.cliente, espacoId, { id })
        throw new Error('deveria recusar')
      } catch (err) {
        expect((err as ClientResponseError).response?.data?.id?.code).toBe('validation_not_unique')
      }
      const iguais = await dona.cliente.collection('eventos').getFullList({ filter: `id = "${id}"` })
      expect(iguais).toHaveLength(1)
    })
  })

  describe('convites', () => {
    it('token é gerado no servidor e validade limitada a 7 dias', async () => {
      const c = await convidar(dona.cliente, espacoId, 'viewer')
      expect(c.token).not.toBe('token-escolhido-pelo-cliente')
      expect(c.token.length).toBeGreaterThanOrEqual(32)
      const dias = (new Date(c.expira_em).getTime() - Date.now()) / 86400000
      expect(dias).toBeLessThanOrEqual(7.01)
    })

    it('só owner cria e vê convites', async () => {
      expect(await falha(convidar(editor.cliente, espacoId, 'editor'))).toBe(400)
      expect(await editor.cliente.collection('convites').getFullList()).toHaveLength(0)
      expect(await estranho.cliente.collection('convites').getFullList()).toHaveLength(0)
    })

    it('convite de e-mail diferente é recusado', async () => {
      const c = await convidar(dona.cliente, espacoId, 'editor', 'alguem@teste.local')
      expect(await falha(aceitar(estranho.cliente, c.token))).toBe(403)
    })

    it('convite usado é recusado', async () => {
      const c = await convidar(dona.cliente, espacoId, 'viewer')
      await aceitar(estranho.cliente, c.token)
      const outro = await criarUsuario(s, 'Outro')
      expect(await falha(aceitar(outro.cliente, c.token))).toBe(400)
      // limpa: estranho volta a ser estranho
      const m = await dona.cliente
        .collection('membros')
        .getFirstListItem(`usuario = "${estranho.id}" && espaco_rel = "${espacoId}"`)
      await dona.cliente.collection('membros').delete(m.id)
    })

    it('convite expirado é recusado', async () => {
      const c = await convidar(dona.cliente, espacoId, 'viewer')
      await s.admin
        .collection('convites')
        .update(c.id, { expira_em: new Date(Date.now() - 1000).toISOString() })
      expect(await falha(aceitar(estranho.cliente, c.token))).toBe(400)
    })

    it('aceitar convite menor não rebaixa quem já é owner', async () => {
      const c = await convidar(dona.cliente, espacoId, 'viewer')
      const r = await aceitar(dona.cliente, c.token)
      expect(r.papel).toBe('owner')
    })

    it('remoção de membro fica na auditoria, visível só para owner', async () => {
      const lista = await dona.cliente
        .collection('auditoria')
        .getFullList({ filter: `espaco = "${espacoId}"` })
      expect(lista.map((a) => a.acao)).toContain('membro_removido')
      expect(await editor.cliente.collection('auditoria').getFullList()).toHaveLength(0)
    })
  })

  describe('login', () => {
    it('login por senha está desativado (contas de demonstração inclusive)', async () => {
      const anon = new PocketBase(s.url)
      expect(
        await falha(
          anon.collection('users').authWithPassword('marciocanever@hotmail.com', 'Skip@Pass123'),
        ),
      ).toBeGreaterThanOrEqual(400)
    })

    it('contas fictícias de demonstração perderam o acesso à Sarah', async () => {
      const sarah = await s.admin.collection('espacos').getFirstListItem('nome = "Sarah"')
      const membros = await s.admin
        .collection('membros')
        .getFullList({ filter: `espaco_rel = "${sarah.id}"`, expand: 'usuario' })
      const emails = membros.map((m) => m.expand?.usuario?.email)
      expect(emails).toEqual(['marciocanever@hotmail.com'])
    })

    it('código por e-mail (OTP) está ativo', async () => {
      const anon = new PocketBase(s.url)
      const metodos = await anon.collection('users').listAuthMethods()
      expect(metodos.otp.enabled).toBe(true)
      expect(metodos.password.enabled).toBe(false)
    })

    it('pessoa nova consegue pedir o código (conta criada sem senha conhecida)', async () => {
      const anon = new PocketBase(s.url)
      const senha = 'descartavel-' + Math.random().toString(36).slice(2)
      await anon
        .collection('users')
        .create({ email: 'nova@teste.local', password: senha, passwordConfirm: senha })
      const { otpId } = await anon.collection('users').requestOTP('nova@teste.local')
      expect(otpId).toBeTruthy()
      expect(await falha(anon.collection('users').authWithOTP(otpId, '000000'))).toBe(400)
    })

    it('conta nova não enxerga nada até aceitar um convite', async () => {
      const novo = await criarUsuario(s, 'Novo')
      expect(await novo.cliente.collection('espacos').getFullList()).toHaveLength(0)
      expect(await novo.cliente.collection('eventos').getFullList()).toHaveLength(0)
      expect(await novo.cliente.collection('users').getFullList()).toHaveLength(1)
    })

    it('coleções legadas não são públicas', async () => {
      const anon = new PocketBase(s.url)
      expect(await falha(anon.collection('spaces').getFullList())).toBe(403)
    })
  })
})
