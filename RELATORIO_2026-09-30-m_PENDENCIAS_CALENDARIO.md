# Relatório 2026-09-30-m — Pendências do Calendário B7

Pacote: `atualizacao-2026-09-30-m.zip` (inclui l, k, j, i, h e g).

## 1. Painel na mesma regra do Calendário
**Divergência encontrada:** o Painel contava gravações pela view `agenda_compromissos`, que representa gravações ligadas ao Google pela data do *evento do Google*; o Calendário usa a *ocorrência* do B7. Se a sincronização de uma remarcação falhasse, os dois mostravam dias diferentes.

**Agora:**
- `gravacoesDaJanela()` (usada pelos Painéis de vídeo, coordenação e multifunção) lê pelo **mesmo adaptador de gravação do Calendário** (`B7.Eventos.carregarDominio('gravacao', …)`): só a data atual de cada gravação, não cancelada nem concluída. Da agenda do Google entram só os eventos **ainda sem gravação vinculada** (esses não têm ocorrência) — sem duplicar e sem data antiga.
- As funções de data do Painel (dia local, somar dias, dia/hora de um instante) agora **são** as do `B7.Eventos.DATAS` — uma regra só.
- A consulta de publicações do Painel da coordenação **é** a do Calendário (`painelCoordConteudos` → `publicacoesCalendario`).
- Continua específico do Painel (e deve continuar): atrasadas, correção, stand-by, "vence hoje" — regras pessoais de cada domínio. O Painel segue resumo; Mês/Semana/Dia só no Calendário.
- Nova função `B7.Eventos.carregarDominio(dom, ini, fim)` (mesmo cache e normalização do Calendário).

## 2. Tempo real no Calendário
- Migration `calendario_b7_realtime` (arquivo `migration_calendario_b7_realtime.sql`, já aplicada): publica no Realtime `gravacoes_ocorrencias`, `conteudos`, `demandas_edicao`, `design_deliverables`. O Realtime respeita o RLS.
- O Calendário abre **um canal só** por abertura, nas tabelas dos domínios que a pessoa vê, e fecha ao sair da tela.
- Só recarrega quando a mudança altera o que está na tela (data, status, título, cliente, responsável, ou linha entrando/saindo da janela). Autosave de outros campos (legenda, briefing) é ignorado. Rajadas viram uma recarga (1,2 s). Aba escondida espera voltar. O banco continua sendo a autoridade.

## 3. Não dependem de código
- **Design sem prazo:** nenhuma peça tem prazo preenchido no banco; o domínio já está ligado e aparece assim que alguém definir prazo nas peças (tela de Design).
- **Aprovações:** continuam fora — não há prazo canônico de aprovação.
- **Validação com login real** depois de publicar.

## Arquivos
`js/eventos.js`, `js/painel.js`, `js/calendario.js`, `js/database.js`, `sw.js` (`roteiros-b7-v111`), `migration_calendario_b7_realtime.sql`.

## Tests (executados)
- Tempo real (harness): um canal nas 4 tabelas; autosave de legenda não recarrega; mudança fora da janela não recarrega; data de postagem alterada → 1 recarga e o evento muda de 08/10 para 14/10 ao vivo; rajada de 5 mudanças → 1 recarga; sem erros.
- Calendário: as 48 checagens anteriores continuam OK.
- Painel (harnesses atualizados para ler pelo `B7.Eventos`): multifunção (KPIs, dia, dedup, falha de Design), coordenação (interação, cargas), papéis — gravações e evento Google sem vínculo aparecem, sem duplicar.
- `node --check` em todos os JS.
- Não testado: Realtime real do Supabase no app publicado (o sandbox não alcança a API).

## Pendências
1. Validar com login real (inclusive o ao vivo: remarcar numa aba e ver a outra mudar).
2. Prazos de Design dependem de preenchimento.
