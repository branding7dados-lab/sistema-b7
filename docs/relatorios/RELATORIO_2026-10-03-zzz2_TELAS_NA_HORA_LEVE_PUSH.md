# Relatório — telas na hora, modo leve e notificações (pacote zzz2, 03/10)

Pedido: itens 1, 3 e 6 da lista de sugestões. São os três que atacam o que mais incomodava: o "carregando" ao entrar e sair das telas, as animações travando no Android e as notificações que não chegam.

## 1. Telas abrindo na hora (`js/memoria.js`)
Cada tela buscava tudo de novo no banco ao abrir e mostrava esqueleto. Agora as **leituras de listas e painéis** guardam a última resposta, na memória e no aparelho (IndexedDB, separado por conta).
- **Abrir uma tela** com resposta guardada: ela aparece na hora, sem esqueleto, e a busca de verdade vai ao banco por trás. Se a resposta nova vier diferente, a tela se redesenha sozinha, na mesma rolagem.
  - O redesenho só acontece se a pessoa ainda não tocou, digitou ou abriu nenhuma janela. Em telas com edição dentro, ele nunca acontece.
- **Depois de qualquer alteração** (criar, editar, excluir…) ou de um aviso em tempo real: a leitura seguinte espera o banco. A resposta guardada só é usada se a rede cair.
- **Puxar para atualizar** sempre vai ao banco.
- **Ficam de fora**, lendo sempre do banco: editor de roteiro, linha editorial, demanda aberta e status semanal.
- **Privacidade:**
  - sair da conta apaga a memória do aparelho;
  - conta de outra pessoa e simulação de papel ficam separadas;
  - o que está guardado vale no máximo 7 dias.

Teste (Chromium 390×844, banco simulado com 700 ms de atraso):

| Situação | Tempo até aparecer |
|---|---|
| Clientes, 1ª vez | 666 ms (o banco) |
| 2ª vez | 28 ms |
| Dado mudou no banco | 22 ms com o antigo; troca para o novo sozinha em seguida |
| Página recarregada | 48 ms (veio do aparelho) |

Sem erros.

## 3. Modo leve (`js/desempenho.js`, `styles/global.css`)
O que travava no Android era o vidro: cada desfoque de fundo redesenha tudo o que passa por baixo, a cada quadro. No modo leve:
- o vidro vira superfície sólida, na mesma cor;
- os desfoques das animações de entrada saem;
- o movimento continua igual.

**Configurações → Aparência → Desempenho** tem três opções:
- **Automático:** liga sozinho em Android simples (até 2 GB de memória ou até 4 núcleos) e também quando as trocas de tela travam de verdade. O app mede isso: 3 de 4 trocas com mais de 30% dos quadros atrasados. O aparelho guarda a conclusão.
- **Leve:** sempre.
- **Completo:** nunca.

A decisão é tomada antes da primeira pintura, então a tela não pisca. Teste: com o modo leve ligado, o desfoque fica desligado em toda a página.

## 6. Notificações
O diagnóstico no banco mostrou duas causas:
1. **Quase ninguém tinha o push ligado.** Só 3 aparelhos da equipe toda estavam inscritos. Os avisos para os outros ficavam como "sem_inscricao".
2. **O envio ia com prioridade "normal".** O Android em repouso segura esse tipo de aviso até o celular ser acordado.

O que mudou:
- **Função `b7-push`, versão 8, já no ar:** os avisos saem com prioridade **alta** e chegam na hora.
- **`B7.Push.manter()`, a cada login:**
  - se a permissão já foi dada, confere a inscrição do aparelho e, se ela sumiu ou ficou velha, refaz sem perguntar nada;
  - quem ainda não ativou recebe um convite com o botão "Ativar", no máximo uma vez por semana. A permissão só é pedida depois do toque.
- Desligar o push num aparelho é respeitado: ele não volta a ser ligado sozinho.

## Não testado
- celular físico;
- dados reais (o banco não é acessível daqui);
- a medição automática de travamento num Android de verdade.
