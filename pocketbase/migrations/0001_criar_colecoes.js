migrate(
  (app) => {
    // 1. Collection spaces
    const spaces = new Collection({
      name: 'spaces',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && criador = @request.auth.id",
      deleteRule: "@request.auth.id != '' && criador = @request.auth.id",
      fields: [
        { name: 'nome', type: 'text', required: true, min: 1, max: 60 },
        {
          name: 'criador',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_spaces_criador ON spaces (criador)'],
    })
    app.save(spaces)

    const spacesCol = app.findCollectionByNameOrId('spaces')

    // 2. Collection membros
    const membros = new Collection({
      name: 'membros',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'espaco',
          type: 'relation',
          required: true,
          collectionId: spacesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'usuario',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'papel',
          type: 'select',
          required: true,
          values: ['admin', 'membro'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_membros_espaco_usuario ON membros (espaco, usuario)',
        'CREATE INDEX idx_membros_usuario ON membros (usuario)',
      ],
    })
    app.save(membros)

    // 3. Collection convites
    const convites = new Collection({
      name: 'convites',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'espaco',
          type: 'relation',
          required: true,
          collectionId: spacesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'email', type: 'text', required: true },
        { name: 'token', type: 'text', required: true },
        {
          name: 'criador',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'expira_em', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_convites_email ON convites (email)',
        'CREATE UNIQUE INDEX idx_convites_token ON convites (token)',
      ],
    })
    app.save(convites)

    // 4. Collection atividades
    const atividades = new Collection({
      name: 'atividades',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'titulo', type: 'text', required: true, min: 1, max: 80 },
        { name: 'descricao', type: 'text', required: false, max: 500 },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          values: ['tarefa', 'evento', 'meta', 'compras', 'ideia'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['pendente', 'em_andamento', 'concluida'],
          maxSelect: 1,
        },
        {
          name: 'prioridade',
          type: 'select',
          required: true,
          values: ['baixa', 'media', 'alta'],
          maxSelect: 1,
        },
        { name: 'prazo', type: 'date', required: false },
        {
          name: 'criador',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'espaco',
          type: 'relation',
          required: true,
          collectionId: spacesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_atividades_espaco ON atividades (espaco)',
        'CREATE INDEX idx_atividades_criador ON atividades (criador)',
        'CREATE INDEX idx_atividades_status ON atividades (status)',
        'CREATE INDEX idx_atividades_categoria ON atividades (categoria)',
        'CREATE INDEX idx_atividades_prazo ON atividades (prazo)',
      ],
    })
    app.save(atividades)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('atividades'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('convites'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('membros'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('spaces'))
    } catch (_) {}
  },
)
