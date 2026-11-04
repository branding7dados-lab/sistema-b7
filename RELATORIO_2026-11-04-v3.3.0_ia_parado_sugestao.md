# v3.3.0: IA mais rápida no chat, aviso de trabalho parado e prioridade sugerida

Itens 4, 6 e 7 da lista de melhorias aprovada pelo Kevin.

## 4. IA mais rápida no chat
- **Antes:** o chat manda de 6 a 11 mil tokens (os dados do sistema vão junto). Por isso passava do limite do Groq rápido (6 mil) e ia sempre para o Gemini, que leva de 1 a 6 s e às vezes travava.
- **Agora** (`_shared/ia/duplo.ts`, `servico.ts`, `groq.ts`): entre os dois há um **modelo grande do Groq** (`GROQ_MODELO_GRANDE`, padrão `meta-llama/llama-4-scout-17b-16e-instruct`, com limite por minuto bem maior na camada gratuita). Ele atende pedidos de até `GROQ_LIMITE_GRANDE` tokens (padrão 24 mil).
- Se ele recusar (limite do minuto, modelo retirado, fora do ar, resposta fora do formato), o mesmo pedido vai ao Gemini, como antes. No fluxo, só troca se nada foi escrito na tela ainda.
- Legendas, revisão de marca, áudio e imagem continuam no Gemini. `GROQ_MODELO_GRANDE=nenhum` desliga o modelo grande.
- Teste novo: `testes/duplo.test.mjs` (pequeno → rápido, chat → grande, enorme → Gemini, grande no limite → Gemini, fino → Gemini).
- **Observação:** não deu para chamar o Groq daqui (a chave fica só nos segredos). O registro `ia_uso` vai mostrar qual modelo atendeu e se houve troca.

## 6. Aviso de trabalho parado (`migration_trabalho_parado.sql`, aplicada)
- `trabalho_parado(dias)` lista, por pessoa, o que está com ela sem nenhuma mudança há 5 dias ou mais: vídeo pendente/em edição/correção e design aguardando produção/em criação/ajustes. Clientes de teste ficam de fora.
- Todo **dia útil às 8h** (`notif_verificar_agendados`):
  - **cada pessoa** recebe "N trabalhos parados (até X dias)" com os 3 mais antigos;
  - a **coordenação** (e administradores com "atrasos" ligado) recebe o resumo, com link para Gestão → Equipe.
- Um aviso por dia, sem repetir. Categorias: `prazos` (pessoa) e `escalados` (resumo). `video.prioridade` também entrou em `prazos`.
- Hoje a lista dá **20 peças de design com a mesma designer, a mais antiga há 15 dias**. Testado com reversão: saíram o aviso pessoal e o resumo para a coordenação e os administradores.

## 7. Prioridade sugerida (`js/video.js`, `styles/video.css`)
- No quadro de Prioridade, quem pode priorizar vê uma faixa "💡 N sugestões de prioridade":
  - **atrasado** e não urgente → Urgente;
  - **vence em até 2 dias** e Normal → Alta.
- Cada cartão sugerido ganha um selo ("Sugestão: Alta · vence em até 2 dias").
- **Aplicar** coloca cada sugerido no topo da faixa nova, os mais atrasados primeiro, pela mesma `video_priorizar` (histórico e aviso ao videomaker como sempre).
- **Agora não** esconde até fechar o app. Nada muda sozinho.
- Testado no navegador: duas sugestões aplicadas, fila renumerada e a faixa some.
