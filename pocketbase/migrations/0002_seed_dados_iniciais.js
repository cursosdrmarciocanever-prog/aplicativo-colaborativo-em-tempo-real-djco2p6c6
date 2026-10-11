migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const spaces = app.findCollectionByNameOrId('spaces')
    const membros = app.findCollectionByNameOrId('membros')
    const atividades = app.findCollectionByNameOrId('atividades')

    // 1. Criar ou obter usuário marciocanever@hotmail.com
    let adminUser
    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'marciocanever@hotmail.com')
    } catch (_) {
      adminUser = new Record(users)
      adminUser.setEmail('marciocanever@hotmail.com')
      adminUser.setPassword('Skip@Pass')
      adminUser.setVerified(true)
      adminUser.set('name', 'Marcio Canever')
      app.save(adminUser)
    }

    // 2. Criar ou obter espaço inicial
    let spaceRecord
    try {
      spaceRecord = app.findFirstRecordByData('spaces', 'nome', 'Espaço Colaborativo')
    } catch (_) {
      spaceRecord = new Record(spaces)
      spaceRecord.set('nome', 'Espaço Colaborativo')
      spaceRecord.set('criador', adminUser.id)
      app.save(spaceRecord)
    }

    // 3. Vincular usuário como admin do espaço em membros
    try {
      app.findFirstRecordByData('membros', 'usuario', adminUser.id)
    } catch (_) {
      const membro = new Record(membros)
      membro.set('espaco', spaceRecord.id)
      membro.set('usuario', adminUser.id)
      membro.set('papel', 'admin')
      app.save(membro)
    }

    // 4. Criar atividades realistas de exemplo
    const sampleActivities = [
      {
        titulo: 'Planejar reunião de equipe semanal',
        descricao: 'Alinhar entregas da sprint e metas dos times de design e produto.',
        categoria: 'evento',
        status: 'pendente',
        prioridade: 'alta',
        prazo: '2026-05-15 10:00:00.000Z',
      },
      {
        titulo: 'Revisar proposta do novo cliente',
        descricao: 'Analisar escopo comercial, prazos de entrega e viabilidade técnica.',
        categoria: 'tarefa',
        status: 'em_andamento',
        prioridade: 'media',
        prazo: '2026-05-20 18:00:00.000Z',
      },
      {
        titulo: 'Comprar material de escritório',
        descricao: 'Cadernos de anotações, post-its coloridos e cabos adaptadores.',
        categoria: 'compras',
        status: 'concluida',
        prioridade: 'baixa',
        prazo: '2026-05-02 12:00:00.000Z',
      },
      {
        titulo: 'Definir metas de engajamento do trimestre',
        descricao: 'Atingir 95% de retenção e índice NPS superior a 75 pontos.',
        categoria: 'meta',
        status: 'pendente',
        prioridade: 'alta',
        prazo: '2026-06-30 23:59:00.000Z',
      },
      {
        titulo: 'Ideia para aplicativo mobile offline-first',
        descricao: 'Estruturar protótipo e fluxo de sincronização em segundo plano.',
        categoria: 'ideia',
        status: 'em_andamento',
        prioridade: 'media',
        prazo: '2026-05-25 15:00:00.000Z',
      },
    ]

    for (let i = 0; i < sampleActivities.length; i++) {
      const item = sampleActivities[i]
      try {
        app.findFirstRecordByData('atividades', 'titulo', item.titulo)
      } catch (_) {
        const atv = new Record(atividades)
        atv.set('titulo', item.titulo)
        atv.set('descricao', item.descricao)
        atv.set('categoria', item.categoria)
        atv.set('status', item.status)
        atv.set('prioridade', item.prioridade)
        atv.set('prazo', item.prazo)
        atv.set('criador', adminUser.id)
        atv.set('espaco', spaceRecord.id)
        app.save(atv)
      }
    }
  },
  (app) => {
    // rollback opcional
  },
)
