# Relatório — cargos sem limite, formas de trabalho que somam, exportar no PC (zzz166, 14/10)

## 1. Cliente com linha editorial E roteiros E trends
"Como trabalhamos com este cliente" deixou de ser uma escolha só: agora são
caixinhas que **somam** — Linha editorial, Pauta semanal, Roteiros e trends.
Marque tudo o que vale. A aba Editorial só some se "Linha editorial" estiver
desmarcada; o cabeçalho mostra uma etiqueta por forma de trabalho. O
assistente de IA lê a lista e só evita sugerir linha editorial quando o
cliente não tem. (banco: `clientes.modo` aceita "linha,roteiros" etc.)

## 2. Uma pessoa com vários cargos (sem limite)
Antes: uma função principal, e funções extras só em combinações fixas (ex.:
Designer extra só para Administrador/Coordenador). Agora, em **Usuários →
Editar**, o bloco **"Também atua como"** deixa marcar qualquer combinação de
Coordenador, Designer e Videomaker, além da função principal.
O que cada cargo a mais dá:
- **módulos** do padrão de cada cargo (somam);
- **Painel** com a visão de cada cargo (a principal primeiro);
- **Designer**: pode receber e assumir peças; **Videomaker**: aparece como
  responsável de vídeo; **Coordenador**: as permissões de coordenação.
Banco: coluna `perfis.funcoes_adicionais`; `tenho_funcao_extra`,
`sou_designer`, `sou_equipe`, `modulos_efetivos`, `minha_sessao` e
`design_atribuir` passaram a considerá-la; `perfil_definir_cargos` (só
administrador) grava. Nada antigo foi apagado — as funções extras de antes
continuam valendo.

## 3. "Não foi possível gerar o arquivo" no programa de PC
Testei o programa (o mesmo Electron) aqui: o PDF sai normal. Então o erro
vem de algo do roteiro real — o suspeito principal é a **imagem de outro
endereço** (a logo do cliente no Storage): quando o navegador já a tinha
guardado sem permissão de cópia, o desenho fica "contaminado" e gerar o
arquivo falha. Agora:
- antes de desenhar, cada imagem de fora vira uma cópia local buscada de
  novo com permissão; se não der, a imagem sai da folha e o arquivo sai mesmo assim;
- se a folha ficar grande demais para a memória, tenta numa escala menor;
- se ainda falhar, a caixa mostra **o motivo de verdade** (antes era só
  "tente de novo") — com ele dá para corrigir na hora.
