# Relatório — Campos de busca sem preenchimento automático do navegador

**Versão:** `2026-10-08-zzz107` · **Cache:** `roteiros-b7-v312`
**Relato:** dois prints — a busca geral (Ctrl+K) abrindo uma lista de CEPs salvos do Chrome, e a busca de Gravações preenchida sozinha com "b7admin" e mostrando as senhas salvas.

## Causa
O navegador e os gerenciadores de senha tratam campos de busca como "usuário" ou "endereço". Com isso:
- preenchiam o campo sozinhos com o login salvo — e a tela filtrava por "b7admin", mostrando "Nenhuma gravação" sem ninguém ter digitado;
- abriam a lista de CEPs ou de senhas por cima da busca.

É o mesmo defeito que já tinha sido resolvido no campo "Visualizar como…".

## O que mudou
A proteção que funcionou naquele campo passou a valer para **todos os campos de busca do sistema**, de uma vez só (inclusive os de telas que vierem depois):
- o campo é marcado para o preenchimento automático e os gerenciadores de senha ignorarem;
- fica travado até a pessoa tocar ou focar nele — campo travado não é preenchido sozinho;
- se chegar já preenchido pelo navegador, é limpo e a tela volta a mostrar tudo;
- texto que entrar sem o campo estar em foco é descartado.

Digitar, colar e limpar funcionam como antes. O campo de usuário da tela de entrada não foi tocado (ali o preenchimento é desejado).

## Arquivos alterados
`js/ui.js`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local:
- a busca de Gravações recebe a proteção ao abrir a tela (marcada, travada, com as marcações de ignorar);
- digitando nela (por código), a tela filtra normalmente e, ao sair do campo, ele trava de novo;
- a busca geral (Ctrl+K) recebe a proteção e abre já pronta para digitar.

## Não testado
- **O próprio comportamento do Chrome.** O navegador de teste não tem senhas nem endereços salvos, então não vi a lista deixar de aparecer; a correção repete a receita que funcionou no "Visualizar como…". O Chrome às vezes ignora essas marcações para endereços — se a lista de CEPs ainda aparecer em algum campo, preciso saber qual.
- Um detalhe do teste: no navegador de teste (janela oculta) o campo não destravou com o foco dado por código; por segurança, ele agora destrava também ao clicar e ao apertar qualquer tecla. Com mouse e teclado de verdade não testei.
- Celular (teclado abrindo no primeiro toque).
