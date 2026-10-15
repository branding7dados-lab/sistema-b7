# zzz185 — Enviar peças de design pelo WhatsApp

- **Site:** `B7.WhatsApp.enviar({ tipo: 'design' })` busca os arquivos da última versão não-rascunho (`design_arquivos`, papel final; se não houver, as prévias), gera URLs assinadas do bucket `design-files` e manda ao programa. Botão no painel lateral (peças fora da fila) e na peça aprovada pela B7 ("Enviar no WhatsApp").
- **Programa de Windows:** `b7:wa:enviar` aceita `urls` — baixa para a pasta temporária e anexa todas de uma vez como foto (não documento). `preload` expõe `enviaUrls: true`; programa antigo cai no "escolher arquivo".
- **Banco:** `whatsapp_envios.tipo` aceita `design` (aplicado).
- Status `aprovado_interno`/`aprovado_cliente` ganham nome legível no painel; itens do painel em cartões com selo de situação.
- **Precisa da versão nova do programa de Windows** para anexar sozinho.
