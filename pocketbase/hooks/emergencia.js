// pocketbase/hooks/emergencia.js
// POST /backend/v1/acesso-emergencia { email, codigo }
// Entra como owner sem e-mail, com um código de uso único (ver migração 0007).
// Recusa tudo se o envio de e-mail (SMTP) já estiver ligado.

routerAdd('POST', '/backend/v1/acesso-emergencia', (c) => {
  const recusa = () => c.json(400, { message: 'Código de emergência inválido, usado ou expirado.' })

  if ($app.settings().smtp.enabled) {
    return c.json(400, {
      message: 'O envio de e-mail já está ligado: entre pelo código enviado por e-mail.',
    })
  }

  let body = {}
  try {
    body = c.requestInfo().body || {}
  } catch (_) {}
  const email = String(body.email || '')
    .trim()
    .toLowerCase()
  const codigo = String(body.codigo || '')
    .trim()
    .toLowerCase()
  if (!email || codigo.length < 20) return recusa()

  let acesso
  try {
    acesso = $app.findFirstRecordByData(
      'acessos_emergencia',
      'segredo_hash',
      $security.sha256(codigo),
    )
  } catch (_) {
    return recusa()
  }
  if (acesso.getString('usado_em')) return recusa()
  if (new Date(acesso.getString('expira_em')).getTime() < Date.now()) return recusa()
  if (acesso.getString('email').toLowerCase() !== email) return recusa()

  let user
  try {
    user = $app.findAuthRecordByEmail('users', email)
  } catch (_) {
    return recusa()
  }

  // Só serve para quem já é owner de algum bebê.
  const donos = $app.findRecordsByFilter(
    'membros',
    "usuario = {:u} && papel = 'owner' && espaco_rel != ''",
    '',
    0,
    0,
    { u: user.id },
  )
  if (donos.length === 0) return recusa()

  acesso.set('usado_em', new Date().toISOString())
  $app.save(acesso)

  for (const m of donos) {
    const audit = new Record($app.findCollectionByNameOrId('auditoria'))
    audit.set('espaco', m.getString('espaco_rel'))
    audit.set('acao', 'acesso_emergencia')
    audit.set('usuario', user.id)
    audit.set('usuario_nome', user.getString('name') || email)
    audit.set('detalhe', 'Entrada de emergência usada (sem e-mail)')
    $app.save(audit)
  }

  return $apis.recordAuthResponse(c, user, 'emergencia', null)
})
