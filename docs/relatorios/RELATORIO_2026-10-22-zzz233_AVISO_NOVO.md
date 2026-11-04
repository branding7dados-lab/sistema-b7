# Relatório zzz233 — Aviso (toast) novo

Pedido do Kevin, mostrando o aviso "Estilo da abertura guardado neste aparelho…": "esse popup aparece em várias coisas do sistema, mas eu queria ele diferente, n gosto mt dele assim".

## O que mudou (js/ui.js `B7.UI.toast`, styles/global.css)
O mesmo aviso dos cerca de 540 lugares do sistema, com o visual e o comportamento refeitos. Quem chama não mudou: `toast(msg, { tipo, acao, aoClicar, tempo })`.
- **Cartão** claro no tema claro e escuro no escuro, com borda e sombra. Antes era uma caixa escura nos dois temas.
- **Ícone e cor por tipo:**
  - verde ✓ = deu certo;
  - vermelho = erro;
  - âmbar = atenção;
  - violeta = informação.
  
  Quando quem chama não diz o tipo, um texto de "deu certo" (salvo, enviado, copiado, aprovado…) vira verde.
- **Barra do tempo que falta**, na cor do tipo. Pausa com o mouse em cima.
- **× para fechar**; no celular, **arrastar para o lado** dispensa.
- **Repetidos não empilham:** o mesmo aviso vira um só com "×2", "×3".
- **No máximo 3** na tela.
- Erro fica mais tempo (5,2 s) e é anunciado na hora pelo leitor de tela (`role="alert"`).
- Posição: no computador, canto de baixo à direita, todos com a mesma largura; no celular, embaixo e centralizado, acima da barra.

## Testes feitos
- Prints no tema escuro, no claro e no celular, com aviso de erro, com botão "Desfazer" e repetido.
- `npm test`.
