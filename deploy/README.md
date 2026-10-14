# Deploy do Diário da Sarah na VPS

Mesmo modelo do CRM: PocketBase próprio em Docker, atrás do Traefik, em **origem única**
(`https://diario.clinicacanever.com.br`). Sem Skip.

- VPS: `ssh root@2.24.107.183`
- Traefik já é dono do 80/443 (rede externa `n8n_default`, certificados Let's Encrypt).
- O banco nasce limpo: as migrations recriam o schema, a Sarah, a mamada de 10/10 09:00 e
  `marciocanever@hotmail.com` como owner.

---

## 1. DNS (1 registro)

No painel DNS de `clinicacanever.com.br`:

| Tipo | Nome   | Valor          |
|------|--------|----------------|
| A    | diario | `2.24.107.183` |

Confira: `dig +short diario.clinicacanever.com.br` deve responder `2.24.107.183`.

## 2. Senha de app do Gmail (para o envio dos códigos de login)

1. Entre em https://myaccount.google.com com o Gmail que vai enviar os e-mails.
2. Segurança → **Verificação em duas etapas** (precisa estar ligada).
3. Procure **Senhas de app** → crie uma chamada "Diário da Sarah" → copie os 16 caracteres.

## 3. Clonar e configurar

```bash
mkdir -p /docker/apps && cd /docker/apps
git clone https://github.com/cursosdrmarciocanever-prog/aplicativo-colaborativo-em-tempo-real-djco2p6c6.git diario
cd diario/deploy
cp .env.example .env
nano .env
```

No `.env`, preencha:
- `CERT_RESOLVER`: o mesmo do CRM (`grep -i certresolver /docker/apps/crm/deploy/.env`).
- `SMTP_USER` e `MAIL_FROM_ADDRESS`: o Gmail do passo 2.
- `SMTP_PASSWORD`: a senha de app (16 caracteres, sem espaços).

## 4. Subir

```bash
cd /docker/apps/diario
./atualizar.sh
```

O script faz o build, sobe, espera a API responder e mostra se o SMTP ficou ligado.

## 5. Criar o administrador do banco (uma vez, logo em seguida)

```bash
cd /docker/apps/diario/deploy
docker compose exec pocketbase /pb/pocketbase superuser upsert SEU_EMAIL UMA_SENHA_FORTE
```

Painel do banco: `https://diario.clinicacanever.com.br/_/`. Lá, em Settings → Mail settings →
**Send test email**, dá para conferir o envio.

> Faça este passo logo após subir: até existir um superusuário, o PocketBase mostra no log
> um link de instalação do painel.

## 6. Entrar e convidar a família

1. Abra `https://diario.clinicacanever.com.br`, digite `marciocanever@hotmail.com` e receba o código.
2. Menu → **Pessoas** → convite com papel **Pai ou mãe (owner)** para a Edineia e o Marcio.

---

## Atualizações

```bash
cd /docker/apps/diario && ./atualizar.sh
```

Os dados ficam no volume `pb_data` e sobrevivem a rebuilds.

## Backup

```bash
cd /docker/apps/diario/deploy
docker compose cp pocketbase:/pb/pb_data ./pb_data_backup_$(date +%F)
```

## Importante

- **Não use mais o botão "Sincronizar" da Skip**: ele sobrescreve o `main` do GitHub com a
  versão da Skip.
- Problemas comuns: certificado com aviso = `CERT_RESOLVER` errado ou DNS ainda propagando;
  código não chega = confira a senha de app e o log (`docker compose logs pocketbase | grep -i smtp`).

## Notificações no celular (Web Push)

O serviço `notificador` (deploy/Dockerfile.notificador) sobe junto e não precisa de
configuração: na primeira subida ele gera as chaves VAPID e o PocketBase cria o login
interno dele, ambos guardados no volume `push_chaves`.

- Conferir: `docker compose -p diario logs --tail 20 notificador` (deve mostrar `pronto; ciclo`).
- Cada pessoa ativa em **Ajustes → Notificações neste celular**. No iPhone, só com o app
  instalado na Tela de Início (iOS 16.4+).
- Não apague o volume `push_chaves`: trocar as chaves invalida as inscrições e todos
  precisariam ativar de novo.
