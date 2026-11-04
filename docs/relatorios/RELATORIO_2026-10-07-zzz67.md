# Relatório zzz67 — Videomaker marca, remarca e conclui gravação pelo Calendário (07/10/2026)

**Versão:** `2026-10-07-zzz67` · **Cache:** `roteiros-b7-v272`

## O que aconteceu
Depois da zzz66, Kevin respondeu "não funcionou". Ele não disse qual parte; investiguei assim:
- a versão publicada era a zzz66 (conferido no site);
- nos registros do Supabase, depois que ele entrou na conta do videomaker (14:48 UTC) **não houve nenhuma tentativa de gravar** em funções de vídeo ou de gravação, e nenhum erro. Ou seja: o problema não era o banco recusar — era a tela não oferecer o botão.

A causa mais provável, e que é um furo real da zzz66: liberei marcar/remarcar só na **tela da gravação**. O **Calendário** — onde fica o botão "Marcar gravação" e o "Remarcar, concluir…" de cada gravação — usa outras funções e outra regra de tela, e continuou só da equipe.

Isto é uma dedução a partir dos registros, não uma confirmação do Kevin.

## O que mudou

### Banco — `migration_calendario_videomaker_marca_remarca.sql` (aplicada)
Três funções passam a aceitar equipe ou videomaker (só a trava de entrada):

| Função | Para quê |
|---|---|
| `calendario_marcar_gravacao` | botão "Marcar gravação": cria a gravação já com data |
| `calendario_ocorrencia_remarcar` | remarcar pelo calendário |
| `calendario_ocorrencia_concluir` | "Marcar como Concluída" pelo calendário |

Com isso o videomaker **cria uma gravação nova** pelo Calendário. A criação acontece dentro da função que já existia; nenhuma política de RLS foi alterada.

### Tela — `js/calendario.js`
Para o videomaker (papel ou função extra):
- aparece o botão **Marcar gravação** (no topo, no "+" de cada dia do mês e na agenda do dia);
- ao abrir uma gravação no calendário, aparece **Remarcar, concluir…**, com **Remarcar** e **Marcar como Concluída**.

Continua só de admin/coordenador: **Editar**, **Cancelar gravação** e **Excluir gravação** pelo calendário, vincular evento, e as configurações do Google.

O evento no Google acompanha (a função do servidor já aceitava o papel videomaker desde a zzz66).

## Testes realmente executados
**Banco** (transação desfeita ao final; nada ficou gravado), como videomaker (Kaique):
- marcar gravação nova: funcionou (devolveu gravação e ocorrência);
- remarcar: funcionou; concluir: funcionou (status "concluida");
- cancelar e excluir gravação: barrados;
- como designer, marcar: barrado.

**Tela:** o `calendario.js` novo carregou sem erro de script. Só isso.

## Não testado
- O Calendário renderizado para o videomaker (botões aparecendo, janela "Marcar gravação", remarcar pela folha da gravação). Não consegui montar essa tela no teste local.
- A criação/atualização do evento no Google por um videomaker.
- Se era mesmo esta a parte que "não funcionou" — se for outra, preciso saber qual tela e qual botão.
