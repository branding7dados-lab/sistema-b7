# Relatório — Onda de luz: a abertura constrói o app (pacote zzo, 03/10)

Pedido: "amei a animação de entrada, mas ainda falta um negócio fodástico"; esclarecido como "o conjunto: abertura + entrada".

## O que entrou
Quando a abertura sai (completa ou relâmpago), a luz da lâmpada **constrói o app**:
1. **Clarão:** a luz estoura para fora da lâmpada no centro da íris.
2. **Anel de luz:** um fio branco, com rosa e violeta em volta, corre pela borda da íris até as pontas da tela. Mesma duração e curva da íris que já existia (0,8 s).
3. **O app acende onde a luz passa:** o contorno de cada peça (topo, cabeçalho, cartão da semana, filtros, blocos e cartões da tela, barra de baixo) acende e se apaga no instante em que o anel a alcança, na ordem da distância. Bloco alto (lista, seção inteira) é dividido até o tamanho de um cartão. Até 34 peças.
4. **Pouso do logo:** quando o logo termina o voo e pousa no topo, sai dele uma onda curta.
5. **Som** (se o som da abertura estiver ligado): um sopro subindo junto com o anel e um cintilar no pouso, somados ao "assenta" que já existia.

Tudo numa **camada própria por cima** (contornos medidos na hora, sem clique). Não mexe nas animações de entrada de cada tela (o Painel tem as dele), então nada pisca nem briga. Tema claro com cores próprias (sem o efeito "screen", que sumiria no branco). "Reduzir movimento": nada disso aparece.

Arquivos:
- `js/app.js`: `ondaDeLuz`, `pecasDaOnda`, `tempoDaCurva`, `brilhoDoPouso`;
- `styles/global.css`: bloco ONDA DE LUZ;
- `js/abertura-som.js`: `aoSair`.

Nada de dados, regras ou banco.

## Testes executados
Navegador do app, 375×812, sessão simulada, tela Publicações do Dia, "Ver abertura" disparado pelo código. Painel do navegador oculto: usei quadros congelados.

| Teste | Resultado |
|---|---|
| Camada criada na saída | sim, com clarão e anel |
| Peças | 1ª versão: só 4 peças (blocos altos eram descartados). Corrigido com divisão recursiva: 7 peças na tela, atrasos de 40 a 399 ms, em ordem de distância |
| Alinhamento | 1ª versão: contornos ~20px abaixo (medidos depois do corpo começar a assentar). Corrigido medindo antes: contornos 74/135/291/337 = blocos reais 74/135/291/337 |
| Quadro em 260 ms (escuro) | anel no meio da tela, peças próximas acesas (captura) |
| Quadro em 620 ms (escuro) | contornos alinhados apagando (captura) |
| Quadro em 300 ms (claro) | anel rosa sobre o branco, contornos rosa (captura) |

**Não testado:**
- animação rodando em tempo real;
- som;
- celular físico;
- abertura de verdade depois do login (só a "Ver abertura").