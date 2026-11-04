# Relatório — app Android: nenhuma tela por baixo da barra de cima (zzz147, 10/10)

Print do Kevin: no app, o painel **Conversas** (e outras telas de tela cheia)
ficava com o título por baixo da hora e da bateria.

## Por quê
O app desenhava as telas atrás das barras do Android. O sistema foi feito para
o Chrome, onde a barra de cima fica fora da página. Só algumas telas sabiam se
afastar dela.

## O que mudou
- As telas agora ficam **entre** a barra de cima e a de baixo, como no Chrome.
  Isso vale para todas, sem precisar acertar uma por uma.
- A faixa atrás de cada barra é pintada com a cor da tela:
  - em cima, a cor do topo (a mesma que o sistema já calculava para o Chrome);
  - embaixo, o fundo da página.
  Por isso a barra continua parecendo transparente.
- Abertura e login usam as cores escuras deles. O teleprompter usa preto.
- Os ícones (hora, bateria) ficam brancos em tela escura e escuros em tela clara.
- O teclado empurra a tela para cima, como no Chrome.
- A abertura também não muda mais de tamanho no meio.

## Testes
- Navegador simulando a ponte:
  - abertura → preto, ícones brancos;
  - tema claro → topo claro, ícones escuros;
  - teleprompter → preto.
- APK montado.
- `testes/` ok.
- **Não testado** no celular: vem no APK desta publicação.

Versão `2026-10-10-zzz147`, cache `v352`.
