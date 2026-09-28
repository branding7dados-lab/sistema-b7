# Produção de Vídeo — detalhe da demanda redesenhado + roteiro dentro da demanda
**Data:** 2026-09-28 · **Arquivos:** `js/video.js`, `js/autosave.js`, `styles/video.css` · **Sem migration.**

## O que mudou

### 1. Nova demanda: o roteiro não precisa mais ter sido gravado
Antes, o checklist de roteiros só aparecia quando a gravação estava marcada como **"Gravado"**. Na prática, nem sempre há tempo de marcar isso antes de a edição começar — e a regra só travava a criação da demanda. Agora o checklist carrega para **qualquer** gravação. Se a gravação ainda não estiver "Gravado", aparece um aviso informativo (“Gravação ainda "Agendada" — tudo bem, a demanda pode ser criada antes”), mas nada é bloqueado. A restrição vivia só na tela (`js/video.js`); a função do banco `video_gerar_demandas_de_gravacao` nunca exigiu status, então não houve mudança de SQL.

### 2. O roteiro agora é lido dentro da demanda
Nova seção **"Roteiro"** na coluna principal (logo abaixo das versões — é a referência de trabalho do videomaker). Cada roteiro vinculado vira um cartão com número na gravação (ROTEIRO 02), título, objetivo, situação de revisão e quantidade de cenas, e quatro ações:
- **Ler roteiro** — expande as cenas ali mesmo (Cena 1 · GANCHO · direção; texto; sugestão de cenas quando é Narração). Com um único roteiro vinculado, já abre expandido.
- **Ficha A4** — abre a espiada (`B7.QuickView`) com a folha de gravação renderizada, igual à da tela de Roteiros.
- **Abrir no editor** — atalho para `#/gravacao/<id>?roteiro=<id>`.
- **Desvincular** — com confirmação.
O seletor "Vincular outro roteiro…" fica no rodapé da seção e reaproveita a lista de roteiros já carregada (sem consulta extra).

Dados: `abrirDetalhe` faz uma segunda rodada paralela **só quando há gravação** — `gravacao(id)`, `listarRoteiros(gravacaoId)` e `listarCenasDaGravacao(idsVinculados)` — com teto de 15s; falha ali não derruba a tela, a demanda abre sem a leitura.

### 3. UI/UX do detalhe
- **Faixa de resumo** sob o título: situação, prioridade, prazo (em vermelho se atrasada), responsável e gravação — o estado da demanda de relance.
- Coluna principal em **blocos** (Versões · Roteiro · Material editado · Observações · Histórico).
- Painel lateral agrupado em **Fluxo** (situação, versão atual, responsável, prazo, prioridade, standby) e **Contexto** (gravação, pacote, competência, origem); fixo ao rolar no desktop.
- **Sem botão "Salvar alterações"**: prazo, prioridade e pacote salvam ao mudar; observações salvam com pausa de digitação (indicador "salvo automaticamente"); tudo pelo `B7.Save` (mesmo "Salvo ✓" do resto do sistema). Para isso, `js/autosave.js` ganhou o mapeamento `demandas_edicao → editarDemandaVideo`.
- Trocar a **gravação vinculada** salva na hora; se havia roteiros vinculados, pede confirmação e os desvincula (eles pertencem à gravação anterior).
- Ações destrutivas (Descartar / Excluir) agrupadas no canto do cabeçalho, discretas.
- Mobile: tudo empilha; cartão do roteiro reorganiza cabeçalho e ações.

## Verificação
Renderizado num harness com dados fictícios (desktop 1366px e celular 390px): faixa de resumo, cartão do roteiro com 4 cenas, expandir/recolher, Ficha A4 abrindo a folha no QuickView, autosave disparando `B7.Save.campo('demandas_edicao', …)`. Sintaxe validada em `js/video.js` e `js/autosave.js`.

## O que não mudou
Versões, comentários com timecode, aprovação do cliente, entrega, importação, gestão, descartados. Nenhuma tabela, view ou função do banco.
