// Remédios e vitaminas com lembrete.
// - medicacoes: o que a pediatra prescreveu (nome, dose, horários ou "se necessário").
// - medicacao_doses: cada dose dada (ou pulada). Uma dose de horário fixo só pode ser
//   registrada uma vez: se a mãe já deu, o pai não consegue registrar de novo (índice único).
// - push_inscricoes.remedios: aviso no celular na hora da dose (ligado nos aparelhos já ativos).

const membro = (campo) =>
  `@collection.membros.espaco_rel ?= ${campo} && @collection.membros.usuario ?= @request.auth.id`
const escritor = (campo) =>
  `${membro(campo)} && (@collection.membros.papel ?= 'owner' || @collection.membros.papel ?= 'editor')`
const logado = "@request.auth.id != ''"
const naoMuda = (campo) =>
  `(@request.body.${campo}:isset = false || @request.body.${campo} = ${campo})`

function regras(extraUpdate) {
  return {
    listRule: `${logado} && ${membro('espaco')}`,
    viewRule: `${logado} && ${membro('espaco')}`,
    createRule: `${logado} && ${escritor('espaco')} && criador = @request.auth.id`,
    updateRule: `${logado} && ${escritor('espaco')} && ${naoMuda('espaco')} && ${naoMuda('criador')}${extraUpdate || ''}`,
    deleteRule: `${logado} && ${escritor('espaco')} && (criador = @request.auth.id || @collection.membros.papel ?= 'owner')`,
  }
}

function comuns(espacosId) {
  return [
    {
      name: 'espaco',
      type: 'relation',
      required: true,
      collectionId: espacosId,
      cascadeDelete: true,
      maxSelect: 1,
    },
    {
      name: 'criador',
      type: 'relation',
      required: true,
      collectionId: '_pb_users_auth_',
      cascadeDelete: false,
      maxSelect: 1,
    },
    { name: 'criador_nome', type: 'text', required: false, max: 100 },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ]
}

const DIA = '^\\d{4}-\\d{2}-\\d{2}$'

migrate(
  (app) => {
    const espacos = app.findCollectionByNameOrId('espacos')

    const medicacoes = new Collection({
      name: 'medicacoes',
      type: 'base',
      ...regras(),
      fields: [
        ...comuns(espacos.id),
        { name: 'nome', type: 'text', required: true, min: 2, max: 80 },
        { name: 'dose', type: 'text', required: true, min: 1, max: 80 },
        { name: 'tipo', type: 'select', required: true, maxSelect: 1, values: ['fixo', 'sos'] },
        { name: 'horarios', type: 'json', required: false, maxSize: 2000 }, // ["08:00","20:00"]
        { name: 'intervalo_min_horas', type: 'number', required: false, min: 0, max: 72 },
        { name: 'inicio', type: 'text', required: true, pattern: DIA },
        { name: 'fim', type: 'text', required: false, pattern: '^$|' + DIA },
        { name: 'observacao', type: 'text', required: false, max: 1000 },
        { name: 'ativo', type: 'bool' },
      ],
      indexes: ['CREATE INDEX idx_medicacoes_espaco ON medicacoes (espaco)'],
    })
    app.save(medicacoes)

    const doses = new Collection({
      name: 'medicacao_doses',
      type: 'base',
      // A dose em si não muda de remédio nem de horário depois de registrada
      ...regras(` && ${naoMuda('medicacao')} && ${naoMuda('previsto')}`),
      fields: [
        ...comuns(espacos.id),
        {
          name: 'medicacao',
          type: 'relation',
          required: true,
          collectionId: medicacoes.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        // "AAAA-MM-DDTHH:MM" (horário de Brasília) para doses de horário fixo; vazio no "se necessário"
        { name: 'previsto', type: 'text', required: false, pattern: '^$|^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$' },
        { name: 'dada_em', type: 'text', required: true }, // ISO UTC
        { name: 'status', type: 'select', required: true, maxSelect: 1, values: ['dada', 'pulada'] },
        { name: 'observacao', type: 'text', required: false, max: 500 },
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_dose_unica ON medicacao_doses (medicacao, previsto) WHERE previsto != ''",
        'CREATE INDEX idx_doses_espaco_dada ON medicacao_doses (espaco, dada_em)',
      ],
    })
    app.save(doses)

    // A regra de envio só deixa a dose ser registrada para remédio do mesmo bebê
    doses.createRule += ' && medicacao.espaco = espaco'
    app.save(doses)

    // Correção: o índice único antigo de membros usava o campo legado "espaco" (sempre vazio
    // hoje), então a mesma pessoa não conseguia participar de um segundo bebê. Passa a valer
    // por (espaco_rel, usuario).
    const membros = app.findCollectionByNameOrId('membros')
    membros.indexes = membros.indexes
      .filter((i) => i.indexOf('idx_membros_espaco_usuario') === -1)
      .concat(['CREATE UNIQUE INDEX idx_membros_espaco_rel_usuario ON membros (espaco_rel, usuario)'])
    app.save(membros)

    const insc = app.findCollectionByNameOrId('push_inscricoes')
    if (!insc.fields.getByName('remedios')) {
      insc.fields.add(new BoolField({ name: 'remedios' }))
      app.save(insc)
    }
    for (const r of app.findAllRecords('push_inscricoes')) {
      r.set('remedios', true)
      app.save(r)
    }
  },
  (app) => {
    for (const nome of ['medicacao_doses', 'medicacoes']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {
        /* já não existe */
      }
    }
    const insc = app.findCollectionByNameOrId('push_inscricoes')
    const f = insc.fields.getByName('remedios')
    if (f) {
      insc.fields.removeById(f.id)
      app.save(insc)
    }
  },
)
