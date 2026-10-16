# Relatório — Ajuda e tutoriais dentro do sistema

**Versão:** `2026-10-16-zzz209` · **Cache:** `roteiros-b7-v412`
**Pedido (Kevin):** "eu achei q o tutorial seria dentro do sistema" — os tutoriais saíram numa página externa; agora vivem no sistema.

## O que mudou
- **Tela "Ajuda e tutoriais"** (`#/ajuda` e `#/ajuda/<tutorial>`): 38 tutoriais em 5 grupos (Primeiros passos e rotina; Clientes e planejamento; Produção; Comunicação e IA; Administração, aplicativos e ajuda) + "Por onde começar". Cada um: onde fica, quem usa, serve para, passo a passo numerado, dicas e cuidados, com "anterior/próximo". Busca por palavra (ignora acento) que filtra a lista.
- **Botão "?" no topo** (ao lado das conversas): abre direto o tutorial da tela atual (Painel, Panorama, Calendário, Clientes, Linhas, Roteiros, Status semanal, Oportunidades, Trends, Gravações, Edição de vídeo, Design, Produção, Aprovações, WhatsApp, Configurações, Usuários, Arquivados, Lixeira, TV, Suporte); em telas sem tutorial própria abre o índice. Na ajuda aparece "← Voltar para a tela em que eu estava".
- **Menu da conta:** novo item "Ajuda e tutoriais". A tela de Suporte ganhou o botão "Ver tutoriais" e a Ajuda tem "Falar com o suporte" e o link "Conte pelo suporte" no pé de cada tutorial.
- Para equipe interna (cliente não vê). No celular, índice e leitura alternam.
- **Conteúdo:** `js/ajuda-dados.js` (gerado dos tutoriais pesquisados no código de cada tela; sem termos técnicos nem endereços). Para mudar um texto, edite esse arquivo. Não usa banco e funciona sem internet.

## Banco de dados
Nenhuma mudança.

## Arquivos
`js/ajuda.js` e `js/ajuda-dados.js` (novos), `js/app.js`, `js/topo.js`, `js/permissoes.js`, `js/suporte.js`, `index.html`, `sw.js`, `styles/sistema.css`, `js/novidades.js`, `js/auth.js`.

## Testes
Sintaxe (`node --check`); em Node, com o navegador simulado: 38 tutoriais em 6 blocos, todos com passo a passo, identificadores únicos, e a busca do tutorial pela tela funcionou (vídeo → Edição de vídeo, gravacao → Gravações, tv → Painel de TV, suporte → Suporte e feedback, rota sem tutorial → nada). A parte visual não foi testada logada aqui.

## Observação
Os textos vêm da leitura do código; os pontos que não deu para confirmar na tela foram retirados do texto (ex.: botão para desfazer "Concluir gravação", item "Arquivos", Meu dia no computador). A página externa publicada antes continua existindo, mas a versão oficial agora é a do sistema.
