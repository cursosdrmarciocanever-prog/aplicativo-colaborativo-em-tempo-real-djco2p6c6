// pocketbase/hooks/espacos.js
// Quem cria o bebê vira owner. Membros não podem ser criados pelo cliente.

onRecordCreateRequest((e) => {
  e.next()

  const membro = new Record($app.findCollectionByNameOrId('membros'))
  membro.set('espaco_rel', e.record.id)
  membro.set('usuario', e.record.getString('criador'))
  membro.set('papel', 'owner')
  $app.save(membro)
}, 'espacos')

// Auditoria de remoções de pessoas (inclui quem sai por conta própria).
onRecordDeleteRequest((e) => {
  const espacoId = e.record.getString('espaco_rel')
  const removidoId = e.record.getString('usuario')
  e.next()

  if (!espacoId || !e.auth) return
  let nome = removidoId
  try {
    const removido = $app.findRecordById('users', removidoId)
    nome = removido.getString('name') || removido.email()
  } catch (_) {}

  const audit = new Record($app.findCollectionByNameOrId('auditoria'))
  audit.set('espaco', espacoId)
  audit.set('acao', removidoId === e.auth.id ? 'membro_saiu' : 'membro_removido')
  audit.set('usuario', e.auth.id)
  audit.set('usuario_nome', e.auth.getString('name') || e.auth.email())
  audit.set('detalhe', nome + ' deixou de ter acesso')
  $app.save(audit)
}, 'membros')
