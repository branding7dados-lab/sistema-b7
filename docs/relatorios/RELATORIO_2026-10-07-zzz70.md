# Relatório — Telas de usuários mais limpas

**Versão:** `2026-10-07-zzz70` · **Cache:** `roteiros-b7-v275`
**Pedido:** "melhora as telas de usuários".
Só aparência e organização das telas. Nenhuma regra de acesso, banco, RLS ou servidor foi alterada; os pedidos enviados ao servidor são os mesmos.

## O que mudou

### Lista (Usuários e acessos)
- Saíram as etiquetas com os três primeiros módulos de cada pessoa. No lugar: **quantos módulos ela abre** ("4 módulos", "abre tudo") e **só o que é diferente do padrão da função**: `+ Clientes` (a mais), `− Calendário` (tirado).
- Passar o mouse na contagem mostra a lista completa de módulos.
- No celular a linha de função/módulos quebra em duas em vez de cortar.

### Editar acesso
- Cabeçalho com a foto, o nome e o @usuário da pessoa.
- Módulos: uma linha por módulo, sem repetir "Padrão de …" doze vezes. Só o módulo personalizado ganha etiqueta ("a mais" / "tirado").
- Uma linha de resumo: "4 de 12 · padrão de Videomaker + 2 personalizações".
- Administrador: os doze interruptores travados deram lugar a uma frase ("Administrador abre todos os módulos").
- "Nenhuma" função só aparece quando a pessoa é administradora (antes ficava apagada na tela).
- Embaixo da função aparece o que ela significa (ex.: "Designer: produz as artes…").
- Conta de cliente: empresas e "Pode aprovar" agora usam o mesmo bloco do "Novo usuário" (pílulas, busca, contador, chave).
- Botões Cancelar/Salvar no mesmo padrão do "Novo usuário".

### Funções e acessos
- **Correção:** as três abas saíam como 2 + 1 (a de Videomaker ocupava a linha inteira). Agora são três colunas iguais, inclusive no celular.
- Nova linha dizendo quem herda aquele padrão ("2 pessoas herdam: Alissan, Pedro. 1 com acesso personalizado.").

### Novo usuário
- Mesmo bloco de função e módulos descrito acima; os módulos só aparecem depois de escolher a função.

## Arquivos alterados
`js/usuarios.js`, `styles/auth.css`, `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
App local, arquivos novos, servidor substituído por dados de exemplo (5 contas da equipe + 1 cliente fictício, 12 empresas fictícias):
- lista: textos de cada linha conferidos (contagem, "abre tudo", + / −);
- Funções e acessos: três abas na mesma linha em 1400 px e em 375 px; linha de quem herda; alterar e salvar enviou o `salvar_preset` certo;
- Editar acesso (equipe): cabeçalho, resumo, etiquetas, "Nenhuma" escondida/visível, administrador sem a grade; salvar enviou função e exceções corretas;
- Editar acesso (cliente): empresas marcadas, contador, chave de aprovação; salvar enviou empresas e aprovação corretas;
- Novo usuário: troca cliente/equipe, busca de empresa, erro sem função, criação enviou o pedido certo;
- sem estouro horizontal nos modais em 1400 px e 375 px.

## Não testado
- Com conta real e servidor de verdade.
- Aparência por captura de tela (o navegador de teste não repinta; conferi medidas e textos).
- Celular físico e tema escuro.
