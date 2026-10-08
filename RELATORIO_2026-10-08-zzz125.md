# Relatório — Assistente: ditado por voz

**Versão:** `2026-10-08-zzz125` · **Cache:** `roteiros-b7-v330`
**Pedido:** "Eu queria a função de áudio também na IA, igual tem aqui no Claude."

## O que mudou
O campo de mensagem do assistente ganhou um **microfone**, ao lado do botão de enviar.
- Toca no microfone, fala, e o texto vai aparecendo no campo enquanto você fala.
- Toca de novo para parar. O botão fica vermelho e pulsa enquanto está ouvindo.
- **Nada é enviado sozinho:** o texto fica no campo para você ler, corrigir e enviar.
- Se já havia algo escrito, o que você ditar entra depois, sem apagar.
- Enviar a mensagem ou fechar o assistente para o ditado.

No computador o ditado continua até você parar. No celular ele pega uma frase por toque e para sozinho na pausa (no Android o modo contínuo repete trechos).

## Como funciona por baixo
Quem transforma a fala em texto é o **reconhecimento de voz do próprio navegador**. Não passa pela IA do B7, não gasta a cota dela e o sistema não guarda áudio nenhum.

Duas consequências:
- **Privacidade:** no Chrome e no Edge, o áudio é enviado ao serviço de voz do Google/Microsoft para virar texto. É o mesmo recurso de ditado que esses navegadores usam em outros sites.
- **Onde aparece:** só em navegador que tem esse recurso (Chrome, Edge, Safari). No Firefox o botão não aparece.

Na primeira vez o navegador pede permissão para usar o microfone.

## O que não foi feito
A IA **responder em voz alta** (leitura da resposta). O pedido foi entendido como ditar a pergunta; se quiser a resposta falada também, é outro passo.

## Arquivos alterados
`js/ia-chat.js`, `styles/ia-chat.css`, `sw.js`, `js/auth.js` (versão). Nada no servidor nem no banco.

## Testes executados
No app local, com um **reconhecimento de voz simulado** (o navegador de teste não tem microfone):
- o botão aparece entre o campo e o enviar, do mesmo tamanho;
- ao tocar: fica marcado como "ouvindo", o rótulo vira "Parar de ditar" e o campo ganha o contorno vermelho;
- texto parcial e depois o final entram no campo depois do que já estava escrito ("Já escrito crie uma demanda para a Arena Deck com prazo sexta");
- ao parar: o botão volta ao normal, **nenhuma mensagem foi enviada** e o texto ficou no campo;
- microfone negado: aparece "Permita o uso do microfone neste site para ditar." e o botão volta ao normal.

## Não testado
- **Falar de verdade num microfone.** A qualidade do ditado em português, a pontuação e o comportamento no seu celular só você consegue conferir.
- iPhone/Safari e o app instalado no Android.
- Tema escuro.
