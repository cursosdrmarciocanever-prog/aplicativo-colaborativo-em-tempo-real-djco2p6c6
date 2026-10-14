// Notificações no celular (Web Push).
// - push_inscricoes: um registro por aparelho, com as preferências de aviso. Criado só pelo
//   servidor (POST /backend/v1/push/inscrever), porque o mesmo aparelho pode trocar de conta.
//   Cada pessoa vê, ajusta e apaga só os próprios aparelhos.
// - push_enviados: controle interno do notificador para não repetir um aviso. Só superusuário.

const logado = "@request.auth.id != ''"
const naoMuda = (campo) =>
  `(@request.body.${campo}:isset = false || @request.body.${campo} = ${campo})`

migrate(
  (app) => {
    const espacos = app.findCollectionByNameOrId('espacos')
    const dono = `${logado} && usuario = @request.auth.id`

    const inscricoes = new Collection({
      name: 'push_inscricoes',
      type: 'base',
      listRule: dono,
      viewRule: dono,
      createRule: null,
      updateRule: `${dono} && ${['usuario', 'espaco', 'endpoint', 'p256dh', 'auth', 'falhas']
        .map(naoMuda)
        .join(' && ')}`,
      deleteRule: dono,
      fields: [
        {
          name: 'usuario',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'espaco',
          type: 'relation',
          required: true,
          collectionId: espacos.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'endpoint', type: 'text', required: true, max: 1000 },
        { name: 'p256dh', type: 'text', required: true, max: 200 },
        { name: 'auth', type: 'text', required: true, max: 100 },
        { name: 'aparelho', type: 'text', required: false, max: 120 },
        { name: 'mamada', type: 'bool' },
        { name: 'mamada_antes_min', type: 'number', min: 0, max: 60, onlyInt: true },
        { name: 'mamada_atraso', type: 'bool' },
        { name: 'vacinas', type: 'bool' },
        { name: 'consultas', type: 'bool' },
        { name: 'familia', type: 'bool' },
        { name: 'teste_em', type: 'text', required: false }, // ISO; o notificador manda um teste
        { name: 'falhas', type: 'number', min: 0, onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_push_endpoint ON push_inscricoes (endpoint)',
        'CREATE INDEX idx_push_espaco ON push_inscricoes (espaco)',
      ],
    })
    app.save(inscricoes)

    const enviados = new Collection({
      name: 'push_enviados',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'chave', type: 'text', required: true, max: 300 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_push_enviados_chave ON push_enviados (chave)'],
    })
    app.save(enviados)
  },
  (app) => {
    for (const nome of ['push_enviados', 'push_inscricoes']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {
        /* já não existe */
      }
    }
  },
)
