// Fase 3 (saúde): vacinas aplicadas, consultas com medidas e dúvidas para a pediatra.
// Mesmas regras de 0006: só membros leem; owner/editor escrevem; ninguém troca o bebê
// nem o autor; apagar é de quem registrou ou do owner.

const membro = (campo) =>
  `@collection.membros.espaco_rel ?= ${campo} && @collection.membros.usuario ?= @request.auth.id`
const escritor = (campo) =>
  `${membro(campo)} && (@collection.membros.papel ?= 'owner' || @collection.membros.papel ?= 'editor')`
const logado = "@request.auth.id != ''"
const naoMuda = (campo) =>
  `(@request.body.${campo}:isset = false || @request.body.${campo} = ${campo})`

function regras() {
  return {
    listRule: `${logado} && ${membro('espaco')}`,
    viewRule: `${logado} && ${membro('espaco')}`,
    createRule: `${logado} && ${escritor('espaco')} && criador = @request.auth.id`,
    updateRule: `${logado} && ${escritor('espaco')} && ${naoMuda('espaco')} && ${naoMuda('criador')}`,
    deleteRule: `${logado} && ${escritor('espaco')} && (criador = @request.auth.id || @collection.membros.papel ?= 'owner')`,
  }
}

function camposComuns(espacosId) {
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

const DIA = '^\\d{4}-\\d{2}-\\d{2}$' // YYYY-MM-DD (data do calendário, sem fuso)

migrate(
  (app) => {
    const espacos = app.findCollectionByNameOrId('espacos')

    const vacinas = new Collection({
      name: 'vacinas',
      type: 'base',
      ...regras(),
      fields: [
        ...camposComuns(espacos.id),
        // Dose do calendário (ex.: "penta-1") ou "extra-<id>" para vacina fora do calendário
        { name: 'dose_id', type: 'text', required: true, min: 2, max: 60 },
        { name: 'nome', type: 'text', required: false, max: 100 }, // vacina extra
        { name: 'aplicada_em', type: 'text', required: true, pattern: DIA },
        { name: 'lote', type: 'text', required: false, max: 60 },
        { name: 'local', type: 'text', required: false, max: 120 },
        { name: 'observacao', type: 'text', required: false, max: 1000 },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_vacinas_espaco_dose ON vacinas (espaco, dose_id)'],
    })
    app.save(vacinas)

    const consultas = new Collection({
      name: 'consultas',
      type: 'base',
      ...regras(),
      fields: [
        ...camposComuns(espacos.id),
        { name: 'data', type: 'text', required: true, pattern: DIA },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['rotina', 'retorno', 'urgencia', 'especialista'],
        },
        { name: 'profissional', type: 'text', required: false, max: 120 },
        { name: 'peso_g', type: 'number', required: false, min: 500, max: 30000 },
        { name: 'comprimento_cm', type: 'number', required: false, min: 30, max: 130 },
        { name: 'perimetro_cefalico_cm', type: 'number', required: false, min: 20, max: 60 },
        { name: 'orientacoes', type: 'text', required: false, max: 4000 },
        { name: 'proxima_consulta', type: 'text', required: false, pattern: '^$|' + DIA },
      ],
      indexes: ['CREATE INDEX idx_consultas_espaco_data ON consultas (espaco, data)'],
    })
    app.save(consultas)

    const duvidas = new Collection({
      name: 'duvidas',
      type: 'base',
      ...regras(),
      fields: [
        ...camposComuns(espacos.id),
        { name: 'texto', type: 'text', required: true, min: 2, max: 500 },
        { name: 'resposta', type: 'text', required: false, max: 2000 },
        { name: 'respondida_em', type: 'text', required: false }, // ISO UTC
      ],
      indexes: ['CREATE INDEX idx_duvidas_espaco ON duvidas (espaco)'],
    })
    app.save(duvidas)
  },
  (app) => {
    for (const nome of ['duvidas', 'consultas', 'vacinas']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {
        /* já não existe */
      }
    }
  },
)
