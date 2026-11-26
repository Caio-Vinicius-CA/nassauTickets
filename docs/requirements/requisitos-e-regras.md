# Especificação de Requisitos e Regras de Negócio — nassauTickets

## 1. Agentes do Sistema
- **AC (Agente Cliente):** Interage anonimamente com o totem para retirada de senhas e acompanha o painel de chamadas.
- **AA (Agente Atendente):** Autentica-se no terminal para chamar, rechamar, iniciar e encerrar atendimentos. Um único AA possui perfil adicional de **Gestor** (cadastros e relatórios).
- **AS (Agente Sistema):** Gerencia filas, prioridades, numeração, painel das últimas 5 chamadas, áudio e auditoria.

## 2. Requisitos Funcionais (RF)

| ID | Requisito | Descrição |
| :--- | :--- | :--- |
| **RF01** | Emissão de Senha (Totem) | Permitir ao AC emitir senhas dos tipos `SP` (Prioritária), `SE` (Retirada de Exames) e `SG` (Geral) sem necessidade de cadastro ou identificação. |
| **RF02** | Numeração Padrão | Gerar código único no formato `YYMMDD-PPSQ` com sequência `SQ` de 3 dígitos por tipo e reinício diário. |
| **RF03** | Autenticação de Perfil | Permitir login para Atendentes (`AA`) e acesso administrativo exclusivo ao perfil `GESTOR`. |
| **RF04** | Chamada de Próxima Senha | Permitir ao AA acionar a chamada da próxima senha respeitando a ordem de priorização e vinculando-a ao seu guichê. |
| **RF05** | Rechamar Senha | Permitir ao AA acionar "Chamar Novamente", repetindo o aviso sonoro precedido de "Última chamada" e registrando o horário. |
| **RF06** | Ciclo de Atendimento | Permitir ao AA iniciar o atendimento (`EM_ATENDIMENTO`) e finalizá-lo (`ATENDIDA`), ou marcar como abandono (`NÃO_COMPARECEU`) após duas chamadas sem comparecimento. |
| **RF07** | Painel de Chamadas | Exibir em tempo real as 5 últimas senhas chamadas, guichê de destino e status ("Última chamada"), sem exibir a próxima senha da fila. |
| **RF08** | Síntese de Áudio | Emitir aviso sonoro automático no painel informando prioridade, código da senha e número do guichê a cada chamada. |
| **RF09** | Relatórios Gerenciais | Gerar relatórios diários e mensais (emitidas/atendidas geral e por prioridade, tempo médio de atendimento, detalhado e auditoria completa) para o perfil Gestor. |
| **RF10** | Cadastros Administrativos | Permitir ao Gestor gerenciar atendentes e guichês de atendimento. |

## 3. Regras de Negócio (RN)

- **RN01 (Priorização):** O fluxo de chamadas segue rigorosamente o ciclo `[SP] -> [SE|SG] -> [SP] -> [SE|SG]`. Havendo senhas disponíveis, chama-se uma `SP`, depois uma `SE` (prioridade operacional especial) e, na ausência desta ou na sequência, uma `SG`. Se alguma fila estiver vazia, o sistema avança para a próxima fila disponível respeitando a hierarquia `SP > SE > SG`.
- **RN02 (Guichês Universais):** Não há guichês exclusivos por tipo de senha; qualquer guichê atende `SP`, `SE` ou `SG`.
- **RN03 (Expediente e Descarte):** O expediente ocorre das **07h00 às 17h00**. Atendimentos já iniciados até as 17h00 devem ser concluídos pelo AA; senhas remanescentes na fila após o encerramento são descartadas.
- **RN04 (Abandono):** Após duas chamadas (`CHAMADA` e `CHAMADA_NOVAMENTE`) sem comparecimento do AC ao guichê, a senha recebe o status `NÃO_COMPARECEU` e o sistema libera o atendimento para a próxima senha da fila (estimativa histórica de ~5% de abstenção).
- **RN05 (Sigilo da Próxima Senha):** O painel nunca exibe a próxima senha antes da ação do AA, pois uma emissão tardia de `SP` pode alterar a ordem da fila.
- **RN06 (Tempos Médios de Referência):** `SP` possui TM de referência de 15 min (±5 min); `SE` possui TM de 1 min (95% dos casos) a 5 min (5% dos casos); `SG` possui TM de 5 min (±3 min).

## 4. Requisitos Não Funcionais (RNF)

- **RNF01 (Concorrência):** O backend deve utilizar transações ACID com bloqueio exclusivo de linha (`SELECT ... FOR UPDATE` no MySQL 8.0) para impedir que dois atendentes capturem a mesma senha simultaneamente.
- **RNF02 (Disponibilidade e Recuperação de Desastres):** Em caso de queda da API ou do banco de dados, o frontend e o painel devem exibir alerta visual claro de indisponibilidade temporária, manter em cache local (`localStorage`) as últimas 5 senhas exibidas e retentar a reconexão automaticamente (*polling* resiliente) sem travar a interface.
- **RNF03 (Segurança e Auditoria):** Senhas de usuários armazenadas com hash criptográfico (`bcrypt`), autenticação via token JWT e registro imutável de auditoria (atendente, guichê, senha, 1ª chamada, 2ª chamada, início e fim).
- **RNF04 (LGPD):** Minimização de dados pessoais (Lei nº 13.709/2018): o Agente Cliente utiliza o totem de forma 100% anônima, sem coleta de nome, CPF ou dados clínicos na emissão de senhas.
- **RNF05 (Acessibilidade):** Conformidade com diretrizes WCAG 2.1 AA e Lei Brasileira de Inclusão (Lei nº 13.146/2015), oferecendo alto contraste visual, tipografia ampliada no painel e totem, atributos ARIA para leitores de tela e redundância audiovisual (texto + síntese de voz).
- **RNF06 (Desempenho):** Tempo de resposta inferior a 500 ms para emissão e chamada de senhas em rede local.
