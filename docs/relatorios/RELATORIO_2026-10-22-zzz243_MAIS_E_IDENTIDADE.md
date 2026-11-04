# zzz243: "Mais" do celular e Configurações com a identidade da B7

Pedido do Kevin: "faltou um pouco da identidade da B7… o mais no celular, eu não tô gostando muito do design da UI e o UX dele, não. Muda, por favor."

## Folha "Mais" (celular): quarta versão
Arquivos: `js/nav.js` (`abrirMais`) e `styles/nav.css` (bloco zzz243).
- **Topo da marca:** o degradê da B7 (marinho → violeta → roxo → magenta) com o símbolo em marca-d'água. Mostra a data, uma saudação com o primeiro nome e o "Meu dia em 30 segundos" (agora um botão de vidro dentro do topo). O cabeçalho "Mais" com o X saiu; o X fica no topo.
- **Busca "Procurar uma tela":**
  - filtra sem diferenciar acentos;
  - esconde grupos vazios e mostra "Nenhuma tela com esse nome." quando nada combina;
  - Enter abre a primeira tela da lista;
  - a folha mantém a altura enquanto filtra.
- **"Usados por você":** pílulas com até 4 telas abertas 2 vezes ou mais pelo "Mais". A contagem fica neste aparelho (`localStorage` `b7-mais-uso`), e só entram telas que não estão na barra de baixo.
- **Grupos com título visível** e o filete da marca. "Principal" e "Meu trabalho" viraram um grupo só, "Para você", porque quase tudo deles já está na barra.
- **Ícones:** os de arco-íris do iOS saíram. Cada ícone é um passo do degradê da B7, de violeta (em cima) a magenta (embaixo); o passo vem da variável `--k` que o `nav.js` define.
- **Tela atual:** fundo em degradê suave e uma etiqueta "Você está aqui".
- **Ferramentas:** ganhou "Ajuda" (para todos) e "Configurações" para quem não é administrador. Antes, essas pessoas só chegavam às Configurações pelo menu da conta.

## Configurações com a cara da B7
Arquivos: `js/dashboard.js` (`abrirConfig`) e `styles/dashboard.css` (bloco CONFIGURAÇÕES 8).
- Cartão de quem está usando (menu) e cartão da Conta no degradê da marca, com o símbolo em marca-d'água.
- Ícones do menu no degradê da B7 (fim do arco-íris), com o mesmo `--k`.
- Filete da marca sob o título "Configurações", nos grupos do menu e no rótulo do bloco ("VOCÊ", "ADMINISTRAÇÃO") acima do título de cada seção.
- No PC, a seção aberta é marcada com degradê. As chaves ligadas ficam no degradê, e o botão de ação se preenche com ele ao passar o mouse.
- O miolo limpo (estilo Canva) continua igual. No celular, o "Abrir perfil" do cartão da Conta some, porque "Foto e nome" já abre o perfil.

## Versão
- VERSAO `2026-10-22-zzz243`, CACHE `roteiros-b7-v445`.
- Novidade `v-zzz243` em `js/novidades.js`.
