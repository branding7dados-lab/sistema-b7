# v3.1.3: o videomaker também muda a prioridade

Pedido do Kevin: "o videomaker tem que ter a permissão de mudar a prioridade também".

- **Banco (aplicado):**
  - `acoes.video.priorizar` agora tem o padrão `{coordenador,videomaker}` (antes era só `{coordenador}`).
  - A mensagem de recusa de `video_priorizar` virou "Você não tem permissão para mudar a prioridade dos vídeos." (antes era "Só a coordenação…").
  - Testado com reversão: um videomaker muda a prioridade de uma demanda com sucesso.
- **Tela (`js/video.js`):** `podePriorizar` vale para a equipe e para quem é videomaker, sempre sujeito à ação.
- Continua dando para tirar a permissão de alguém em **Configurações → Funções e permissões → "Definir a prioridade dos vídeos"**.
- **Avisos:** quando um videomaker sobe o próprio vídeo, ninguém é avisado (o aviso vai só para quem edita, e nunca para quem fez a mudança). Quando ele sobe o vídeo de outra pessoa, essa pessoa recebe o aviso como antes.
- Novidade só para videomakers.
- Arquivos atualizados: `migration_acoes.sql` e `migration_video_prioridade.sql`.
