// pocketbase/hooks/convites.js
// Convites: token gerado no servidor, validade de até 7 dias, uso único,
// restrição opcional ao e-mail convidado. Aceite em POST /backend/v1/convites/aceitar.

onRecordCreateRequest((e) => {
  const VALIDADE_MAXIMA_MS = 7 * 24 * 60 * 60 * 1000

  // O token nunca vem do cliente.
  e.record.set('token', $security.randomString(40))
  e.record.set('usada_em', '')

  const papel = e.record.getString('papel')
  if (['owner', 'editor', 'viewer'].indexOf(papel) === -1) e.record.set('papel', 'editor')

  const limite = Date.now() + VALIDADE_MAXIMA_MS
  const pedido = new Date(e.record.getString('expira_em')).getTime()
  const expira = !pedido || isNaN(pedido) || pedido > limite ? limite : pedido
  e.record.set('expira_em', new Date(expira).toISOString())

  e.record.set('email', (e.record.getString('email') || '').trim().toLowerCase())

  e.next()
}, 'convites')

routerAdd('POST', '/backend/v1/convites/aceitar', (c) => {
  const authRecord = c.auth
  if (!authRecord) {
    return c.json(401, { message: 'Você precisa entrar para aceitar um convite.' })
  }

  let body = {}
  try {
    body = c.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  const token = String(body.token || '').trim()
  if (!token) {
    return c.json(400, { message: 'Convite não informado.' })
  }

  let convite
  try {
    convite = $app.findFirstRecordByData('convites', 'token', token)
  } catch (_) {
    return c.json(404, { message: 'Convite não encontrado ou revogado.' })
  }

  if (convite.getString('usada_em')) {
    return c.json(400, { message: 'Este convite já foi usado.' })
  }

  const expira = new Date(convite.getString('expira_em')).getTime()
  if (!expira || isNaN(expira) || Date.now() > expira) {
    return c.json(400, { message: 'Este convite expirou. Peça um novo para a família.' })
  }

  const conviteEmail = (convite.getString('email') || '').trim().toLowerCase()
  const userEmail = (authRecord.email() || '').trim().toLowerCase()
  if (conviteEmail && conviteEmail !== userEmail) {
    return c.json(403, { message: 'Este convite foi feito para outro e-mail.' })
  }

  const espacoId = convite.getString('espaco_rel')
  if (!espacoId) {
    return c.json(400, { message: 'Convite inválido.' })
  }

  let papel = convite.getString('papel') || 'editor'
  if (['owner', 'editor', 'viewer'].indexOf(papel) === -1) papel = 'editor'

  const ordem = { viewer: 0, editor: 1, owner: 2 }

  try {
    $app.runInTransaction((txApp) => {
      let existente = null
      try {
        existente = txApp.findFirstRecordByFilter(
          'membros',
          'usuario = {:u} && espaco_rel = {:e}',
          {
            u: authRecord.id,
            e: espacoId,
          },
        )
      } catch (_) {
        existente = null
      }

      if (existente) {
        // Nunca rebaixa quem já tem um papel maior.
        const atual = existente.getString('papel')
        if ((ordem[papel] || 0) > (ordem[atual] || 0)) {
          existente.set('papel', papel)
          txApp.save(existente)
        } else {
          papel = atual
        }
      } else {
        const novo = new Record(txApp.findCollectionByNameOrId('membros'))
        novo.set('espaco_rel', espacoId)
        novo.set('usuario', authRecord.id)
        novo.set('papel', papel)
        txApp.save(novo)
      }

      convite.set('usada_em', new Date().toISOString())
      txApp.save(convite)

      const audit = new Record(txApp.findCollectionByNameOrId('auditoria'))
      audit.set('espaco', espacoId)
      audit.set('acao', 'convite_aceito')
      audit.set('usuario', authRecord.id)
      audit.set('usuario_nome', authRecord.getString('name') || authRecord.email())
      audit.set('detalhe', 'Convite aceito com papel ' + papel)
      txApp.save(audit)
    })
  } catch (err) {
    return c.json(500, { message: 'Não foi possível aceitar o convite agora. Tente de novo.' })
  }

  return c.json(200, {
    success: true,
    message: 'Convite aceito!',
    papel: papel,
    espacoId: espacoId,
  })
})
