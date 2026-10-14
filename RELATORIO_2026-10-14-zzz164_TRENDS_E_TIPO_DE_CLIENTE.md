# Relatório — Trends e "como trabalhamos com o cliente" (zzz164, 14/10)

Pedido do Kevin: nem todo cliente usa linha editorial — alguns são por
semana, outros a B7 só faz roteiros e algumas trends.

## 1. Como trabalhamos com este cliente
Em **Novo cliente** e **Editar cliente** há três opções:
- **Linha editorial** (o padrão — todos os clientes atuais continuam assim);
- **Por semana** — sem linha editorial: a aba "Editorial" some do cliente e a
  visão geral mostra só o status semanal;
- **Só roteiros** — a aba "Editorial" some e a visão geral não mostra os
  blocos de planejamento; ficam gravações, roteiros, vídeos e design.

O cabeçalho do cliente mostra uma etiqueta ("Por semana" / "Só roteiros").
É só o que a tela mostra: nada é apagado, e voltar para "Linha editorial"
traz tudo de volta.

## 2. Trends (novo item no menu, junto de Roteiros)
- **Nova trend**: link (Reels, TikTok, YouTube, áudio…) + nome + "como usar".
  Sem link também vale (ideia de formato).
- **Usar para um cliente**: escolhe o cliente e uma gravação em aberto dele
  (ou cria uma gravação "Trends" sem data). Cria o roteiro com o nome da
  trend e a referência dentro, e abre o editor.
- Abas **Para usar / Já usadas / Arquivadas**, com busca. A trend mostra em
  quais clientes já foi usada (toque leva ao roteiro).
- Quem vê: quem tem acesso a Roteiros (administração, coordenação e
  videomaker). Cliente nunca vê.

## 3. Banco (Supabase)
Arquivo `migration_trends_e_modo_cliente.sql`:
- coluna `clientes.modo` (`linha` | `semana` | `roteiros`, padrão `linha`);
- tabela `trends` com RLS só para a equipe interna (`sou_equipe_interna()`);
- view `clientes_resumo` passa a trazer `modo`.

Enquanto a migração não estiver aplicada, o sistema não quebra: a opção do
cliente não aparece no "Editar cliente" e a tela de Trends avisa que está
sendo ligada.

## Arquivos
`js/trends.js` (novo), `js/dashboard.js`, `js/app.js`, `js/nav.js`,
`js/permissoes.js`, `js/novidades.js`, `styles/sistema.css`, `index.html`,
`sw.js` (v368), `js/auth.js` (zzz164).

## 4. Banco aplicado
Com a autorização do Kevin, a migração foi aplicada no Supabase (tabela
`trends` com RLS, `clientes.modo`, view `clientes_resumo` com `modo`) e
conferida: os 24 clientes ficaram como "Linha editorial".

## 5. "Precisa de mim" da designer mostrava peças já finalizadas
Causa: quando uma linha editorial é concluída de novo (V02, V03…), o banco
compara cada conteúdo com a versão anterior e marca "briefing atualizado"
nas peças — **inclusive nas já finalizadas/aprovadas pelo cliente**. Era o
caso das 3 peças da Alissan (Sabor da Feira, status finalizado).
- Banco: gatilho `design_briefing_so_em_producao` — peça finalizada ou
  aprovada pelo cliente nunca fica com "briefing atualizado"; as 3 marcas
  erradas foram limpas.
- Tela (Central de Design e Painel): a mesma regra, para não depender só do banco.

## 6. App de PC para quem usa o navegador
A linha "App para Windows" existia, mas só na aba **Sistema**, que só o
administrador vê. Agora:
- **Configurações → Geral → Aplicativos**, para toda a equipe: no navegador
  do Windows, "App para Windows" baixa o instalador direto; no programa,
  mostra a versão e procura atualização; no navegador do Android, "App
  para Android" baixa o APK.
- **Convite automático** no navegador do Windows (o mesmo do Android): uma
  vez, com o que o programa tem a mais e o botão que já baixa o instalador.
  Explica o aviso "O Windows protegeu o computador". "Agora não" volta em 30 dias.

## 7. IA
O que os números de 14 dias mostraram (tabela `ia_uso`): 62 conversas ok,
5 falhas "fora do ar" (7%) e 2 por tempo; tudo no modelo gratuito.
- **Uma segunda tentativa** automática (1,2 s depois) quando o Google
  responde "fora do ar" — nunca em limite/cota, que só gastaria cota.
- O assistente agora **conhece as Trends** da equipe (as 15 mais novas,
  com onde já foram usadas) e **como a B7 trabalha com o cliente** (não
  sugere linha editorial para quem é "por semana" ou "só roteiros").
- Publicação: a IA roda no servidor (Edge Function `b7-ia`) e não sai
  junto com o site. Criei `.github/workflows/funcoes.yml`, que publica
  sozinho a cada mudança — mas ele precisa do segredo
  **SUPABASE_ACCESS_TOKEN** no GitHub. Até lá, essa parte fica no código
  esperando.
