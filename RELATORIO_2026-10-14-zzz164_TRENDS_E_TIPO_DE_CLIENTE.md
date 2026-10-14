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
