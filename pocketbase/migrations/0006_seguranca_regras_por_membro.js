// Segurança (seção 8): todo acesso passa pela tabela membros.
// Antes desta migração qualquer usuário logado lia e alterava eventos, membros e convites
// de qualquer bebê, e as contas de demonstração tinham senha pública.
//
// Regras:
// - Só membros do bebê leem; só owner/editor escrevem; só owner administra pessoas.
// - Editor apaga (exclusão lógica) apenas o que ele mesmo registrou.
// - Ninguém troca o bebê (espaco) nem o autor (criador) de um registro.
// - Membros só são criados pelo servidor (hook ao criar bebê e ao aceitar convite).
// - Login apenas por código de uso único enviado por e-mail (OTP); senha desativada.

const membro = (campo) =>
  `@collection.membros.espaco_rel ?= ${campo} && @collection.membros.usuario ?= @request.auth.id`
const escritor = (campo) =>
  `${membro(campo)} && (@collection.membros.papel ?= 'owner' || @collection.membros.papel ?= 'editor')`
const dono = (campo) => `${membro(campo)} && @collection.membros.papel ?= 'owner'`
const logado = "@request.auth.id != ''"
const naoMuda = (campo) =>
  `(@request.body.${campo}:isset = false || @request.body.${campo} = ${campo})`

migrate(
  (app) => {
    // Coleções legadas do template (spaces, atividades): somente superusuário.
    for (const nome of ['spaces', 'atividades']) {
      try {
        const col = app.findCollectionByNameOrId(nome)
        col.listRule = null
        col.viewRule = null
        col.createRule = null
        col.updateRule = null
        col.deleteRule = null
        app.save(col)
      } catch (_) {}
    }

    // O campo legado "espaco" (-> spaces) deixa de ser obrigatório; espaco_rel é a fonte da verdade.
    for (const nome of ['membros', 'convites']) {
      const col = app.findCollectionByNameOrId(nome)
      const legado = col.fields.getByName('espaco')
      if (legado) legado.required = false
      if (nome === 'convites') {
        const email = col.fields.getByName('email')
        if (email) email.required = false
      }
      app.save(col)
    }

    const espacos = app.findCollectionByNameOrId('espacos')
    espacos.listRule = `${logado} && ${membro('id')}`
    espacos.viewRule = espacos.listRule
    espacos.createRule = `${logado} && criador = @request.auth.id`
    espacos.updateRule = `${logado} && ${dono('id')} && ${naoMuda('criador')}`
    espacos.deleteRule = `${logado} && ${dono('id')}`
    app.save(espacos)

    const membros = app.findCollectionByNameOrId('membros')
    membros.listRule = `${logado} && (usuario = @request.auth.id || ${membro('espaco_rel')})`
    membros.viewRule = membros.listRule
    membros.createRule = null
    membros.updateRule = `${logado} && ${dono('espaco_rel')} && usuario != @request.auth.id && ${naoMuda('espaco_rel')} && ${naoMuda('usuario')} && ${naoMuda('espaco')}`
    membros.deleteRule = `${logado} && papel != 'owner' && (usuario = @request.auth.id || (${dono('espaco_rel')}))`
    app.save(membros)

    const convites = app.findCollectionByNameOrId('convites')
    convites.listRule = `${logado} && ${dono('espaco_rel')}`
    convites.viewRule = convites.listRule
    convites.createRule = `${logado} && ${dono('espaco_rel')} && criador = @request.auth.id`
    convites.updateRule = null
    convites.deleteRule = `${logado} && ${dono('espaco_rel')}`
    app.save(convites)

    const eventos = app.findCollectionByNameOrId('eventos')
    eventos.listRule = `${logado} && ${membro('espaco')}`
    eventos.viewRule = eventos.listRule
    eventos.createRule = `${logado} && ${escritor('espaco')} && criador = @request.auth.id`
    eventos.updateRule = `${logado} && ${escritor('espaco')} && ${naoMuda('espaco')} && ${naoMuda('criador')} && (criador = @request.auth.id || @request.body.deleted_at:isset = false || @collection.membros.papel ?= 'owner')`
    eventos.deleteRule = `${logado} && ${dono('espaco')}`
    app.save(eventos)

    const auditoria = app.findCollectionByNameOrId('auditoria')
    auditoria.listRule = `${logado} && ${dono('espaco')}`
    auditoria.viewRule = auditoria.listRule
    auditoria.createRule = `${logado} && ${membro('espaco')} && usuario = @request.auth.id`
    auditoria.updateRule = null
    auditoria.deleteRule = null
    app.save(auditoria)

    // Usuários: cada um vê a si mesmo e quem divide um bebê com ele (para mostrar o nome).
    const users = app.findCollectionByNameOrId('users')
    const vejoUsuario =
      'id = @request.auth.id || (@collection.membros:alvo.usuario ?= id && @collection.membros:eu.usuario ?= @request.auth.id && @collection.membros:alvo.espaco_rel ?= @collection.membros:eu.espaco_rel)'
    users.listRule = `${logado} && (${vejoUsuario})`
    users.viewRule = users.listRule
    users.passwordAuth.enabled = false
    users.otp.enabled = true
    users.otp.length = 6
    users.otp.duration = 600
    users.otp.emailTemplate.subject = 'Seu código de acesso ao {APP_NAME}'
    users.otp.emailTemplate.body =
      '<p>Olá!</p>\n<p>Seu código para entrar no {APP_NAME} é: <strong>{OTP}</strong></p>\n<p>Ele vale por 10 minutos. Se não foi você quem pediu, pode ignorar este e-mail.</p>'
    app.save(users)

    // Quem criou cada bebê continua owner (as regras agora dependem só de membros.espaco_rel).
    const membrosCol = app.findCollectionByNameOrId('membros')
    for (const esp of app.findAllRecords('espacos')) {
      const criador = esp.getString('criador')
      if (!criador) continue
      const vinculos = app.findRecordsByFilter(
        'membros',
        'usuario = {:u} && espaco_rel = {:e}',
        '',
        1,
        0,
        { u: criador, e: esp.id },
      )
      if (vinculos.length > 0) continue
      const m = new Record(membrosCol)
      m.set('espaco_rel', esp.id)
      m.set('usuario', criador)
      m.set('papel', 'owner')
      app.save(m)
    }

    // Contas de demonstração: a senha "Skip@Pass123" foi publicada no README e na tela de login.
    // Todas recebem senha aleatória (inutilizável, pois a senha foi desativada).
    // As de e-mail fictício perdem o acesso ao bebê e passam para um domínio que nunca entrega e-mail.
    const ficticias = {
      'edineia@exemplo.com': 'edineia.seed@diario.invalid',
      'marcio@exemplo.com': 'marcio.seed@diario.invalid',
    }
    for (const email of [
      'edineia@exemplo.com',
      'marcio@exemplo.com',
      'marciocanever@hotmail.com',
    ]) {
      let user
      try {
        user = app.findAuthRecordByEmail('users', email)
      } catch (_) {
        continue
      }
      user.setPassword($security.randomString(48))
      if (ficticias[email]) {
        user.setEmail(ficticias[email])
        const vinculos = app.findRecordsByFilter('membros', 'usuario = {:u}', '', 0, 0, {
          u: user.id,
        })
        for (const v of vinculos) app.delete(v)
      }
      app.save(user)
    }
  },
  (app) => {
    // Sem volta: reabrir as regras exporia dados de saúde.
  },
)
