# Pacote zzz12: perfil (Conta, Segurança, Notificações) redesenhado e animado

Versão `2026-10-04-zzz12`, cache `roteiros-b7-v217`.

## Como ficou
- **Cabeçalho:**
  - uma aurora rosa e violeta suave atrás, que se mexe devagar;
  - foto redonda com anel em degradê, que entra girando de leve;
  - nome maior;
  - o × virou um botão de vidro que gira ao passar o mouse.
- **Abas:** cada uma tem um ícone (pessoa, cadeado, sino), e uma **pílula desliza** até a aba escolhida. O conteúdo entra **pelo lado certo**: vem da direita ao avançar e da esquerda ao voltar. Os cartões entram em cascata.
- **Cartões:** cantos mais redondos, e cada título ganha um ícone colorido:
  - foto em rosa;
  - nome em violeta;
  - "Definido pela Branding7" em cinza, com escudo;
  - senha em laranja, com chave;
  - aparelho em verde.
- **Segurança:**
  - cadeado dentro de cada campo, que fica rosa no foco;
  - **medidor de força** em 4 barras (Fraca, Média, Quase lá, Forte), que pulsa ao ficar forte;
  - os requisitos ficam verdes com um "pop".
- **Notificações:**
  - Push, Som e Aviso do navegador ganharam ícones (sino, alto-falante, janela);
  - o ponto verde do "Este aparelho recebe avisos" pulsa.
- **Rodapé:** "Sair da conta" com ícone de saída e fundo levemente avermelhado.
- Modo leve: aurora parada. "Reduzir movimento" desliga as animações.

A lógica (salvar foto, nome, senha e interruptores) não mudou, em `js/perfil.js`. O CSS está no bloco "PERFIL 2 (zzz12)" no fim de `styles/auth.css`.

## Testes
`npm test` passou. Conferido em prints de 390 px (claro e escuro, nas três abas) e de 1280 px.
