# v4.6.0: vídeo sem responsável e gravação sem data

O Kevin pediu: "faça os dois". São as duas sugestões que saíram dos dados de 05/11: 4 vídeos sem responsável e 7 gravações sem data.

## O que mudou (`supabase/sql/migration_sem_dono_sem_data.sql`, aplicada)
1. **`_video_sem_dono_avisar()`** roda nos dias úteis às 8h, com no máximo um aviso por dia.
   - Pega os vídeos abertos sem responsável há mais de 1 dia e manda um único aviso para a coordenação, com até 3 títulos e o total.
   - O aviso traz a sugestão de **quem tem a menor fila aberta** entre os editores ativos (`videomakers_elegiveis`).
   - Link: Produção de Vídeo.
2. **`_gravacoes_sem_data_avisar()`** roda nos dias úteis às 8h, uma vez por gravação.
   - Pega as gravações criadas há mais de 3 dias, sem data, que não estão canceladas nem arquivadas.
   - Avisa quem grava (responsável + quem grava junto) ou, se não houver ninguém, a coordenação.
   - Mensagem: "Falta marcar a data: Cliente · Nome", com link para a gravação.
3. As duas funções entraram em `notif_verificar_agendados`, na hora das 8h.

## Conferência
- Ensaio no banco, com reversão:
  - saiu o aviso "2 vídeos sem responsável", com os dois títulos e a sugestão do editor com a menor fila (9 vídeos);
  - saíram 5 lembretes de "Falta marcar a data".
  - Esses números são menores que os de antes (4 e 7) porque só contam o que passou do tempo de tolerância: 1 dia para vídeo e 3 dias para gravação.
- `npm test` passou.
