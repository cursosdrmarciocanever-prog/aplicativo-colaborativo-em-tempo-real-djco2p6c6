// pocketbase/hooks/convites.js
// Hook/rota POST para aceitar convite sob namespace /backend/v1/

routerAdd('POST', '/backend/v1/convites/aceitar', (c) => {
  const authRecord = c.auth
  if (!authRecord) {
    return c.json(401, { message: 'Você precisa estar autenticado para aceitar um convite.' })
  }

  let body = {}
  try {
    body = c.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  const token = (body.token || '').trim()
  if (!token) {
    return c.json(400, { message: 'Token de convite não informado.' })
  }

  let convite
  try {
    convite = $app.findFirstRecordByData('convites', 'token', token)
  } catch (_) {
    return c.json(404, { message: 'Convite não encontrado.' })
  }

  // Validar se já foi usado
  const usadaEm = convite.getString('usada_em')
  if (usadaEm && usadaEm.length > 0) {
    return c.json(400, { message: 'Convite já utilizado' })
  }

  // Validar expiração (7 dias)
  const expiraEmStr = convite.getString('expira_em')
  if (expiraEmStr) {
    const expiraEm = new Date(expiraEmStr)
    if (!isNaN(expiraEm.getTime()) && Date.now() > expiraEm.getTime()) {
      return c.json(400, { message: 'Convite expirado' })
    }
  }

  // Validar se é restrito a e-mail
  const conviteEmail = (convite.getString('email') || '').trim().toLowerCase()
  const userEmail = (authRecord.email() || '').trim().toLowerCase()
  if (conviteEmail && conviteEmail !== userEmail) {
    return c.json(403, { message: 'E-mail não confere com o convite' })
  }

  // Determinar papel
  let papel = convite.getString('papel') || 'editor'
  if (papel === 'membro') papel = 'editor'
  if (papel === 'admin') papel = 'owner'

  const espacoId = convite.getString('espaco_rel') || convite.getString('espaco')
  const defaultSpaceId = convite.getString('espaco')

  // Adicionar ou atualizar membro
  const membrosCol = $app.findCollectionByNameOrId('membros')

  try {
    // Buscar se já é membro
    let existing
    try {
      existing = $app.findFirstRecordByData('membros', 'usuario', authRecord.id)
    } catch (_) {
      existing = null
    }

    if (existing) {
      existing.set('papel', papel)
      if (espacoId) existing.set('espaco_rel', espacoId)
      $app.save(existing)
    } else {
      const novoMembro = new Record(membrosCol)
      if (defaultSpaceId) novoMembro.set('espaco', defaultSpaceId)
      if (espacoId) novoMembro.set('espaco_rel', espacoId)
      novoMembro.set('usuario', authRecord.id)
      novoMembro.set('papel', papel)
      $app.save(novoMembro)
    }

    // Marcar convite como utilizado
    convite.set('usada_em', new Date().toISOString())
    $app.save(convite)

    // Auditoria
    try {
      const auditoriaCol = $app.findCollectionByNameOrId('auditoria')
      const audit = new Record(auditoriaCol)
      if (espacoId) audit.set('espaco', espacoId)
      audit.set('acao', 'convite_aceito')
      audit.set('usuario', authRecord.id)
      audit.set('usuario_nome', authRecord.getString('name') || authRecord.email())
      audit.set('detalhe', `Convite aceito com papel ${papel}`)
      $app.save(audit)
    } catch (_) {}

    return c.json(200, {
      success: true,
      message: 'Convite aceito com sucesso!',
      papel: papel,
      espacoId: espacoId,
    })
  } catch (err) {
    return c.json(500, { message: 'Erro ao processar convite: ' + (err.message || String(err)) })
  }
})
