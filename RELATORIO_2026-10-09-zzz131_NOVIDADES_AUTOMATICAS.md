# Relatório — Novidades automáticas

**Versão:** `2026-10-09-zzz131` · **Cache:** `roteiros-b7-v336`
**Pedido:** "não tem como fazer uma versão simples do sistema, só com o que a equipe precisar saber que mudou?"

## O que mudou
As novidades deixaram de depender de você cadastrar. Agora existe uma lista que **vai junto com o sistema** (`js/novidades.js`): a cada versão que muda algo que a equipe percebe, o registro já vem escrito, e o cartão aparece sozinho para quem atualizar.

- **Quem escreve:** eu, na hora de publicar cada versão. Só o que muda para quem usa, em frase curta, sem termo técnico. Banco, testes e correções internas ficam no relatório, não ali.
- **Versão sem mudança visível não gera novidade**, para o cartão não aparecer à toa.
- **Cada pessoa só recebe o que vale para ela:** novidade de administrador só para administrador; a do Painel do videomaker só para videomaker; a das Oportunidades só para quem abre Oportunidades; novidade de um recurso desligado para a pessoa não aparece.
- **Você continua podendo escrever um aviso a mais** em Configurações → Admin → Novidades → "Publicar um aviso". As duas listas aparecem juntas, por data.

## O que a equipe vai ver na primeira vez
Já deixei nove registros, das versões desde ontem: Painel do videomaker, "Hoje é dia de…", ideias nas Oportunidades, voz, o assistente propondo mais, imagem e roteiro pelo conteúdo, e os três de administrador (TV/textos/recursos, manutenção, esta). Então, ao atualizar, cada pessoa vê um cartão com **várias novidades de uma vez** (de 4 a 9, conforme a função). Depois disso, uma por versão.

Os textos são meus. Se quiser outro tom ou tirar algum, é só dizer: é um arquivo simples.

## Limites
- "Já li" continua sendo por aparelho.
- Uma novidade da versão não dá para remover pela tela (só os avisos escritos por você têm "Remover"). Para tirar uma, eu edito o arquivo.
- O Portal do cliente não recebe.

## Banco de dados
Nada mudou no banco nesta versão.

## Arquivos
Novo: `js/novidades.js`. Alterados: `js/sistema.js`, `js/dashboard.js`, `index.html`, `sw.js`.

## Testes executados
Aba local **sem login**, com conta de mentira e banco simulado (a mesma limitação das duas rodadas anteriores).
- o cartão apareceu sozinho, sem nada cadastrado;
- contagem por perfil: designer 4, videomaker 5, coordenador com Oportunidades 6, administrador 9;
- a janela lista da mais recente para a mais antiga; depois de abrir, o cartão não volta;
- publicar um aviso à mão continua funcionando e entra no topo; a lista "Avisos seus já publicados" mostra só os seus.

## Não testado
- Com a sua conta e as da equipe de verdade na tela.
- Celular e tema escuro.
