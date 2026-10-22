# Relatório zzz231 — Streaming abre o sistema, Hiperespaço e abertura padrão

Pedido do Kevin:
> "quando ele dá aquela entrada tipo da Netflix, ele volta para logo da B7. Só que é tipo assim, para ele já abrir o sistema… adiciona mais outro tipo de abertura… uma opção em que eu possa escolher qual vai ser a abertura padrão do sistema para todo mundo, ou para uma pessoa só."

## 1. Streaming abre direto o sistema
- O logo não volta mais. Depois do mergulho, a abertura fica dentro das faixas de luz.
- As faixas ficam deslizando até o sistema estar pronto (com volta na tela, sem sumir pelo lado).
- Na saída, o céu escuro some em 0,5 s e as faixas **aceleram para fora por cima do sistema** que aparece. Não há voo do logo; a onda de luz que contorna as peças continua.
- Duração mínima: 3,6 s (antes 4,9 s). O som perdeu a assinatura e as notas das letras; o sopro vem em 3,3 s e a saída é o próprio fim.

## 2. Abertura nova: Hiperespaço (4,0 s)
| Tempo | Imagem | Som |
|---|---|---|
| 0–0,5 s | estrelas paradas no escuro | pedal grave e coral baixo |
| 0,5–1,7 s | as estrelas viram **riscos de luz** cada vez mais longos; a tela treme | o **motor** sobe de tom, ar e prato ao contrário |
| 1,72 s | **clarão do salto** | fôlego e impacto (sub-grave, boom, braam) |
| 1,75–2,3 s | a saída do salto: os riscos encolhem; o logo aparece no centro | sopro descendo, coral e sinos |
| 2,5 / 3,0 s | a palavra se escreve; um brilho passa pelo logo | uma nota por letra; cintilar e assinatura |
| 4,0 s | o logo voa para o lugar dele | saída |

Arquivos: `js/abertura-hiper.js` (novo), CSS `abHi*`, `ROTEIRO_HIPER` e `motor()` em `js/abertura-som.js`.

## 3. Abertura padrão (para todos ou para uma pessoa)
- **Configurações → Admin → Aparência do sistema → "Abertura do sistema"**:
  - um estilo para todo mundo, com botão "Testar";
  - e, se quiser, um estilo diferente para cada pessoa.
- Banco (`migration_abertura_padrao.sql`, aplicada):
  - `abertura_definir(jsonb)`: só administrador; valida os estilos e as pessoas;
  - `abertura_config()`: o administrador lê a configuração;
  - `sistema_avisos()` passa a devolver `abertura`, que é o estilo desta pessoa: o dela, senão o de todos.
  - Não é configuração crítica: qualquer administrador muda.
- Ordem do que vale num aparelho:
  1. a escolha da pessoa em Configurações → Aparência → "Estilo da abertura";
  2. se ela deixou em **"Padrão do sistema"**, o que o administrador definiu para ela ou para todos;
  3. senão, Streaming.
- Como a abertura é decidida antes de saber quem está entrando, o padrão é guardado no aparelho (`b7_ab_padrao`) toda vez que o B7 confere os avisos. **Vale a partir da próxima vez que a pessoa abrir o B7.**
- Testado no banco, dentro de uma transação desfeita no fim: Kevin recebeu o padrão de todos e Kaique recebeu o dele.

## Testes feitos
- Quadros do Hiperespaço.
- Saída do Streaming revelando o sistema.
- Tela de Configurações e janela "Abertura do sistema".
- Sem erros no console; `npm test`.

## Não testado
- Android real e programa de Windows.
- Uma pessoa real recebendo o padrão definido por você: depende de ela abrir o B7 duas vezes (na primeira o aparelho aprende, na segunda aparece).
