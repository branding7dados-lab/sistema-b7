# Painel do Videomaker — fase 1
**Data:** 2026-09-29 · **Pacote:** `atualizacao-2026-09-29-a.zip` · **Migration:** nenhuma.

## Painel do Videomaker
Novo espaço pessoal em **`#/painel`**, módulo `B7.Painel` (`js/painel.js` + `styles/painel.css`). Responde "o que *eu* preciso fazer agora" — resume e leva para a tela canônica de cada coisa; não duplica a Produção de Vídeo, o Calendário nem o sino.

**Quem vê:** videomaker pelo papel principal ou pela função extra. **Navegação:** item "Painel" no topo da sidebar, antes da Central (é a casa de quem tem). A logo da sidebar ("ir para o início") leva ao Painel para quem tem, e à Central para os demais.

**Casa padrão** (`B7.Rota.aplicarCasaPadrao`, roda uma vez no arranque):

| Perfil | Abrir o sistema sem rota | Clicar em "Central B7" (`#/`) |
|---|---|---|
| Videomaker | Painel | não existe o item; `#/` redireciona ao Painel |
| Admin + Videomaker | Painel | Central B7 |
| Coordenador + Videomaker | Painel | Central B7 |
| Designer + Videomaker | Painel | Central de Design |
| Admin / Coordenador / Designer só | inalterado | inalterado |

Só vale quando o endereço está **vazio** (abrir o site, o PWA, voltar do login). `#/` explícito e refresh na Central continuam na Central; deep links passam intactos. `replaceState` não dispara `hashchange`, então não há cadeia de redirecionamentos.

## UI/UX
Ordem de leitura: cabeçalho → 4 números → o que pede ação → o contexto → a tendência.
- **Cabeçalho compacto:** "PAINEL · terça, 29 de setembro", saudação com o primeiro nome real, papéis reais ("Administrador · Videomaker"), uma única ação — *Minha fila de edição*. Criar demanda não entrou: é ação de coordenação, não trabalho pessoal.
- **4 KPIs** (reaproveitam o card `.cp-num` da Central).
- **Desktop (>1100px):** "Precisa da sua atenção" à esquerda (onde o olho começa); "Minha semana" e "Próximos compromissos" empilhados à direita, equilibrando a altura; "Minha produção" em largura total embaixo, com o resumo ao lado das barras.
- **Tablet (601–1100px):** uma coluna; a semana mostra as palavras ("2 prazos").
- **Celular (≤600px):** KPIs 2×2, a semana vira lista de linhas com texto inteiro, botão do cabeçalho em largura total, rótulos do gráfico legíveis.
- **Modo escuro e densidade compacta:** só tokens; espaçamentos multiplicados por `--d`.

## Indicadores
Todos são do **videomaker logado** (`videomaker_id = eu`), mesmo sendo admin — o RLS deixaria o Kevin ver 441 demandas; as dele ativas são 5.
- **Atrasadas:** `B7.Video.ehAtrasada` — a MESMA função que a Produção de Vídeo usa (agora exportada): prazo < hoje e situação fora de *entregue*, *descartado* e *aguardando aprovação*. Clique → Produção filtrada (`#/video?prazo=atrasadas&minha=1&comp=todas`). **Verificado: KPI 3 → a lista abre com 3 linhas.**
- **Vencem hoje:** prazo = hoje, mesma exclusão de *aguardando aprovação* (a edição já saiu das mãos do videomaker). Clique → filtro novo `prazo=hoje` na Produção (também ganhou chip no resumo). **Verificado: KPI 2 → 2 linhas.**
- **Em produção:** *pendente* + *em edição* + *correção* — o que está nas mãos da pessoa. Fica de fora *aguardando aprovação* (com o cliente) e *standby* (parado por decisão). Subtítulo detalha: "4 em edição · 2 correções · 5 para iniciar". Clique → fila pessoal.
- **Próximas gravações:** gravações da agenda nos próximos 7 dias, com a próxima no subtítulo. Clique → Calendário.

Divergência pré-existente registrada, não alterada: a Gestão (`video_carga_equipe`, SQL) conta *aguardando aprovação* como atrasada; a tela de Produção não. O Painel segue a Produção, porque é para lá que o KPI leva.

## Precisa da sua atenção
Lista derivada (nenhuma tabela), até 5 itens, cada um abre o registro canônico. Prioridade:
1. atrasadas (até 2; se sobrar vaga, as demais entram logo em seguida);
2. gravação **hoje** — compromisso físico com hora; não pode ficar escondido atrás de atrasadas;
3. correção solicitada; 4. vence hoje; 5. gravação amanhã; 6. standby com `standby_revisar_em` vencido; 7. vence amanhã.

A mesma demanda nunca aparece duas vezes. Etiqueta sempre com ícone + texto (urgência não depende só de cor). "+N demandas na sua fila" conta só demandas, porque é para a fila que o link leva. Vazio: "Tudo em dia por aqui."

## Minha semana
Segunda a sexta da semana corrente (sábado/domingo só se tiverem algo). Por dia: prazos das minhas demandas ativas (mesma exclusão de *aguardando*), gravações da agenda, e — em dias que já passaram — quantas ficaram atrasadas. Dias sem destino útil não são clicáveis; cada dia tem `aria-label` com o resumo completo.

## Minha produção
Barras semanais, **últimas 6 semanas**, contando demandas entregues por semana. Série única, sem legenda: semana atual no acento da marca, as outras neutras; número direto só na semana atual, as demais no tooltip (hover/foco de teclado). Resumo: total, nesta semana, média semanal. Link "Ver entregues" → fila pessoal filtrada em *Entregue*. As barras não filtram por semana, porque a Produção não tem filtro por data de entrega — ficaria um clique enganoso.

**Fonte:** o log `demandas_edicao_eventos` (mudança de status para *entregue*), com a última entrega de cada demanda que continua entregue. **Não** `demandas_edicao.entregue_em`: a importação da planilha carimbou esse campo com a data da importação — 202 "entregas" do Kaique na semana de 14/09. O gráfico ingênuo teria mentido.

## Próximos compromissos
Até 3 itens a partir de agora: gravações da agenda + prazos das minhas demandas, em ordem de data (no mesmo dia, gravação antes do prazo, porque prazo não tem hora). Não repete o que já está em "Precisa da sua atenção". Link "Ver agenda".

## Multi-role
Não existe troca de perfil. O Painel usa `B7.Auth.souVideomakerElegivel()` — já existente, papel **ou** função extra. Admin + Videomaker continua admin em tudo (Usuários, Configurações, Central), só ganha uma tela a mais. Coordenador + Videomaker idem, sem ganhar nada de admin. Testado nos 7 perfis.

Em **"Visualizar como…"**, o Painel mostra o trabalho da pessoa em prévia, em só leitura.

## Design System
Reaproveitado: `.cp-num` (card de número da Central), `.cp-ag-item`/`.cp-ag-data` (linha de agenda da Central), `.esqueleto-tela`/`.esq` (esqueletos), `.b`/`.contorno`, `.conteudo`/`.entra`. Tokens: `--card`, `--suave`, `--borda`, `--borda-forte`, `--ink…ink-4`, `--acento`, `--acento-suave`, `--ok/-bg`, `--ambar/-bg`, `--erro/-bg`, `--elevado`, `--r-sm`, `--r-lg`, `--sh-2`, `--t`, `--t-micro`, `--d`. Ícones SVG lineares no mesmo traço. Nenhuma cor fixa (exceto o fundo branco das logos de cliente, regra do BRAND.md).

## Performance
Três leituras em paralelo, todas escopadas, sem N+1:
- demandas ativas da pessoa (volume pequeno por natureza), só as colunas usadas;
- eventos de entrega das últimas 6 semanas, filtrados pelo videomaker no próprio banco (embed `!inner`, uma chamada);
- gravações da segunda desta semana até +15 dias.

Cada fonte tem teto de 15s e carrega sozinha: o que chega primeiro já aparece. Erro nunca vira "0": o KPI mostra "—", a seção mostra a mensagem e "Tentar de novo", recarregando só aquela fonte.

## Banco / migrations
**Nenhuma.** Tudo lê de fontes existentes: `demandas_edicao_resumo`, `demandas_edicao_eventos` (+ FK para `demandas_edicao`) e a view `agenda_compromissos`, com o RLS atual. Consultas validadas no banco como o Kevin (5 ativas, 3 atrasadas, 9 entregas em 6 semanas).

## Testes executados
- **Papéis (7):** admin+videomaker, admin, videomaker, coordenador+videomaker, coordenador, designer, designer+videomaker — item Painel, item Central, rótulo, `podeRota` de Painel/Central/Usuários/Vídeo e destino da logo.
- **Roteamento (10):** casa padrão sem rota por perfil, `#/` explícito, admin digitando `#/painel` (sem permissão), videomaker em `#/` (um redirecionamento, sem laço), deep link de demanda, link de KPI com filtros.
- **KPI ↔ lista**, com o `video.js` real: Atrasadas 3 → 3 linhas; Vencem hoje 2 → 2 linhas; demandas de outra pessoa e aguardando aprovação fora; query limpa do endereço.
- **Visual:** 1920, 1440, 1280, 1024, 390 e 360 px; escuro (desktop e celular); compacto; vazio; erro parcial (agenda + entregas); carregando. Zero overflow horizontal e zero erro de JS em todos.
- **Cenários:** carga leve (dados do Kevin), carga pesada com nomes longos, vazio.
- Sintaxe de todos os JS alterados.

## Arquivos
Novos: `js/painel.js`, `styles/painel.css`. Alterados: `index.html` (item da sidebar + includes), `js/app.js` (rota `painel`, `aplicarCasaPadrao`, `#/` do videomaker), `js/permissoes.js` (`painelElegivel`, navegação, logo), `js/video.js` (exporta `ehAtrasada`/`rotuloSituacao`, filtros por URL, `prazo=hoje` + chip), `js/database.js` (3 leituras do Painel), `styles/video.css` (cor do chip "vence hoje"), `sw.js` (cache v99).

## Pendências
- **Validar em aparelho real com login real** (Kevin e Kaique). O harness usa os mesmos módulos, mas não o Supabase ao vivo pelo navegador; as consultas foram validadas por SQL com o RLS.
- **"Próximas gravações" é da agenda da equipe, não por pessoa:** gravação não tem videomaker por ID no banco (`gravacoes.videomaker` é texto livre) e os eventos do Google não têm responsável. Casar por nome seria frágil. Para ser pessoal de verdade, gravação precisaria de um `videomaker_id` — fica para uma próxima fase.
- Gravações vêm só de agendas com "Avisar a equipe" ligado (a view `agenda_compromissos` respeita esse interruptor).
- "Recentes / Continuar" não entrou: não existe histórico de navegação confiável, e criar um só pra isso estava fora do escopo.
