migrate(
  (app) => {
    // 1. Atualizar regras de acesso da coleção espacos
    // As regras anteriores usavam @collection.membros.espaco ?= id, mas 'espaco' em membros aponta para a tabela legada 'spaces',
    // enquanto 'espaco_rel' aponta para 'espacos'. Permitir acesso quando o usuário é criador OU é membro via espaco_rel ou espaco.
    const espacosCol = app.findCollectionByNameOrId('espacos')

    const ruleRead =
      "@request.auth.id != '' && (criador = @request.auth.id || (@collection.membros.espaco_rel ?= id && @collection.membros.usuario ?= @request.auth.id) || (@collection.membros.espaco ?= id && @collection.membros.usuario ?= @request.auth.id))"

    const ruleWrite =
      "@request.auth.id != '' && (criador = @request.auth.id || ((@collection.membros.espaco_rel ?= id || @collection.membros.espaco ?= id) && @collection.membros.usuario ?= @request.auth.id && @collection.membros.papel ?= 'owner'))"

    espacosCol.listRule = ruleRead
    espacosCol.viewRule = ruleRead
    espacosCol.createRule = "@request.auth.id != ''"
    espacosCol.updateRule = ruleWrite
    espacosCol.deleteRule = ruleWrite

    app.save(espacosCol)

    // 2. Garantir que as regras de eventos também sejam explícitas e seguras
    const eventosCol = app.findCollectionByNameOrId('eventos')
    eventosCol.listRule = "@request.auth.id != ''"
    eventosCol.viewRule = "@request.auth.id != ''"
    eventosCol.createRule = "@request.auth.id != ''"
    eventosCol.updateRule = "@request.auth.id != ''"
    eventosCol.deleteRule = "@request.auth.id != ''"
    app.save(eventosCol)
  },
  (app) => {
    // Reverter regras se necessário
    try {
      const espacosCol = app.findCollectionByNameOrId('espacos')
      espacosCol.listRule = "@request.auth.id != ''"
      espacosCol.viewRule = "@request.auth.id != ''"
      app.save(espacosCol)
    } catch (_) {}
  },
)
