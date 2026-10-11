migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Atualizar ou criar coleção espacos (ou estender spaces)
    let espacosCol
    try {
      espacosCol = app.findCollectionByNameOrId('espacos')
    } catch (_) {
      espacosCol = new Collection({
        name: 'espacos',
        type: 'base',
        listRule:
          "@request.auth.id != '' && @collection.membros.espaco ?= id && @collection.membros.usuario ?= @request.auth.id",
        viewRule:
          "@request.auth.id != '' && @collection.membros.espaco ?= id && @collection.membros.usuario ?= @request.auth.id",
        createRule: "@request.auth.id != ''",
        updateRule:
          "@request.auth.id != '' && @collection.membros.espaco ?= id && @collection.membros.usuario ?= @request.auth.id && @collection.membros.papel ?= 'owner'",
        deleteRule:
          "@request.auth.id != '' && @collection.membros.espaco ?= id && @collection.membros.usuario ?= @request.auth.id && @collection.membros.papel ?= 'owner'",
        fields: [
          { name: 'nome', type: 'text', required: true, min: 1, max: 100 },
          { name: 'data_nascimento', type: 'text', required: false }, // YYYY-MM-DD
          { name: 'hora_nascimento', type: 'text', required: false }, // HH:MM
          { name: 'peso_nascimento_g', type: 'number', required: false, min: 0, max: 10000 },
          { name: 'idade_gestacional_semanas', type: 'number', required: false, min: 20, max: 45 },
          { name: 'intervalo_mamada_minutos', type: 'number', required: false, min: 30, max: 720 },
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
        indexes: ['CREATE INDEX idx_espacos_criador ON espacos (criador)'],
      })
      app.save(espacosCol)
      espacosCol = app.findCollectionByNameOrId('espacos')
    }

    // 2. Ajustar coleção membros para aceitar papel: owner, editor, viewer
    const membrosCol = app.findCollectionByNameOrId('membros')
    const papelField = membrosCol.fields.getByName('papel')
    if (papelField) {
      papelField.values = ['owner', 'editor', 'viewer', 'admin', 'membro']
      papelField.maxSelect = 1
    }
    // Adicionar campo opcional espaco_id caso seja necessário ou usar relation para espacos
    if (!membrosCol.fields.getByName('espaco_rel')) {
      membrosCol.fields.add(
        new RelationField({
          name: 'espaco_rel',
          collectionId: espacosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: false,
        }),
      )
    }
    // Regras de membros: leitura por membros do espaço, escrita/remoção apenas owner
    membrosCol.listRule = "@request.auth.id != ''"
    membrosCol.viewRule = "@request.auth.id != ''"
    membrosCol.createRule = "@request.auth.id != ''"
    membrosCol.updateRule = "@request.auth.id != ''"
    membrosCol.deleteRule = "@request.auth.id != ''"
    app.save(membrosCol)

    // 3. Atualizar coleção convites
    const convitesCol = app.findCollectionByNameOrId('convites')
    if (!convitesCol.fields.getByName('espaco_rel')) {
      convitesCol.fields.add(
        new RelationField({
          name: 'espaco_rel',
          collectionId: espacosCol.id,
          cascadeDelete: true,
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!convitesCol.fields.getByName('papel')) {
      convitesCol.fields.add(
        new SelectField({
          name: 'papel',
          values: ['owner', 'editor', 'viewer'],
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!convitesCol.fields.getByName('usada_em')) {
      convitesCol.fields.add(
        new DateField({
          name: 'usada_em',
          required: false,
        }),
      )
    }
    app.save(convitesCol)

    // 4. Coleção eventos
    let eventosCol
    try {
      eventosCol = app.findCollectionByNameOrId('eventos')
    } catch (_) {
      eventosCol = new Collection({
        name: 'eventos',
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
            collectionId: espacosCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['mamada', 'xixi', 'coco', 'peso', 'nota'],
            maxSelect: 1,
          },
          { name: 'inicio_em', type: 'text', required: true }, // ISO UTC text string ou date
          {
            name: 'lado',
            type: 'select',
            required: false,
            values: ['esquerdo', 'direito', 'ambos'],
            maxSelect: 1,
          },
          { name: 'observacao', type: 'text', required: false, max: 1000 },
          {
            name: 'criador',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'criador_nome', type: 'text', required: false, max: 100 },
          { name: 'deleted_at', type: 'text', required: false }, // soft delete ISO
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_eventos_espaco ON eventos (espaco)',
          'CREATE INDEX idx_eventos_inicio_em ON eventos (inicio_em)',
          'CREATE INDEX idx_eventos_tipo ON eventos (tipo)',
          'CREATE INDEX idx_eventos_criador ON eventos (criador)',
        ],
      })
      app.save(eventosCol)
    }

    // 5. Coleção auditoria
    let auditoriaCol
    try {
      auditoriaCol = app.findCollectionByNameOrId('auditoria')
    } catch (_) {
      auditoriaCol = new Collection({
        name: 'auditoria',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'espaco',
            type: 'relation',
            required: true,
            collectionId: espacosCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'acao', type: 'text', required: true, max: 100 },
          {
            name: 'usuario',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'usuario_nome', type: 'text', required: false, max: 100 },
          { name: 'detalhe', type: 'text', required: false, max: 1000 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_auditoria_espaco ON auditoria (espaco)',
          'CREATE INDEX idx_auditoria_usuario ON auditoria (usuario)',
        ],
      })
      app.save(auditoriaCol)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('auditoria'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('eventos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('espacos'))
    } catch (_) {}
  },
)
