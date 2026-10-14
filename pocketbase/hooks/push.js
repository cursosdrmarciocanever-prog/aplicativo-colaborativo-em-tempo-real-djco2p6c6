// pocketbase/hooks/push.js
// Notificações no celular (Web Push).
//   GET  /backend/v1/push/chave      -> chave pública VAPID (para o navegador se inscrever)
//   POST /backend/v1/push/inscrever  -> grava/atualiza o aparelho da pessoa logada
// Quem envia os avisos é o serviço "notificador" (deploy/docker-compose.yml).

routerAdd('GET', '/backend/v1/push/chave', (c) => {
  // A chave é gerada pelo notificador e fica na pasta compartilhada (PUSH_DIR).
  let chave = ''
  const pasta = ($os.getenv('PUSH_DIR') || '').trim()
  if (pasta) {
    try {
      chave = JSON.parse(toString($os.readFile(pasta + '/vapid.json'))).publicKey || ''
    } catch (_) {
      chave = ''
    }
  }
  if (!chave) {
    return c.json(503, { message: 'Notificações ainda não configuradas no servidor.' })
  }
  return c.json(200, { chave })
})

routerAdd('POST', '/backend/v1/push/inscrever', (c) => {
  const usuario = c.auth
  if (!usuario) return c.json(401, { message: 'Entre para ativar as notificações.' })

  let body = {}
  try {
    body = c.requestInfo().body || {}
  } catch (_) {
    body = {}
  }
  const texto = (v, max) => String(v || '').trim().slice(0, max)
  const espacoId = texto(body.espaco, 30)
  const endpoint = texto(body.endpoint, 1000)
  const p256dh = texto(body.p256dh, 200)
  const auth = texto(body.auth, 100)
  if (!espacoId || !endpoint.startsWith('https://') || !p256dh || !auth) {
    return c.json(400, { message: 'Inscrição inválida.' })
  }

  // Qualquer membro (inclusive quem só visualiza) pode receber avisos.
  try {
    $app.findFirstRecordByFilter('membros', 'usuario = {:u} && espaco_rel = {:e}', {
      u: usuario.id,
      e: espacoId,
    })
  } catch (_) {
    return c.json(403, { message: 'Você não faz parte deste bebê.' })
  }

  let rec = null
  try {
    rec = $app.findFirstRecordByData('push_inscricoes', 'endpoint', endpoint)
  } catch (_) {
    rec = null
  }

  const novo = !rec || rec.getString('usuario') !== usuario.id || rec.getString('espaco') !== espacoId
  if (!rec) rec = new Record($app.findCollectionByNameOrId('push_inscricoes'))

  rec.set('usuario', usuario.id)
  rec.set('espaco', espacoId)
  rec.set('endpoint', endpoint)
  rec.set('p256dh', p256dh)
  rec.set('auth', auth)
  rec.set('aparelho', texto(body.aparelho, 120))
  rec.set('falhas', 0)
  if (novo) {
    // Padrão: mamada na hora e lembrete de atraso, vacinas e consultas; família desligado.
    rec.set('mamada', true)
    rec.set('mamada_antes_min', 0)
    rec.set('mamada_atraso', true)
    rec.set('vacinas', true)
    rec.set('consultas', true)
    rec.set('familia', false)
    rec.set('teste_em', new Date().toISOString()) // o notificador manda "ativadas!"
  }
  $app.save(rec)

  return c.json(200, {
    id: rec.id,
    mamada: rec.getBool('mamada'),
    mamada_antes_min: rec.getInt('mamada_antes_min'),
    mamada_atraso: rec.getBool('mamada_atraso'),
    vacinas: rec.getBool('vacinas'),
    consultas: rec.getBool('consultas'),
    familia: rec.getBool('familia'),
  })
})

// Na subida: cria (ou reconfirma) o superusuário do notificador e guarda a senha numa
// pasta compartilhada só entre os dois contêineres (volume push_chaves). Assim nada
// precisa ser configurado à mão no deploy/.env.
onBootstrap((e) => {
  e.next()
  const pasta = ($os.getenv('PUSH_DIR') || '').trim()
  if (!pasta) return
  try {
    $os.mkdirAll(pasta, 0o700)
    const arquivo = pasta + '/notificador.json'
    let cred = null
    try {
      cred = JSON.parse(toString($os.readFile(arquivo)))
    } catch (_) {
      cred = null
    }
    if (!cred || !cred.email || !cred.senha) {
      cred = { email: 'notificador@diario.invalid', senha: $security.randomString(48) }
      $os.writeFile(arquivo, JSON.stringify(cred), 0o600)
    }
    let su
    try {
      su = e.app.findAuthRecordByEmail('_superusers', cred.email)
    } catch (_) {
      su = new Record(e.app.findCollectionByNameOrId('_superusers'))
      su.setEmail(cred.email)
    }
    su.setPassword(cred.senha)
    e.app.save(su)
    console.log('[push] notificador pronto para entrar')
  } catch (err) {
    console.log('[push] não foi possível preparar o notificador: ' + err)
  }
})
