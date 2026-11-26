# Modelo Entidade-Relacionamento (MER) — nassauTickets

## Diagrama ER

```mermaid
erDiagram
    USUARIOS {
        int id PK
        varchar nome
        varchar matricula UK
        varchar login UK
        varchar senha_hash
        enum perfil "ATENDENTE | GESTOR"
        boolean ativo
        datetime criado_em
    }

    GUICHES {
        int id PK
        int numero UK
        varchar descricao
        boolean ativo
    }

    SENHAS {
        int id PK
        varchar codigo UK "YYMMDD-PPSQ"
        date data_emissao
        enum tipo "SP | SE | SG"
        int sequencia
        enum status "EMITIDA | AGUARDANDO | CHAMADA | CHAMADA_NOVAMENTE | EM_ATENDIMENTO | ATENDIDA | NAO_COMPARECEU | DESCARTADA"
        int guiche_id FK
        int atendente_id FK
        datetime emitida_em
        datetime primeira_chamada_em
        datetime segunda_chamada_em
        datetime inicio_atendimento_em
        datetime fim_atendimento_em
    }

    AUDITORIA_CHAMADAS {
        int id PK
        int senha_id FK
        int atendente_id FK
        int guiche_id FK
        varchar acao
        varchar status_anterior
        varchar status_novo
        datetime registrado_em
    }

    USUARIOS ||--o{ SENHAS : "atende"
    GUICHES ||--o{ SENHAS : "recebe"
    SENHAS ||--o{ AUDITORIA_CHAMADAS : "gera_historico"
    USUARIOS ||--o{ AUDITORIA_CHAMADAS : "executa"
    GUICHES ||--o{ AUDITORIA_CHAMADAS : "vincula"
```

## Dicionário de Dados Resumido

- **USUARIOS:** Armazena os Agentes Atendentes (`AA`) e o único usuário com perfil `GESTOR`.
- **GUICHES:** Cadastro dos guichês físicos do laboratório, todos aptos a atender qualquer prioridade.
- **SENHAS:** Tabela central das senhas emitidas, contendo o código formatado (`YYMMDD-PPSQ`), a máquina de estados e os timestamps exigidos pelos relatórios detalhado e de auditoria.
- **AUDITORIA_CHAMADAS:** Log cronológico de todas as transições de estado realizadas por atendentes e guichês.
