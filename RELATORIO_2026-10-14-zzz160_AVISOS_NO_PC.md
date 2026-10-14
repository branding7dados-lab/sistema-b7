# Relatório — avisos no programa de computador (zzz160, 14/10)

Kevin foi ativar as notificações no app de PC e apareceu **"Avisos bloqueados
neste navegador"**, com o botão de push desligado e sem como ligar.

## O que era
Erro meu no programa de Windows. Ele decide o que a página pode usar (câmera,
microfone, avisos) comparando o endereço do site. A comparação era de texto
cru — `"https://…github.io"` contra `"https://…github.io/"` — e a barra no fim
fazia a conta dar errado. Resultado: o programa respondia "bloqueado" para
tudo, inclusive para os avisos, e o sistema mostrava aquela mensagem.

Agora a comparação é pela **origem de verdade** do endereço, e a permissão é
conferida item a item (`app-desktop/main.js`).

## O que muda na prática
Com o programa atualizado, no computador:
- **Aviso do Windows**: quando a janela do B7 não está na frente, o aviso
  aparece no canto da tela, como qualquer programa do Windows;
- **Som das notificações**: funciona;
- **Sino**: como sempre.

## Uma coisa que o programa de computador NÃO faz
**Push com o programa fechado** não existe no app de computador: ele não tem
serviço de push (isso é do Android/navegador). Antes isso aparecia como uma
permissão bloqueada, o que mandava a pessoa procurar uma configuração que não
existe. Agora o sistema diz o que é verdade:

- no lugar do push: *"No programa de computador, o aviso aparece enquanto ele
  está aberto. Para receber com tudo fechado, use o app do celular."*;
- se o Windows estiver com as notificações do B7 desligadas, a mensagem manda
  para **Configurações do Windows → Sistema → Notificações** (e não para as
  "configurações do navegador", que ali não existem);
- a opção passou a se chamar **"Aviso do Windows"** dentro do programa.

## Arquivos
- `app-desktop/main.js` (a correção da permissão).
- `js/push.js`, `js/perfil.js` (os textos certos dentro do programa).
- `js/auth.js` (`2026-10-14-zzz160`), `sw.js` (`roteiros-b7-v365`).
