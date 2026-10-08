# Relatório — Tela de carregamento nova; abertura cortada no meio; trilha no fundo; opções só para administrador

**Versão:** `2026-10-08-zzz112` · **Cache:** `roteiros-b7-v317`
**Pedidos:** (1) refazer a tela de carregamento, mais estética e cinematográfica; (2) às vezes a abertura vai só até a metade e o áudio da trilha continua no fundo; (3) testar abertura e ligar/desligar trilha são só para administrador.

## 1. Tela de carregamento (a versão curta)
**Antes:** o logo aceso e parado no meio do escuro, com a frase encostada na base da lâmpada.

**Agora** o logo acende do mesmo jeito, mas dentro de uma cena que continua viva enquanto carrega:
- céu com **estrelas** derivando devagar;
- **raios de luz** fracos saindo de trás da lâmpada e girando lentamente;
- **poeira de luz** subindo em volta dela, em ciclo;
- um **feixe diagonal** que cruza a tela de tempos em tempos;
- a lâmpada e o halo **respiram**; o brilho continua passando pelo logo;
- embaixo, com mais respiro: um **fio de luz** largo com um ponto brilhante correndo, e a frase em letras pequenas e espaçadas.

Tudo em ciclo, só com posição, escala, giro e transparência. No celular vai metade da poeira; no modo leve a cena fica parada, só com as estrelas.

## 2. Abertura cortada no meio
**Causa.** O sistema contava o tempo que faltava da abertura pelo relógio da página. A animação tem o relógio dela: começa só quando a tela é desenhada pela primeira vez e **para enquanto a aba está em segundo plano**. Com carregamento lento, ou abrindo o sistema e indo para outra aba, o relógio da página chegava ao fim com a animação ainda na metade — e a abertura saía ali.

**Correção.** O tempo que falta agora é lido da própria animação, e conferido de novo antes de sair. Vale também para o "Testar abertura". Se a aba estiver em segundo plano, o sistema não fica preso atrás da abertura.

## 3. Trilha continuando no fundo
**Causa.** A trilha nova agenda sons para os segundos seguintes (a nota grave contínua, o arpejo, a assinatura). Quando a abertura saía antes da hora, esses sons continuavam tocando sem imagem.

**Correção.** Na saída, tudo o que é da trilha passa por um canal que é fechado em cerca de 0,35 segundo. Só os sons da própria saída continuam. Nada da trilha sobrevive à abertura, saia ela quando sair.

## 4. Só para administrador
O bloco **Abertura** de Configurações → Aparência (Trilha sonora, Testar abertura, Testar tela de carregamento) agora aparece só para administrador. Para o resto da equipe a trilha fica como está (ligada por padrão).

## Arquivos alterados
`styles/abertura.css`, `js/app.js`, `js/abertura-som.js`, `js/dashboard.js`, `js/auth.js` (versão), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local:
- **Trilha com saída antecipada:** renderizei a trilha sem alto-falante com a abertura saindo aos 3,0 s (antes da ignição). O som cai a quase zero em meio segundo e fica em silêncio depois dos 4 s — a ignição, o arpejo e a assinatura não tocam. Com a saída normal (6,4 s) a trilha toca inteira.
- **Tela de carregamento:** conferi em captura, parada aos 3,3 s — raios saindo da lâmpada, estrelas, fio de luz e a frase com folga de 62 px abaixo do logo (antes encostava). Na primeira tentativa os raios, a poeira e o feixe não apareciam (uma regra antiga os escondia); corrigi e conferi de novo. Na saída, essas peças somem.
- O sistema abre normalmente com a aba em segundo plano (é o caso do navegador de teste), sem ficar preso na abertura.

## Não testado
- **A abertura cortada**, do jeito que acontecia com você: não reproduzi o defeito em si. A correção ataca a causa que encontrei no código; se ainda cortar, preciso saber em que situação (ao abrir, ao testar, com a aba em segundo plano).
- **Movimento e som de verdade:** vi quadros parados e medi volume; não vi a cena girando nem ouvi nada.
- Conta que não é administrador (o bloco some por regra; não entrei com outra conta).
- Celular.
