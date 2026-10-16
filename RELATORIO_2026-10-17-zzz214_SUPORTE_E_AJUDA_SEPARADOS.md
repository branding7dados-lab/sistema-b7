# Relatório — Suporte e Ajuda separados entre administração e equipe

**Versão:** `2026-10-17-zzz214` · **Cache:** `roteiros-b7-v417`
**Pedido:** tela de suporte da administração diferente da equipe; vídeos dos tutoriais pelo YouTube (sem encher o banco); tutorial da administração separado do da equipe; telas mais bonitas.

## Suporte: duas telas no mesmo lugar (`#/suporte`)
- **Equipe — "Como podemos ajudar?"**: faixa de cabeçalho com os quatro tipos em cartões (Problema, Sugestão, Dúvida, Elogio) em um toque; busca nos tutoriais antes de abrir chamado; "Seus chamados" como conversas (bolinha quando há resposta nova); "Ideias da equipe" na própria tela para votar. A conversa abre em página própria, com a linha do andamento e "Isso resolveu?".
- **Administração e coordenação — "Central de atendimento"**: números da fila (novos, urgentes, sem resposta há 24 h, em andamento, resolvidos em 7 dias, tempo médio para resolver) que filtram ao tocar; filas à esquerda (caixa de entrada, urgentes, sem resposta, em andamento, resolvidos, não será feito, todos), tipo e pessoa; lista no meio com selos (urgente, prioridade alta, "há N h sem resposta"); o chamado à direita com **andamento em um toque**, prioridade, respostas prontas, **Responder / Nota interna** e as informações técnicas. Aba **Ideias** com o ranking de votos e "Abrir".
- Mesmas funções do banco de antes; nada mudou em quem vê o quê.

## Ajuda: administração × equipe
- O administrador abre **"Como administrar o B7"** (cabeçalho escuro, abas **Administração** e **Tutoriais da equipe**) com **18 tutoriais novos** da administração em 5 assuntos: Pessoas e acessos; Atendimento da equipe; Cuidar do sistema; Aparência, recursos e textos; Gestão do trabalho (arquivo `js/ajuda-admin.js`). Lista "Para conferir primeiro" própria e sugestões de busca da administração.
- A equipe **não vê** os tutoriais só do administrador (Usuários e acessos, Lixeira, Visualizar como).
- **Tour** próprio da administração (Configurações → Admin, Panorama, avisos, menu da foto, Ajuda da administração); a equipe continua com o tour da função.
- Cabeçalho novo também na Ajuda da equipe.

## Vídeos: YouTube, sem arquivo no sistema
- No tutorial, o administrador cola o link do YouTube (pode ser "não listado") e salva; o vídeo aparece ali para todos (`youtube-nocookie`). Só o código do vídeo é guardado.
- O espaço de arquivos de vídeo criado na zzz213 (vazio, nunca usado) ficou fechado: sem permissão de envio e limite de 1 byte. O Supabase não deixa apagar o espaço por comando; dá para apagar pelo painel se quiser.
- Liberado o YouTube na regra de segurança do navegador (`frame-src`).

## Arquivos
`js/suporte.js` (telas refeitas), `js/ajuda.js`, `js/ajuda-admin.js` (novo), `js/tour.js`, `styles/sistema.css`, `index.html`, `sw.js`, `js/novidades.js`, `js/auth.js`.

## Testes
- Sintaxe de `suporte.js`, `ajuda.js`, `ajuda-admin.js`, `tour.js`.
- Na aba local, com chamados simulados: Central de atendimento (números, filas, lista, chamado aberto com andamento e resposta) e tela da equipe (capturas); Ajuda da administração com as abas e os 5 assuntos; tutorial com vídeo do YouTube tocando na tela e o campo do link para o administrador.

## Não testado
- Com os chamados reais e contas reais (responder, mudar andamento, votar).
- Celular.
