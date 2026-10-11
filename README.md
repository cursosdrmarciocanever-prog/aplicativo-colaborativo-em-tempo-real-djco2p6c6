# Diário da Sarah — PWA Colaborativo em Tempo Real (Fase 1)

O **Diário da Sarah** é um aplicativo mobile-first, colaborativo e em tempo real construído para a família de uma recém-nascida. O app une a rotina diária (mamadas a cada 3 horas, fraldas, metas diárias) com um diário de saúde e memórias familiares.

Todo o texto da interface está em português do Brasil (pt-BR), com tom acolhedor e afetuoso, sem termos técnicos frios.

---

## 🚀 Tecnologias e Arquitetura

- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui + React Router DOM
- **Backend:** PocketBase v0.36 (Skip Cloud)
- **Tempo Real:** SSE (Server-Sent Events) via `useRealtime` assinado nas coleções `eventos`, `membros` e `convites`
- **Offline-First:** Armazenamento local em IndexedDB com idempotência via ID gerado no cliente e fila de sincronização automática com feedback visual discreto
- **Fuso Horário:** Datas e horários armazenados estritamente em UTC e convertidos/exibidos em `America/Sao_Paulo` via funções puras

---

## 🔑 Contas de Demonstração (Seed)

Para testes imediatos na Fase 1, o banco de dados já possui o bebê Sarah cadastrado e dois usuários administradores (pais):

| Nome | E-mail | Senha de Teste | Papel |
|---|---|---|---|
| **Edineia** (Mãe) | `edineia@exemplo.com` | `Skip@Pass123` | Owner (Administrador total) |
| **Marcio** (Pai) | `marcio@exemplo.com` | `Skip@Pass123` | Owner (Administrador total) |
| **Marcio Canever** (Dev) | `marciocanever@hotmail.com` | `Skip@Pass123` | Owner (Administrador total) |

Na tela inicial (`/`), há botões de **Acesso Rápido** com um clique para entrar diretamente como Edineia ou Marcio, além do fluxo de link mágico.

---

## 📋 Escopo Entregue na Fase 1

1. **Autenticação sem Senha:**
   - Login por link mágico via e-mail com fluxo nativo do PocketBase (`requestPasswordReset`/verificação).
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

## 🧪 Regras de Negócio e Testes Unitários

As regras de negócio foram implementadas como funções puras em `src/lib/regras/` e testadas em `src/lib/regras/regras.test.ts`:
- **Próxima Mamada:** Contada estritamente do início da última mamada ao início da próxima (`inicio_em + intervaloMinutos`), ordenando por `inicio_em`.
- **Dia de Vida:** Dia do nascimento = Dia 1. Sarah nascida em 09/10/2026 faz do dia 10/10/2026 o Dia 2 de vida.
- **Tabela de Fraldas por Dia de Vida:**
  - Dia 1: 1 xixi / mecônio
  - Dia 2: 2 xixi / mecônio
  - Dia 3: 3 xixi / em transição
  - Dia 4: 4 xixi / amareladas
  - Dia 5+: 6 ou mais xixi / amareladas 3+
- **Fuso Horário:** Conversões puras entre UTC e `America/Sao_Paulo`.

---

## 🛠️ Como Rodar o Projeto

```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Executar lint estático
npm run lint

# Gerar build de produção
npm run build
```
