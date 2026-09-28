# Push: por que o aviso continuava feio, e como conferir agora
**Data:** 2026-09-28 · **Pacote:** `atualizacao-2026-09-28-g.zip`
**Arquivos:** `sw.js` (v97), `js/perfil.js`, `js/database.js`, `js/notificacoes.js`, `styles/auth.css`, `migration_notificacao_teste.sql`
**Migration:** `notificar_teste()` — **JÁ APLICADA** na produção.

## O diagnóstico
O `sw.js` publicado em `branding7dados-lab.github.io/sistema-b7/` **já estava com a versão nova** (v96, com o mapa de títulos e o badge). Conferido direto no ar. O que desenha a notificação, porém, não é o arquivo publicado: é o **service worker registrado no aparelho**. O Android continua usando o antigo até o navegador buscar o `sw.js` de novo — o que acontece quando o site é aberto/navegado (ou automaticamente em até 24h). Um aparelho que recebeu push sem ter reaberto o site depois do deploy mostra o formato velho.

Não há nada a corrigir no código por isso: o `sw.js` já tem `skipWaiting()` e `clients.claim()`, então assim que o arquivo novo é buscado ele assume na hora.

## O que mudou nesta rodada
**Botão "Enviar uma notificação de teste"** em *Meu perfil → Notificações*. Cria uma notificação de verdade para você mesmo e percorre o caminho inteiro (banco → Database Webhook → `b7-push` → aparelho). Serve para validar o push sem inventar demanda.

**Versão do service worker ativo**, ao lado do botão: `Aparelho rodando roteiros-b7-v97`. É a resposta do próprio service worker que está controlando a página — se aparecer uma versão antiga, aquele aparelho ainda não pegou a atualização e vai desenhar a notificação no formato velho.

Ambos também servem de diagnóstico permanente: push que não chega com o interruptor ligado aponta para permissão do aparelho ou inscrição morta; push que chega feio aponta para service worker velho.

## Como conferir no celular
1. Abra o sistema no celular e feche.
2. Abra de novo e vá em Meu perfil → Notificações: a linha deve dizer `roteiros-b7-v97`.
3. Toque em "Enviar uma notificação de teste" — deve chegar com título **"Teste do Sistema B7"** e a frase no corpo.

Se a versão ainda estiver antiga, force: Configurações do Chrome → Privacidade → Limpar dados de navegação → só "Imagens e arquivos em cache" para o site, ou remova e adicione de novo o atalho na tela de início.
