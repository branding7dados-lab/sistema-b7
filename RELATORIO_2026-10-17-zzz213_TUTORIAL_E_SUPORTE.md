# Relatório — Tutorial e Suporte: tudo o que foi pedido

**Versão:** `2026-10-17-zzz213` · **Cache:** `roteiros-b7-v416`
**Pedido:** "faz tudo" (as 7 ideias de tutorial e as 7 de suporte).

## Já existiam (feitos por outra sessão, zzz208–211) — conferido, não refeito
- Tutorial 6 **Busca na ajuda** (com sugestões e trechos destacados).
- Suporte 1 **Painel do suporte** (números, filtros, situação e prioridade), 2 **Conversa no chamado** (resposta, nota interna, aviso no sino) e 3 **Contexto automático** (tela, versão, aparelho, últimos erros).
- Suporte 6 em parte: **"Está me impedindo de trabalhar"** (urgente).

## Novo nesta versão
**Tutorial**
1. **Tour guiado** (`js/tour.js`): holofote em cada parte da tela, balão com Voltar / Próximo / Pular, setas do teclado e Esc.
2. **Primeiro acesso por função**: o tour de boas-vindas roda sozinho uma vez (espera a abertura e o aviso do programa de Windows fecharem) e mostra as telas da função da pessoa (Design; Vídeo e Gravações; Linhas e Calendário; Panorama e Configurações).
3. **Dica na primeira visita**: na primeira vez em cada tela com tutorial, um cartão no canto conta para que ela serve, com "Ver tutorial". Dá para desligar ("Não mostrar mais dicas") e religar na Ajuda.
4. **Primeiros passos**: lista no início da Ajuda, com anel de progresso, que se marca sozinha (abriu as telas da função, usou a busca, abriu o sino, as Conversas, leu um tutorial, fez o tour).
5. **Vídeo por tutorial**: o administrador envia um vídeo (MP4/WebM, até 50 MB) dentro de cada tutorial; a equipe vê o vídeo ali. Banco: espaço público `ajuda-videos` (só administrador envia/apaga), `ajuda_videos()` e `ajuda_video_definir()`.
7. **"O que mudou" leva à tela**: cada novidade com tela ganhou "Ver na tela →".

**Suporte**
4. **Assistente antes do chamado**: em Dúvida e Problema, botão "Perguntar ao assistente antes" — fecha o chamado e abre o assistente com a pergunta escrita (só pergunta quando a pessoa toca).
5. **Gravar a tela** (até 15 s, sem som), junto com os prints; o vídeo aparece no chamado. Pasta `suporte` passou a aceitar vídeo (até 25 MB).
6. **Chamado parado**: sem resposta há mais de 24 h (ou urgente parado há 24 h) avisa administração e coordenação, uma vez por dia (rotina `suporte-parados`, dias úteis, das 8h às 19h).
7. **Ideias da equipe**: botão no Suporte com as sugestões de todos, para votar; as mais votadas sobem. Só o resumo aparece (os detalhes do chamado continuam privados). Banco: `suporte_votos`, `suporte_ideias()`, `suporte_votar()`.

Cores do menu da conta (zzz212) já estavam publicadas.

## Banco (aplicado)
Duas migrações aditivas: vídeos da Ajuda e suporte (votos, aviso de parado, vídeo no anexo). Nenhuma regra de acesso existente foi alterada; as novas tabelas não têm acesso direto (só pelas funções).

## Testes
- Sintaxe de `tour.js`, `ajuda.js`, `suporte.js`, `sistema.js`, `app.js`, `novidades.js`.
- Tour na aba local: abriu, avançou e posicionou o holofote (sem login, só os passos visíveis).

## Não testado
- Tour completo, dicas e primeiros passos com a sua conta real; envio real de vídeo na Ajuda; gravação de tela real; aviso de chamado parado disparando; votos com contas reais.
