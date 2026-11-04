# Relatório 2026-10-02-f/g — Atualização automática (correção)

Só front-end (`js/app.js`). Sem migration. A versão `g` é uma publicação de teste: só muda o número da versão.

## Resumo da atualização

- A atualização automática do pacote `d` não funcionava na prática: com o B7 aberto, nada aparecia. Corrigido.
- A página agora descobre a versão nova **perguntando qual é a versão publicada**, sem depender do service worker.
- Testado de verdade desta vez: publiquei uma versão com o B7 aberto e a página se atualizou sozinha.

## O que estava errado

No pacote `d`, a página esperava um aviso do navegador ("um service worker novo assumiu") para saber que havia versão nova. Esse aviso só chega a páginas que já estavam sob controle do service worker quando abriram. Uma página aberta com recarregamento forçado (Ctrl+F5 ou Ctrl+Shift+R), ou na primeira visita, fica fora desse controle: o aviso nunca chega, e por isso nada aparecia.

No pacote `d` eu só tinha testado a regra com um service worker simulado, e o relatório dizia isso. O defeito estava exatamente na parte que a simulação não cobria.

## O que mudou

- **Descobrir:** a página conhece a própria versão e lê, no servidor, a versão publicada (o número que está em `js/auth.js`). Se for diferente, há versão nova. Pergunta a cada 30 s com a aba visível, e quando a aba volta a aparecer, ganha foco ou a internet volta.
- **Aplicar:** a regra é a mesma do pacote `d` (recarrega em segundo plano, com a pessoa parada há 8 s ou na troca de tela; nunca com campo em foco, modal, apresentação ou salvamento pendente; nesses casos fica o aviso com "Atualizar").
- **Sem aviso à toa:** se a página já está na versão publicada, a troca de service worker não gera mais aviso nem recarga.
- **Trava contra laço:** recarrega sozinha uma vez por versão.

## Arquivos

- `js/app.js`: `ligarAtualizacao()` reescrito.
- `js/auth.js` versão `2026-10-02-g`; `sw.js` cache `v134`.

## Testes realizados

**Real, em produção (02/10/2026, navegador embutido, tela de login):**

1. Publiquei a versão `f`. O GitHub Pages passou a servi-la 42 s depois do envio.
2. Abri o B7 publicado. Página na versão `f`, **sem** controle do service worker (o caso que falhava).
3. Tirei o foco do campo de login, marquei a página e publiquei a versão `g`, sem tocar no navegador.
4. Cerca de 40 s depois do envio, a página recarregou sozinha e passou a mostrar a versão `g`.

**Não repeti** os testes simulados da regra de "quando aplicar" (campo em foco, modal, troca de tela): esse trecho não mudou desde o pacote `d`.

## O que NÃO foi testado

- Logado, dentro do sistema (o teste foi na tela de login; o código é o mesmo, mas lá dentro há mais situações de "ocupado").
- Celular e app instalado.
- Com a pessoa usando: aparecer o aviso e recarregar na troca de tela, em produção.
- Página aberta há muito tempo em segundo plano (o navegador reduz os relógios de abas escondidas; a checagem ao voltar a aparecer cobre isso, mas não foi exercitada).

## Para valer para você

Quem está com o B7 aberto numa versão anterior à `f` não tem essa checagem: precisa recarregar **uma vez** (no celular, fechar e abrir o app uma vez). A partir daí, as próximas versões chegam sozinhas, em torno de 1 minuto depois de publicadas.
