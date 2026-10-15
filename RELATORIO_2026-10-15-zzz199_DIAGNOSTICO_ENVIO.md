# zzz199 — Diagnóstico do envio de arquivos pelo WhatsApp

Kevin segue sem conseguir mandar foto e vídeo. Sem ver a tela dele não dá para saber qual parte do WhatsApp Web mudou, então cada envio com arquivo agora deixa um registro em `whatsapp_diagnostico` (tabela nova, só escrita pela equipe via `whatsapp_diagnostico_registrar`):
- versão do programa, etapas (arrastar → editor abriu → clipe → arquivo posto), nomes dos arquivos, documento ou foto;
- o que havia na tela: campos de arquivo (accept, multiple, nome do item do menu), ícones do rodapé/diálogo, itens de menu, campos editáveis.
Com isso dá para corrigir o caminho certo na próxima rodada. Nada da conversa é gravado.
