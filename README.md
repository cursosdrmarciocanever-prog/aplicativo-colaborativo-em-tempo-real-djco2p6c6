# Diário da Sarah — PWA Colaborativo em Tempo Real (Fase 1)

O **Diário da Sarah** é um aplicativo mobile-first, colaborativo e em tempo real construído para a família de uma recém-nascida. O app une a rotina diária (mamadas a cada 3 horas, fraldas, metas diárias) com um diário de saúde e memórias familiares.

Todo o texto da interface está em português do Brasil (pt-BR), com tom acolhedor e afetuoso, sem termos técnicos frios.

---

## 🚀 Tecnologias e Arquitetura

- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui + React Router DOM
- **Backend:** PocketBase 0.36, self-hosted na VPS (Docker + Traefik). Veja `deploy/README.md`.
- **Tempo Real:** SSE (Server-Sent Events) via `useRealtime` assinado nas coleções `eventos`, `membros` e `convites`
- **Offline-First:** Armazenamento local em IndexedDB com idempotência via ID gerado no cliente e fila de sincronização automática com feedback visual discreto
- **Fuso Horário:** Datas e horários armazenados estritamente em UTC e convertidos/exibidos em `America/Sao_Paulo` via funções puras

---

## 🔑 Acesso e segurança

**Não existem contas de demonstração nem senhas.** O login é feito por um código de 6 números enviado por e-mail (OTP do PocketBase, válido por 10 minutos). O login por senha está desativado no servidor.

- O bebê Sarah já existe no banco. O único owner semeado é `marciocanever@hotmail.com`, que entra pelo código de e-mail.
- Edineia, Marcio e o restante da família entram por **convite** (tela Pessoas). Os pais recebem o papel "Pai ou mãe (owner)".
- As antigas contas `edineia@exemplo.com` e `marcio@exemplo.com` (senha publicada) foram desativadas pela migração `0006`: senha aleatória, e-mail movido para `*.seed@diario.invalid` e sem acesso à Sarah.

### Quem pode o quê (regras do PocketBase, `pocketbase/migrations/0006_*`)

| | owner | editor | viewer | sem convite |
|---|---|---|---|---|
| Ver o bebê, os registros e as pessoas | ✅ | ✅ | ✅ | ❌ (nada) |
| Registrar mamada e fralda | ✅ | ✅ | ❌ | ❌ |
| Apagar registro (exclusão lógica) | ✅ todos | só os próprios | ❌ | ❌ |
| Convidar, revogar convites, remover pessoas, ver auditoria | ✅ | ❌ | ❌ | ❌ |
| Editar dados do bebê | ✅ | ❌ | ❌ | ❌ |

- Ninguém cria vínculo de membro pela API: quem cria um bebê vira owner (hook `espacos.js`) e convites são aceitos no servidor (`POST /backend/v1/convites/aceitar`).
- O token do convite é gerado no servidor (40 caracteres), vale no máximo 7 dias, é de uso único e pode ficar restrito ao e-mail convidado. Aceitar um convite menor nunca rebaixa quem já é owner.
- Ninguém troca o bebê ou o autor de um registro, nem registra em nome de outra pessoa.
- Cada pessoa só vê o nome e o e-mail de quem divide um bebê com ela.

> O envio de e-mail (SMTP) é configurado pelo `deploy/.env` e aplicado na subida do servidor (hook `configuracao.js`). Sem ele os códigos de acesso não chegam.

---

## 📋 Escopo Entregue na Fase 1

1. **Autenticação sem Senha:**
   - Login por código de uso único enviado por e-mail (OTP do PocketBase); sem senha.
   - Botão "Entrar com Google" visível com marcação informativa "em breve".
   - Nota de transparência: *"Seus dados são privados. Apenas pessoas convidadas pela família veem as informações do bebê."*
   - Proteção de rotas com redirecionamento para `/` quando não autenticado.

2. **Onboarding em 3 Passos:**
   - **Passo 1:** Dados do bebê (Nome "Sarah", nascimento 09/10/2026, hora editável "a confirmar", peso ao nascer em gramas, idade gestacional opcional).
   - **Passo 2:** Intervalo de mamadas (presets de 3h padrão, 2h, 4h e valor customizado em minutos).
   - **Passo 3:** Convidar primeiro membro da família por e-mail ou pular.

3. **Tela Hoje Completa:**
   - **Cartão Próxima Mamada:** Horário grande (última mamada + 180 min), contagem regressiva ("em 1h 12min"), barra de progresso. Quando atrasada, destaque em tom de atenção e texto *"passou há X — acordar e oferecer o peito"*.
   - **Registrar Mamada:** Seleção de lado (Esquerdo, Direito, Ambos), botão grande `Mamou agora` (≥48px) e campo de horário manual no passado (rejeita horários futuros do dia com erro).
   - **Fraldas Hoje:** Contadores de Xixi e Cocô com botões `+ Xixi` e `+ Cocô`. Avaliação automática de metas por dia de vida.
   - **Histórico por Dia:** Agrupado com cabeçalho contendo totais do dia, lado, tempo desde a mamada anterior, "registrado por X" e botão de apagar com **desfazer por 5 segundos**.
   - **Resumo para a Pediatra:** Formato rápido para cópia com botão de copiar:
     ```text
     Sarah, nascida em 09/10/2026. Mamadas e fraldas.
     sábado, 10/10 (dia 2 de vida): 8 mamadas, 6 xixi, 3 cocô
     Mamadas: 09:00 E, 12:05 D, 15:10 E...
     ```

4. **Tela Pessoas & Convites:**
   - Criação de convites com validade de 7 dias e uso único.
   - Opção de restringir o convite ao e-mail informado.
   - Lista de membros da família com remoção (com trava: owner não pode remover outro owner).
   - Lista de convites pendentes com cópia de link e revogação.
   - Endpoint do backend `/backend/v1/convites/aceitar` para aceitar convites atomicamente.

5. **Tela Ajustes:**
   - Edição de dados do bebê (nome, data/hora de nascimento, peso, intervalo).
   - Tema Claro / Escuro / Automático (respeita `prefers-color-scheme`).
   - Termo de transparência LGPD.
   - Registro de auditoria de eventos.

6. **Rotas em Breve:**
   - `/diario`, `/saude`, `/marcos`, `/album` com estados vazios acolhedores e navegação real (sem páginas 404 quebradas).

---

## 🧪 Testes

```bash
./scripts/baixar-pocketbase.sh   # uma vez: baixa o PocketBase 0.36 para .pocketbase/
npm test                         # regras puras + permissões contra um PocketBase real
```

- `src/lib/regras/regras.test.ts`: próxima mamada (início a início, ordenada por `inicio_em`), horário manual (rejeita futuro), metas de fralda por dia de vida, dia de vida no fuso de Brasília (inclusive 23:30 local), idade amigável, idade corrigida, conversões UTC ⇄ local e resumo para a pediatra.
- `src/lib/offline/id.test.ts`: ids gerados no aparelho no formato do PocketBase.
- `tests/backend/permissoes.test.ts`: sobe um PocketBase descartável com as migrações e hooks deste repositório e verifica que estranho não lê nada, viewer não escreve nem forçando a API, editor só apaga o que registrou, convites expirados, usados ou de outro e-mail são recusados, reenvio com o mesmo id não duplica, login por senha desativado etc. Sem o binário, essa suíte é pulada.

## 🔄 Sincronização e modo offline

- Todo registro nasce com id gerado no aparelho (`src/lib/offline/id.ts`). O mesmo id vai em todo reenvio; o servidor recusa o segundo, então nada duplica.
- Sem conexão (ou com falha de rede/servidor), o registro fica na fila do IndexedDB e aparece na tela marcado como pendente. A fila é enviada ao voltar a rede ou o foco do app.
- Recusa definitiva do servidor (ex.: sem permissão) descarta o item da fila para ela não travar.
- Em tempo real (SSE), criação, edição, exclusão lógica e restauração aparecem nos outros aparelhos.

## 📝 Decisões registradas

- **Backend:** PocketBase, agora hospedado na VPS (o projeto nasceu na Skip, que foi abandonada). As "RLS" da seção 8 são as regras de API das coleções, testadas em `tests/backend/`.
- **Login:** código por e-mail (OTP) em vez de link mágico, porque é o fluxo sem senha nativo do PocketBase e funciona igual no app instalado no celular.
- **Desfazer (5 s):** a exclusão só é enviada ao servidor depois dos 5 segundos; desfazer antes disso não gera tráfego.
- **Coleções legadas do template** (`spaces`, `atividades`): fechadas para todos exceto o superusuário.

---

## 🛠️ Como Rodar o Projeto

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Rodar os testes (veja a seção Testes)
npm test

# Executar lint estático
npm run lint

# Gerar build de produção
npm run build
```
