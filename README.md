# nassauTickets

Sistema de Controle de Atendimento e Gestão de Filas desenvolvido para um Laboratório de Análises Clínicas, contemplando emissão de senhas via totem, painel de chamadas com síntese de voz, terminal de atendimento e relatórios gerenciais e de auditoria.

## Objetivo

Consolidar práticas de engenharia de software, controle de versão com Git/GitHub, documentação técnica e desenvolvimento Web Full Stack aplicando regras de priorização, máquina de estados, concorrência e conformidade com LGPD e acessibilidade.

## Tecnologias Utilizadas

- **Frontend:** React 19, Vite, TypeScript / JavaScript, CSS3 / Tailwind CSS e Web Speech API (áudio das chamadas)
- **Backend:** Node.js LTS 22 com Express
- **Banco de Dados:** MySQL 8.0
- **Versionamento:** Git e GitHub (fluxo `dev` -> `main`)

### Justificativa Técnica da Stack
A stack **Node.js 22 (Express) + React 19 + MySQL 8.0** foi escolhida pela unificação da linguagem JavaScript/TypeScript entre cliente e servidor, facilidade de manipulação de APIs REST em formato JSON e suporte robusto do MySQL 8.0 a transações ACID com bloqueio de linha (`SELECT ... FOR UPDATE`), essencial para evitar condições de corrida quando múltiplos atendentes chamam a próxima senha simultaneamente.

## Arquitetura e Visão Geral

O sistema opera com três agentes principais:
- **AC (Agente Cliente):** Interage anonimamente no totem para emissão de senhas (`SP`, `SE`, `SG`).
- **AA (Agente Atendente):** Autentica-se no sistema para chamar, rechamar, iniciar e encerrar atendimentos nos guichês. Inclui perfil **Gestor** para cadastros e relatórios.
- **AS (Agente Sistema):** Gerencia regras de priorização (`[SP] -> [SE|SG] -> [SP] -> [SE|SG]`), numeração diária (`YYMMDD-PPSQ`), painel das 5 últimas senhas e auditoria.

### Estrutura do Repositório

```text
nassauTickets/
├── backend/          # API REST em Node.js + Express e scripts SQL
├── docs/             # Documentação técnica do projeto
│   ├── branding/     # Identidade visual
│   ├── mer/          # Modelo Entidade-Relacionamento
│   ├── mockups/      # Protótipos de telas
│   ├── models/uml/   # Diagramas UML
│   └── requirements/ # Requisitos funcionais, não funcionais e regras de negócio
├── frontend/         # Aplicação Web em React
├── .gitignore
├── LICENSE
└── README.md