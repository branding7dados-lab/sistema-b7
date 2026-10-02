# Relatório 2026-10-02-d — Atualização automática com o B7 aberto

Só front-end (`js/app.js`). Sem migration, sem mudança de tela além do aviso que já existia.

## Resumo da atualização

- **O B7 aberto passa a descobrir sozinho que há versão nova:** pergunta ao servidor a cada 30 segundos enquanto está visível, e na hora em que a aba ou o app volta a aparecer.
- **A versão nova entra sozinha**, sem clicar em nada, sempre que recarregar não atrapalha quem está usando.
- **A tela de login** também passa a se atualizar sozinha (antes, a verificação só ligava depois de entrar).

## O problema

Com o B7 aberto, o navegador só confere se há versão nova quando a página é carregada (ou uma vez por dia). Uma versão publicada passava despercebida até alguém recarregar. E, quando era percebida com a pessoa olhando, só aparecia um aviso por 20 segundos; quem não clicasse continuava na versão antiga.

## O que mudou

### Descobrir

- A cada 30 s, com a aba visível, a página pergunta se o `sw.js` mudou. É uma consulta leve.
- Também pergunta quando a aba volta a aparecer, quando a janela ganha foco e quando a internet volta. No celular, isso cobre "abrir o app que estava em segundo plano".
- Havendo versão nova, ela é baixada e assume, como já acontecia ao recarregar.

### Aplicar

Recarregar apaga o que está digitado num campo, fecha um modal no meio e derrubaria uma apresentação. Por isso a regra é:

| Situação | O que acontece |
|---|---|
| Aba em segundo plano | recarrega na hora |
| Aba visível, ninguém mexe há 8 segundos | recarrega sozinha |
| Pessoa usando (clicou ou digitou há pouco) | espera; recarrega quando ela trocar de tela ou parar por 8 s |
| Campo de texto em foco, modal aberto, apresentação ou tela cheia, alteração ainda salvando | não recarrega; fica o aviso com o botão "Atualizar" |

- O aviso "Nova versão do B7 disponível · Atualizar" agora fica na tela até a atualização acontecer (antes sumia em 20 s).
- Ao recarregar, a pessoa continua na mesma tela (o endereço é mantido).
- Trava contra laço: no máximo uma recarga automática a cada 30 s.

## O que isso não muda

- **O tempo do GitHub.** Depois de eu publicar, o GitHub Pages leva em torno de um minuto para colocar os arquivos no ar. A partir daí, o B7 aberto percebe em até 30 s e baixa a versão nova (alguns segundos). Na prática, cerca de 1 a 2 minutos do "publicado" até aparecer, sem ninguém tocar em nada.
- **Abas abertas na versão antiga.** Quem está com o B7 aberto numa versão anterior a esta ainda não tem a verificação: precisa recarregar uma vez. Daqui para a frente é automático.

## Arquivos

- `js/app.js`: novo `ligarAtualizacao()` (verificação periódica e regra de recarga), chamado também na tela de login.
- `js/auth.js` versão `2026-10-02-d`; `sw.js` cache `v131`.

## Testes realizados

O navegador de teste não registra service worker, então usei uma página local com um service worker de mentira para exercitar a regra (página apagada depois):

- Foco na janela dispara a verificação; um segundo foco em seguida não repete (contido em 10 s).
- Versão nova com campo de texto em foco: não recarrega em 11 s, aviso com "Atualizar" na tela. Ao sair do campo: recarrega em até 2 s.
- Logo depois de uma recarga automática: outra versão não recarrega sozinha de novo (trava de 30 s), o aviso aparece.
- Modal aberto: não recarrega. Modal fechado, mas com clique recente: espera. Troca de tela: recarrega e mantém o endereço.
- Aba em segundo plano: recarrega na hora.

## O que NÃO foi testado

- **O fluxo real:** publicar uma versão e ver um B7 aberto se atualizar sozinho, no PC e no celular. Só a regra foi testada, com simulação. O primeiro teste de verdade é a próxima publicação.
- O intervalo de 30 s rodando de fato (testei o disparo por foco, não esperei o relógio).
- App instalado no celular (PWA) voltando do segundo plano.
- Comportamento dentro do Portal do cliente.
