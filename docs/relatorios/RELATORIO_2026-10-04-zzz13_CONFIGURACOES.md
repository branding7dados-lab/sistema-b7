# Pacote zzz13: Configurações redesenhadas e fim do título duplicado

Versão `2026-10-04-zzz13`, cache `roteiros-b7-v218`.

## "Configurações" aparecendo duas vezes
No celular, o topo mostra o nome da tela e a página tem o título grande logo abaixo, então o nome aparecia duas vezes. Isso valia para Usuários, Clientes e outras telas também.

Agora o comportamento é o dos apps do iPhone (`js/topo.js`, `tituloGrande`, mais `styles/topo.css`):
- enquanto o **título grande** está à vista, o nome no topo some;
- ao rolar e o título passar por baixo do topo, o nome **sobe de volta**, suave.

Vale para toda tela que tem um `h1` na página. Telas sem título grande continuam com o nome no topo.

## Configurações
- **Cartão da conta:**
  - aurora rosa e violeta e foto com anel em degradê (o mesmo visual do perfil novo);
  - três atalhos (**Foto e nome**, **Senha**, **Avisos**), cada um abrindo o perfil já na aba certa.
- **Tema por miniaturas:** Claro, Escuro e Sistema aparecem como mini telas do próprio B7 (Sistema é metade clara e metade escura). A escolhida ganha borda rosa e um ✓ que surge com mola.
- **Listas:**
  - ícones um pouco maiores, que inclinam e crescem no hover;
  - cantos mais redondos;
  - as linhas de cada grupo entram em cascata.
- **Rodapé:** "Sair da conta" centralizado e uma assinatura com o símbolo da B7: "Sistema B7 · feito pela Branding7".
- A linha de caminho antiga ("Central B7 / Configurações") saiu do código.

As preferências continuam as mesmas: tema, densidade, animações, desempenho, abertura, interface, impressão, administração, sistema e backup.

## Testes
`npm test` passou. Conferido em prints de 390 px (claro e escuro) e de 1280 px. A troca do nome no topo também foi conferida: some com a página no topo e volta ao rolar.
