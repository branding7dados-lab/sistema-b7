# Relatório — Suporte e feedback dentro do sistema

**Versão:** `2026-10-16-zzz208` · **Cache:** `roteiros-b7-v411`
**Pedido (Kevin):** "um sistema de suporte, de relatar bugs, feedback, enfim…"

## O que mudou
- **Onde fica:** menu da conta (foto no topo) → **Suporte e feedback** → tela `#/suporte`. Para toda a equipe interna (admin, coordenação, designer, videomaker). Cliente não vê (Portal pausado).
- **Novo chamado:** 4 tipos — **Problema**, **Sugestão**, **Dúvida**, **Elogio** (cada um com dica de como escrever). Campos: resumo, detalhes, "Está me impedindo de trabalhar" (só em Problema), até 3 prints (colar com Ctrl+V, arrastar ou escolher; reduzidos para ≤1600 px em JPEG) e "Enviar junto as informações da tela" (ligado por padrão, com "ver o que vai").
- **Informações da tela (automáticas):** tela atual, versão, onde roda (Programa de Windows / app de celular / app instalado / navegador), janela, perfil, conexão, últimos erros do JavaScript (só texto) e o rastro de entrada da sessão (este só a equipe vê no detalhe).
- **Lista e conversa:** "Meus chamados" para todos; admin/coordenação também veem "Todos da equipe". Filtros por andamento com contagem (Em aberto, Novos, Em análise, Em andamento, Resolvidos, Não será feito, Todos). Detalhe com descrição, prints, informações da tela, conversa e resposta. No celular, lista e detalhe alternam.
- **Equipe (admin/coordenação):** responder, **nota interna** (só a equipe vê), mudar **situação** e **prioridade** (baixa/normal/alta). Chamado urgente aparece destacado enquanto aberto.
- **Avisos no sino (e push):** novo chamado → admins e coordenação; resposta da equipe e mudança de situação → quem abriu; resposta de quem abriu → admins e coordenação. O aviso abre o chamado (`#/suporte/<id>`).

## Banco de dados (aplicado no projeto; `migration_suporte.sql`)
- Tabelas `suporte_chamados` (número sequencial, tipo, situação, prioridade, urgente, contexto, anexos) e `suporte_mensagens`; leitura só de quem abriu + admin/coordenação (notas internas só da equipe); escrita só pelas funções `suporte_criar`, `suporte_anexar`, `suporte_responder`, `suporte_status` (+ `_suporte_notificar` interna e `suporte_pode_arquivo`).
- Pasta privada `suporte` (5 MB, só imagem), acesso por chamado.
- Nada existente alterado.

## Arquivos
`js/suporte.js` (novo), `js/app.js`, `js/topo.js`, `js/permissoes.js`, `index.html`, `sw.js`, `styles/sistema.css`, `js/novidades.js`, `js/auth.js`, `migration_suporte.sql`.

## Testes
Sintaxe (`node --check`). No banco, em transação desfeita com uma designer e um administrador reais: criar chamado (urgente) → resposta da equipe → mudar para "em andamento/alta" funcionou; as 6 notificações saíram para as pessoas certas (3 admins/coordenação no novo, autora na resposta e na mudança); nada ficou gravado e a numeração voltou ao #1. A tela e o envio de print não foram testados logados aqui.
