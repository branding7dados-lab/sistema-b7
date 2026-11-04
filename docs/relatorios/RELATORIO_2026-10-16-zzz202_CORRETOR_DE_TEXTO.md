# Relatório — Corretor de ortografia e gramática (WhatsApp e chat)

**Versão:** `2026-10-16-zzz202` · **Cache:** `roteiros-b7-v405`
**Pedido:** "quando eu escrevo uma mensagem no WhatsApp, ou no chat de Conversas, ele vai melhorar a ortografia e a gramática."

## Como funciona
- **Quando:** só na hora de enviar (nunca enquanto digita). Ligado por padrão, por pessoa.
- **Chat de Conversas:** ao enviar (Enter/botão), o texto passa pela IA e o que sai já vai corrigido (vale também para legenda de arquivo e edição de mensagem). Botão **✨** ao lado do campo liga/desliga. O campo fica esmaecido por instantes enquanto corrige; se continuar digitando nesse meio-tempo, nada é enviado pela metade.
- **WhatsApp (programa de Windows):** ao apertar Enter ou o botão de enviar, o programa lê o texto do campo (emojis incluídos), pede a correção à tela do sistema, troca o texto no campo e só então assina (`*Nome:*`) e envia. Chave **"Corrigir texto"** na barra do WhatsApp. Se o editor do WhatsApp não aceitar a troca, o texto original é devolvido.
- **Regras da IA:** corrige só ortografia, acentuação, pontuação, concordância e erros claros; mantém sentido, tom informal, gírias leves, emojis, quebras de linha, links, números, nomes e marcações (*negrito*). Texto correto volta idêntico. Pedidos dentro do texto não são cumpridos (é só dado a revisar).
- **Segurança de fluxo:** qualquer falha (IA desligada, sem internet, 7–9 s de demora, resposta com tamanho muito diferente do original) envia o texto ORIGINAL. Mensagens com `@menção` no WhatsApp, menores que 4 letras ou só com link/emoji/número não são corrigidas.
- Usa a mesma IA e a mesma chave "chat" de Configurações → Administração (desligada lá, desliga aqui).

## Backend
`b7-ia`: nova operação `corrigir` na tarefa `whatsapp` (`_shared/ia/whatsapp.ts`: validação até 2000 caracteres, prompt de revisor, limpeza que não mexe em aspas/negrito, temperatura 0,1). Registro de uso de sempre (metadados, nunca o texto). **Precisa do deploy da função** (workflow `funcoes.yml`) para funcionar.

## Banco de dados
Nenhuma mudança.

## Arquivos
`js/corretor.js` (novo), `js/conversas.js`, `js/whatsapp.js`, `app-desktop/preload-whatsapp.js`, `app-desktop/whatsapp.js`, `supabase/functions/_shared/ia/whatsapp.ts`, `supabase/functions/b7-ia/index.ts`, `styles/conversas.css`, `index.html`, `sw.js`, `js/auth.js`, `js/novidades.js`.
No WhatsApp do Windows é preciso **atualizar o programa** (o preload fica dentro dele); o chat de Conversas atualiza com o site.

## Testes
Sintaxe de todos os JS (`node --check`); validação/prompt/limpeza do servidor executados em Node (texto vazio e operação inválida recusados; limpeza preserva `*Kevin:*`). Não foi possível testar o WhatsApp Web real nem a IA ao vivo aqui: conferir depois do deploy escrevendo "oi td bem? vc pode mandar o vídeo hj" no chat e no WhatsApp.
