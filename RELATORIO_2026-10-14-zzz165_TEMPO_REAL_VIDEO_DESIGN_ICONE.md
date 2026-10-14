# Relatório — tempo real, vídeo "só edição", quadro de Design, horários e ícone (zzz165, 14/10)

## 1. Peças de design "em criação" (dado)
As 56 peças em "Em criação" já tinham sido entregues: viraram **Finalizadas**
(com a data de finalização = a última vez que foram mexidas, para não inflar
o mês atual). As 3 "Aguardando produção" sem responsável continuam valendo, e
a 1 em revisão interna não foi tocada.

## 2. Vídeo na linha editorial: "Gravação e edição" ou "Só edição"
No conteúdo do tipo Reel há agora:
- **Produção**: *Gravação e edição* (como hoje: entra na gravação e a demanda
  nasce quando se marca que foi gravado) ou *Só edição*;
- **Formato**: Normal, **Meme** ou **Trend**;
- **Link de referência**.

"Só edição" cria a demanda em **Edição de vídeo na hora** (gatilho no banco
`conteudo_video_so_edicao`): mesmo cliente, mês da linha, prazo = data de
postagem, título do conteúdo, origem "linha". O formato e o link sempre
acompanham o conteúdo; o título acompanha enquanto a demanda está pendente.
Na demanda aparece o bloco **Referência** (Meme/Trend, "Da linha editorial ·
só edição" e o botão "Abrir a referência").

Banco (`migration_video_so_edicao.sql`): colunas novas em `conteudos` e
`demandas_edicao`, origem `linha`, índice único por conteúdo, view
`demandas_edicao_resumo` com os campos novos.

## 3. Tempo real em todo o sistema
`js/tempo-real.js`: um canal só por pessoa da equipe. Quando algo muda no
banco (demandas de vídeo e seus eventos/versões, peças de design, conteúdos,
linhas, gravações, clientes, trends), a tela atual — se depende daquilo — é
redesenhada em silêncio, mantendo a rolagem. Não interrompe: espera se há
janela aberta, campo em foco, arrastando ou mexida nos últimos 2,5 s.
Exemplo do Kevin: ele cria uma demanda e o Kaique, na tela de Edição de
vídeo, vê aparecer. Tabelas adicionadas à publicação do Realtime:
design_versoes, demandas_edicao_eventos, video_versoes, gravacoes,
linhas_editoriais, clientes, trends.

## 4. Horários no histórico
O histórico da demanda de vídeo mostra **dia e hora** ("hoje às 15:32",
"12/10 às 09:05"); passar o mouse mostra o "há 2 dias". O cabeçalho da
demanda mostra quando foi criada. No Design, versões e avisos também.

## 5. Quadro de Design funcional + arrastar fluido e em lote
- `js/arrastar.js` (novo): arrastar com Pointer Events — o cartão segue o
  mouse/dedo pela placa de vídeo, inclina de leve, a coluna acende e, ao
  soltar, os cartões deslizam até o lugar (FLIP). Rola o quadro perto da borda.
- **Vários de uma vez**: Ctrl/⌘ ou Shift + clique marca; aparece a faixa
  "N marcados"; arrastar um leva todos (pilha com o número). Esc limpa.
  No celular: segurar e soltar marca, segurar e arrastar leva.
- **Design**: o quadro da equipe agora move peças entre etapas (função
  `design_mover_status`, só a equipe, fica no histórico como "Movida de X para Y").
- **Edição de vídeo**: no computador usa o mesmo arrastar (cada cartão passa
  pela ação de sempre — correção pede o motivo, aprovação confirma etc.);
  no celular continua o arrastar de toque que já existia.

## 6. Ícone do app Android
Configurações → Geral → Aplicativos → **Ícone do app** (só dentro do app):
Padrão B7, Noite, Oceano, Floresta, Pôr do sol, Rosa e Dourado. Feito com
`activity-alias` (um por cor, só um ligado) e a ação `icone` na ponte nativa.
Vale a partir do próximo APK (o app se atualiza sozinho).
