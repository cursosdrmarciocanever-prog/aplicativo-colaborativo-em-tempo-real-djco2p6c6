// pocketbase/hooks/configuracao.js
// Na subida do servidor, aplica nome do app, endereço público e envio de e-mail (SMTP)
// a partir das variáveis de ambiente do deploy (deploy/.env). Sem SMTP o login por código
// não funciona, então ele é configurado aqui e não à mão no painel.
//
// Variáveis: APP_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_TLS,
//            MAIL_FROM_ADDRESS, MAIL_FROM_NAME. Variável vazia = mantém o que já está salvo.

onBootstrap((e) => {
  e.next()

  const env = (nome) => ($os.getenv(nome) || '').trim()
  const settings = e.app.settings()

  settings.meta.appName = env('MAIL_FROM_NAME') || 'Diário da Sarah'
  if (env('APP_URL')) settings.meta.appURL = env('APP_URL')
  if (env('MAIL_FROM_ADDRESS')) settings.meta.senderAddress = env('MAIL_FROM_ADDRESS')
  settings.meta.senderName = env('MAIL_FROM_NAME') || 'Diário da Sarah'

  if (env('SMTP_HOST')) {
    settings.smtp.enabled = true
    settings.smtp.host = env('SMTP_HOST')
    settings.smtp.port = parseInt(env('SMTP_PORT') || '587', 10)
    settings.smtp.username = env('SMTP_USER')
    settings.smtp.password = env('SMTP_PASSWORD')
    // porta 465 usa TLS direto; 587 usa STARTTLS (tls = false)
    settings.smtp.tls = env('SMTP_TLS') ? env('SMTP_TLS') === 'true' : settings.smtp.port === 465
  }

  e.app.save(settings)
  console.log(
    '[configuracao] SMTP ' +
      (settings.smtp.enabled ? 'ligado em ' + settings.smtp.host : 'desligado'),
  )
})
