migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const espacos = app.findCollectionByNameOrId('espacos')
    const membros = app.findCollectionByNameOrId('membros')
    const eventos = app.findCollectionByNameOrId('eventos')

    // 1. Criar ou buscar Edineia
    let edineiaUser
    try {
      edineiaUser = app.findAuthRecordByEmail('_pb_users_auth_', 'edineia@exemplo.com')
    } catch (_) {
      edineiaUser = new Record(users)
      edineiaUser.setEmail('edineia@exemplo.com')
      edineiaUser.setPassword('Skip@Pass123')
      edineiaUser.setVerified(true)
      edineiaUser.set('name', 'Edineia')
      app.save(edineiaUser)
    }

    // 2. Criar ou buscar Marcio
    let marcioUser
    try {
      marcioUser = app.findAuthRecordByEmail('_pb_users_auth_', 'marcio@exemplo.com')
    } catch (_) {
      marcioUser = new Record(users)
      marcioUser.setEmail('marcio@exemplo.com')
      marcioUser.setPassword('Skip@Pass123')
      marcioUser.setVerified(true)
      marcioUser.set('name', 'Marcio')
      app.save(marcioUser)
    }

    // Usuário dev (marciocanever@hotmail.com)
    let devUser
    try {
      devUser = app.findAuthRecordByEmail('_pb_users_auth_', 'marciocanever@hotmail.com')
    } catch (_) {
      devUser = new Record(users)
      devUser.setEmail('marciocanever@hotmail.com')
      devUser.setPassword('Skip@Pass123')
      devUser.setVerified(true)
      devUser.set('name', 'Marcio Canever')
      app.save(devUser)
    }

    // 3. Criar ou buscar Bebê Sarah
    let sarahEspaco
    try {
      sarahEspaco = app.findFirstRecordByData('espacos', 'nome', 'Sarah')
    } catch (_) {
      sarahEspaco = new Record(espacos)
      sarahEspaco.set('nome', 'Sarah')
      sarahEspaco.set('data_nascimento', '2026-10-09')
      sarahEspaco.set('hora_nascimento', 'a confirmar')
      sarahEspaco.set('peso_nascimento_g', 3250)
      sarahEspaco.set('idade_gestacional_semanas', 39)
      sarahEspaco.set('intervalo_mamada_minutos', 180)
      sarahEspaco.set('criador', edineiaUser.id)
      app.save(sarahEspaco)
    }

    // 4. Criar um space correspondente na coleção antiga 'spaces' para satisfazer a FK se necessário,
    // ou reaproveitar 'Espaço Colaborativo'
    let spacesCol = app.findCollectionByNameOrId('spaces')
    let sarahSpace
    try {
      sarahSpace = app.findFirstRecordByData('spaces', 'nome', 'Sarah')
    } catch (_) {
      sarahSpace = new Record(spacesCol)
      sarahSpace.set('nome', 'Sarah')
      sarahSpace.set('criador', edineiaUser.id)
      app.save(sarahSpace)
    }

    // Vincular membros como owners do bebê Sarah
    const owners = [
      { user: edineiaUser, role: 'owner' },
      { user: marcioUser, role: 'owner' },
      { user: devUser, role: 'owner' },
    ]

    for (let i = 0; i < owners.length; i++) {
      const item = owners[i]
      if (!item.user) continue

      try {
        // Verificar se já existe vínculo para (sarahSpace.id, user.id)
        const existing = app.findRecordsByFilter(
          'membros',
          `espaco = "${sarahSpace.id}" && usuario = "${item.user.id}"`,
          '-created',
          1,
          0,
        )
        if (existing.length === 0) {
          throw new Error('Not found')
        }
      } catch (_) {
        try {
          const m = new Record(membros)
          m.set('espaco', sarahSpace.id)
          m.set('espaco_rel', sarahEspaco.id)
          m.set('usuario', item.user.id)
          m.set('papel', 'owner')
          app.save(m)
        } catch (err) {
          console.log('Membro save error:', err)
        }
      }
    }

    // 5. Seed de mamada inicial em 10/10/2026 09:00 (UTC 12:00)
    try {
      const feeds = app.findRecordsByFilter(
        'eventos',
        `espaco = "${sarahEspaco.id}" && tipo = "mamada"`,
        '-created',
        1,
        0,
      )
      if (feeds.length === 0) {
        throw new Error('Not found')
      }
    } catch (_) {
      const feed = new Record(eventos)
      feed.set('espaco', sarahEspaco.id)
      feed.set('tipo', 'mamada')
      feed.set('inicio_em', '2026-10-10T12:00:00.000Z')
      feed.set('lado', 'esquerdo')
      feed.set('observacao', 'Primeira mamada registrada')
      feed.set('criador', edineiaUser.id)
      feed.set('criador_nome', 'Edineia')
      app.save(feed)
    }
  },
  (app) => {
    // down
  },
)
