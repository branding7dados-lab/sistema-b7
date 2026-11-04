# Relatório — Assistente: voz transcrita pela IA

**Versão:** `2026-10-08-zzz126` · **Cache:** `roteiros-b7-v331`
**Pedido:** o ditado da zzz125 "não ficou muito legal": entendia as palavras "meio embolado", diferente do Claude, que transcreve quase perfeito.

## O que mudou
O microfone do assistente deixou de usar o ditado do navegador. Agora ele **grava a sua fala e a IA do B7 transcreve**.

- **Toque 1:** começa a gravar. Aparece uma faixa acima do campo com o tempo ("Gravando 0:07 · toque no microfone para terminar") e um "Cancelar".
- **Toque 2:** para, mostra "Transcrevendo o que você falou…" e, alguns segundos depois, o texto entra no campo.
- **Nada é enviado sozinho:** você lê, corrige e envia. Se já havia texto no campo, a fala entra depois.
- Até **2 minutos** por gravação (para sozinho ao chegar lá).
- Fechar o assistente ou enviar uma mensagem no meio descarta a gravação.

**O que melhora em relação ao ditado do navegador**
- A transcrição vem com pontuação, acentos e maiúsculas.
- A IA recebe a lista dos seus clientes como vocabulário, então escreve "Arena Deck" e "Mais Sorrisos" na grafia certa.
- Tira "ééé", "hum" e palavra repetida por engano.

**O que muda para pior**
- O texto não aparece mais enquanto você fala: só depois de parar. No teste, cerca de 6 a 7 segundos para um áudio de 16 segundos.
- Cada transcrição é um pedido à IA: conta no limite de uso (8 por minuto, 80 por hora por pessoa) e na cota gratuita.

## Privacidade
- O áudio **não é guardado**: sai do navegador, passa pela função do B7, vai ao provedor da IA e some. No registro de uso fica só o tamanho, como nas outras tarefas.
- O áudio vai para o mesmo provedor que já recebe os textos da IA, na camada gratuita.

## Onde funciona
Em navegador que grava áudio (Chrome, Edge, Firefox, Safari recentes). Navegador que não grava cai no ditado antigo da zzz125. Na primeira vez o navegador pede permissão para o microfone.

## Arquivos alterados
`supabase/functions/_shared/ia/voz.ts` (novo), `supabase/functions/b7-ia/index.ts`, `supabase/functions/_shared/ia/` (`gemini.ts`, `servico.ts`, `provedor.ts`, `omniroute.ts`) — função publicada; `js/ia-chat.js`, `js/ia.js`, `styles/ia-chat.css`, `sw.js`, `js/auth.js` (versão). Nada no banco.

## Testes executados
Função publicada, sessão real, app local. **O áudio de teste foi uma voz sintética do Windows em português**, não uma pessoa falando:
- frase ditada: "Crie duas demandas para a Arena Deck, um flyer animado da Misturinha na Deck e outro da Noite do Pop Rock, com prazo para sexta-feira. Depois me diga o que está atrasado na Mais Sorrisos.";
- transcrição recebida: igual, com pontuação, "Arena Deck" e "Mais Sorrisos" certos (só "misturinha" e "noite do pop rock" vieram em minúsculas);
- dois formatos de áudio: o que o Chrome grava (webm/opus, 58 KB) e mp4/aac (91 KB); os dois funcionaram, em 6,5 a 6,7 s;
- pela tela, com um microfone simulado tocando esse áudio: botão vermelho e faixa "Gravando 0:02…" → "0:17" → "Transcrevendo…" com o botão travado → o texto entrou no campo depois do "Oi." que já estava lá; **nenhuma mensagem foi enviada**; conferido em captura.

## Não testado
- **Uma pessoa falando de verdade**, com ruído, sotaque e fala rápida. A voz sintética é limpa demais para servir de prova; a qualidade real só você confirma.
- Celular (Android e iPhone) e o app instalado.
- Microfone negado, gravação muito curta, áudio sem fala e o limite de 2 minutos (os avisos estão escritos, não exercitados).
- "Cancelar" durante a gravação.
- Tema escuro.

## Rastros do teste
Três transcrições na cota gratuita. Os áudios de teste foram apagados da pasta do projeto.
