# Arquitetura de Telas e Wireframes — nassauTickets

## 1. Totem de Autoatendimento (`/totem`)
- Cabeçalho com logo do laboratório e relógio/expediente (`07:00 - 17:00`).
- Três botões grandes acessíveis:
  - **[SP] Atendimento Prioritário** (Idosos, gestantes, PCD)
  - **[SE] Retirada de Exames** (Atendimento rápido)
  - **[SG] Atendimento Geral**
- Modal de confirmação exibindo o código gerado (`YYMMDD-PPSQ`) e botão para nova emissão.

## 2. Painel de Chamadas TV (`/painel`)
- **Destaque Principal (Esquerda/Topo):** Senha atual em chamada gigante, tipo de atendimento, guichê e badge piscante **"ÚLTIMA CHAMADA"** quando rechamada.
- **Histórico Lateral (Direita):** Lista exata das **5 últimas senhas chamadas** com horário e guichê.
- **Rodapé:** Indicador discreto de status de conexão com o servidor (Alerta visual caso offline).

## 3. Terminal do Atendente e Gestor (`/atendimento` e `/relatorios`)
- Seleção de guichê ativo ao entrar.
- Controles de fluxo: **Chamar Próxima**, **Chamar Novamente**, **Iniciar Atendimento**, **Finalizar Atendimento** e **Registrar Não Comparecimento**.
- Aba **Relatórios (Exclusiva Gestor):** Filtros por data/mês, cards de indicadores (Total Emitidas, Total Atendidas, TM por prioridade) e tabelas exportáveis de Relatório Detalhado e Auditoria.
