# Relatório — zzz211 · O assistente de IA lê os tutoriais

## Como funciona
1. Na tela do chat (js/ia-chat.js), se a mensagem parece dúvida de uso ("como", "onde", "cadê", "não acho/consigo", "tutorial"…), a busca da Ajuda (`B7.Ajuda.procurar(texto, true)`, modo "a maioria das palavras") escolhe até 3 tutoriais. Só os **ids** vão no pedido (`ajuda_ids`).
2. O servidor (`_shared/ia/chat.ts`) aceita só ids que existem na cópia `_shared/ia/ajuda.ts` e junta o texto deles à pergunta, num bloco "TUTORIAIS DO SISTEMA". Nova regra 2c: dúvida de uso → responder pelo tutorial, com os nomes exatos; sem tutorial que sirva → não inventar e sugerir o Suporte.
3. A resposta devolve `tutoriais: [{id, titulo}]`; a tela mostra "Abrir tutorial" para os que a resposta cita. Em conversa reaberta, os títulos citados entre aspas junto da palavra "tutorial" viram o mesmo botão.

## Cópia dos tutoriais para o servidor
- `testes/ajuda-ia.mjs` gera `supabase/functions/_shared/ia/ajuda.ts` a partir de `js/ajuda-dados.js`.
- `npm test` roda `ajuda-ia.mjs --conferir`: se alguém mudar um tutorial e esquecer de regerar, o teste falha.
- A função b7-ia é publicada sozinha pelo workflow `funcoes` quando `supabase/functions/` muda na main.

## Também
- Busca da Ajuda ignora mais palavras soltas (pra, fica, botão, tela, sistema…).

Versão 2026-10-17-zzz211 · cache roteiros-b7-v414. Sem mudança no banco.
