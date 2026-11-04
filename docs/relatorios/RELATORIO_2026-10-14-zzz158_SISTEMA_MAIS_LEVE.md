# Relatório — sistema mais leve + convite do app Android (zzz158, 14/10)

Pedido do Kevin: "dar uma otimizada no sistema, pra ele não ficar tão pesado"
(no computador, no site e no Android), e avisar quem abre pelo celular que
existe o aplicativo.

## 1. O que melhorou, medido

Medições num celular simulado com o processador 4× mais lento (parecido com um
aparelho mediano), partindo do zero:

| | antes | agora |
|---|---|---|
| **Primeira visita** (tudo que o aparelho baixa) | 12,05 MB | **4,78 MB** |
| **Cada atualização do sistema** | 12,3 MB | **69 kB** |
| Primeira coisa que aparece na tela | 1376 ms | **516 ms** |
| Sistema pronto para usar | 4484 ms | **928 ms** |

Vale para o site no computador, no celular, no app de Windows (que abre o
mesmo site) e no app de Android (que ganha o arranque mais rápido).

## 2. O que foi feito

**a) As três bibliotecas pesadas saíram do arranque** (`js/vendor-carregar.js`).
html2canvas, jsPDF e XLSX somam 1,4 MB — mais de um quinto de tudo — e só
servem para exportar PDF/PNG e ler planilha. Antes vinham em toda abertura,
para todo mundo. Agora chegam no instante em que alguém exporta ou importa de
verdade (32 ms na primeira vez, nada nas seguintes) e ficam guardadas no
aparelho.

**b) Os arquivos do sistema não seguram mais a tela** (`defer` nos 67 scripts).
Antes o navegador parava a montagem da página em cada arquivo, um de cada vez.
Agora baixa todos ao mesmo tempo enquanto desenha a tela — é o que fez o
"pronto para usar" cair de 4,5 s para menos de 1 s.

**c) Atualização baixa só o que mudou** (`sw.js`). Era o pior desperdício:
toda publicação baixava a casca inteira de novo em cada aparelho (12 MB), porque
o endereço de cada arquivo levava a versão junto e nada podia ser reaproveitado.
Agora cada arquivo é conferido pela etiqueta (ETag): o que não mudou é
reaproveitado do que já está no aparelho. Numa publicação em que só alguns
arquivos mudam, a atualização passou de 12,3 MB para **69 kB**.

**d) A primeira visita não baixa tudo duas vezes.** A reserva offline agora
aproveita o que o navegador acabou de baixar para a tela (de 12,05 para
4,78 MB).

## 3. O que foi testado e NÃO valeu a pena
Para não mexer no que funciona sem motivo, duas ideias foram medidas e
descartadas:
- **adiar o CSS das telas**: ganhou só 60 ms e traria risco de a tela aparecer
  sem estilo por um instante;
- **carregar os módulos pesados (Design, Vídeo, Calendário…) só ao abrir a
  tela**: não mudou nada no tempo (os arquivos já baixam em paralelo) e traria
  risco de uma tela abrir sem a parte dela.

## 4. Convite do app de Android (`js/convite-app.js`)
Quem abre o B7 pelo navegador de um Android vê uma vez uma folha embaixo:
"O B7 tem app para Android", com o que o app tem a mais (abre na hora, avisos,
atalhos no ícone, widget, teleprompter com câmera), o botão **Baixar o app** e
o aviso de que o Android vai pedir para permitir a instalação.

Não aparece: dentro do app, no B7 já instalado, em iPhone (lá não há APK), em
computador, para cliente, nem antes de entrar na conta. Tem "Já tenho o app"
(não volta a aparecer) e "Agora não" (volta a perguntar em 30 dias).

## Arquivos
- `js/vendor-carregar.js`, `js/convite-app.js` (novos).
- `index.html` (defer, bibliotecas fora do arranque), `sw.js` (atualização só
  do que mudou), `styles/global.css` (folha do convite).
- `js/extras.js`, `js/doc-semana.js`, `js/resumo-mes.js`, `js/print-linha.js`,
  `js/video.js` (pedem a biblioteca na hora de usar).
- `js/auth.js` (`2026-10-14-zzz158`), `sw.js` (`roteiros-b7-v363`).
