// Fase 2 (rotina): mamadeira e ordenha em mL, fim da mamada (cronômetro) e cor do cocô.
// As regras de acesso de eventos (0006) continuam valendo para os novos tipos.

migrate(
  (app) => {
    const eventos = app.findCollectionByNameOrId('eventos')

    const tipo = eventos.fields.getByName('tipo')
    for (const novo of ['mamadeira', 'ordenha']) {
      if (tipo.values.indexOf(novo) === -1) tipo.values.push(novo)
    }

    if (!eventos.fields.getByName('fim_em')) {
      eventos.fields.add(new TextField({ name: 'fim_em', required: false })) // ISO UTC
    }
    if (!eventos.fields.getByName('ml')) {
      eventos.fields.add(new NumberField({ name: 'ml', required: false, min: 0, max: 1000 }))
    }
    if (!eventos.fields.getByName('conteudo')) {
      eventos.fields.add(
        new SelectField({
          name: 'conteudo',
          required: false,
          maxSelect: 1,
          values: ['leite_materno', 'formula'],
        }),
      )
    }
    if (!eventos.fields.getByName('coco_cor')) {
      eventos.fields.add(
        new SelectField({
          name: 'coco_cor',
          required: false,
          maxSelect: 1,
          values: ['meconio', 'verde', 'amarelo', 'marrom', 'clara', 'sangue'],
        }),
      )
    }

    app.save(eventos)
  },
  (app) => {
    const eventos = app.findCollectionByNameOrId('eventos')
    for (const nome of ['fim_em', 'ml', 'conteudo', 'coco_cor']) {
      const f = eventos.fields.getByName(nome)
      if (f) eventos.fields.removeById(f.id)
    }
    app.save(eventos)
  },
)
