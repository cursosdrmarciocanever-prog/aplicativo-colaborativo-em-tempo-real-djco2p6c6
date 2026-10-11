// Entrada de emergência para o owner enquanto o envio de e-mail (SMTP) não funciona.
// Só a impressão digital (SHA-256) do código fica aqui; o código foi entregue ao owner fora do repositório.
// Uso único, vale 72 h a partir desta migração, só para o e-mail abaixo,
// e para de funcionar sozinha quando o SMTP for ligado.

migrate(
  (app) => {
    const col = new Collection({
      name: 'acessos_emergencia',
      type: 'base',
      // somente superusuário
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'email', type: 'email', required: true },
        { name: 'segredo_hash', type: 'text', required: true },
        { name: 'expira_em', type: 'date', required: true },
        { name: 'usado_em', type: 'date', required: false },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_acessos_emergencia_hash ON acessos_emergencia (segredo_hash)',
      ],
    })
    app.save(col)

    const r = new Record(col)
    r.set('email', 'marciocanever@hotmail.com')
    r.set('segredo_hash', '65a12d745793a2ea6cf3de3f055000c0798185c4f8c510cf604b836a43be8099')
    r.set('expira_em', new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString())
    app.save(r)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('acessos_emergencia'))
    } catch (_) {}
  },
)
