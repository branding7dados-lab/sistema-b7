# Relatório — "Visualizar como…" não é mais preenchido pelo gerenciador de senhas

**Versão:** `2026-10-07-zzz77` · **Cache:** `roteiros-b7-v282`
**Problema relatado:** o campo "Visualizar como…" da barra lateral aparecia preenchido com o usuário salvo no gerenciador de senhas (ex.: `b7admin`), e a lista abria sozinha com "Nada encontrado".

## Causa
O gerenciador de senhas tratava o campo de busca como campo de usuário e escrevia nele. O texto que chegava disparava a busca.

## O que mudou
- O campo fica **somente-leitura até a pessoa tocar nele** (gerenciadores não preenchem campo assim). Ao tocar ou focar, destrava; ao sair, trava de novo.
- Texto que chegar **sem o campo estar em foco é descartado** e a lista não abre.
- O campo ganhou as marcas que os gerenciadores respeitam para "não é login" (LastPass, 1Password, Bitwarden, Dashlane) e um nome que não parece de usuário.
- O campo de busca da janela "Visualizar como" (a que abre pelo ícone do olho) ganhou as mesmas marcas.

Nada muda no jeito de usar: clicar, digitar e escolher a pessoa.

## Arquivos alterados
`js/previa-usuario.js`, `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
App local, arquivo novo, sessão simulada:
- texto escrito no campo sem foco (como faz o gerenciador): foi apagado e a lista não abriu;
- tocar/focar: o campo destravou e a lista abriu;
- digitar "alis": a pessoa de exemplo apareceu na lista;
- sair do campo: travou de novo.

## Não testado
Com um gerenciador de senhas de verdade (o do Kevin). O comportamento de cada gerenciador varia; se algum ainda insistir, o texto é descartado do mesmo jeito, mas vale confirmar na tela.
