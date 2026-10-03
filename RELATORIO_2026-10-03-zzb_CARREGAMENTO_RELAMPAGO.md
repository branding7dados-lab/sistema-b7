# Relatório — carregamento ao recarregar, versão "relâmpago" (pacote zzb, 03/10)

Pedido: vídeo (Chrome Android, 5 s, puxar para atualizar nas Configurações) + "Deixa esse loading cinematográfico pq ele tá muito feião".

## O que o vídeo mostrou
Recarregar na mesma sessão mostra a versão **curta** da abertura:
- logo parado;
- "Preparando o seu espaço…" com uma barrinha;
- na saída, uma **bola branca** crescendo sobre o logo. No tema claro, a "íris" abria um buraco por onde aparecia a tela branca.

## O que mudou (`styles/global.css`, bloco ABERTURA; `js/app.js`)
A versão curta virou uma abertura em ~1 s, com a mesma linguagem da completa:

| Tempo | O quê |
|---|---|
| 0–0,45 s | a lâmpada sai do escuro e do desfoque; o palco entra com um leve "soco" de escala |
| 0,40 s | **acende**: mesmo clarão cromático da completa, onda de luz e bloom saindo da lâmpada, flare horizontal, clarão da tela |
| 0,30–0,80 s | "Branding7" se escreve |
| 0,95 s → | se ainda carrega: **um brilho passa pelo logo a cada 1,8 s** e a lâmpada respira. O próprio logo é o indicador, sem barrinha |
| 1,8 s → | só se a espera for real, aparece a frase "Preparando o seu espaço…" (antes: 0,5 s) |

- **Saída no tema claro:** o céu esmaece. Não há mais o buraco de íris que virava uma bola branca. No escuro, a íris continua.
- **Mínimo da versão curta:** 0,35 s → 0,95 s, o tempo da lâmpada acender e o logo se escrever. No celular, recarregar já leva isso. A completa (1ª vez na sessão) continua 4,3 s.
- Sem som na curta (o som é só da completa).
- "Reduzir movimento": sem clarão, onda, flare e brilho.

Nada de dados, regras ou banco.

## Testes executados
Navegador do app, 390×844, cortina montada a partir do próprio `index.html` e quadros congelados (`getAnimations` + `currentTime`):
- **0,42 s:** lâmpada no clarão cromático, onda, flare, bloom; "Branding" se escrevendo. Problema achado: a onda nascia do centro do logo, então foi deslocada para a lâmpada (`translate: -var(--ab-dx)`).
- **0,52 s:** onda saindo da lâmpada, flare e logo completo.
- **1,28 s:** brilho rosa e violeta atravessando "Branding7"; lâmpada acesa.

**Não testado:**
- a saída no tema claro (só revisada no CSS);
- o tempo real de recarregar no celular;
- celular físico.
