# zzz176 — WhatsApp: grupos reconhecidos, cartão do cliente, esperando resposta e visual

## Leitura (só leitura) — `app-desktop/preload-whatsapp.js`
- Lista de conversas (`#pane-side`), com nome, prévia, autor, se a última mensagem foi nossa (ícone de visto), não lidas (aria-label) e hora → `ultima_em`. É enviada ao sistema sempre que muda (MutationObserver com espera de 1,2 s, e a cada 1 min).
- Conversa aberta: título e as últimas 14 mensagens (`data-pre-plain-text`, `.message-in/.message-out`).
- `escanear`: rola a lista do começo ao fim e lê todos os grupos, voltando à posição de antes depois.
- Nada é clicado nem enviado.
- Testado com uma réplica da tela do WhatsApp: lista, conversa e escaneamento corretos.

## Programa — `app-desktop/whatsapp.js`
- Cantos arredondados (`setBorderRadius`) e CSS leve por cima do WhatsApp (barras de rolagem).
- Encaminha a leitura para o site (`b7:wa:conversas`, `b7:wa:conversa`) e tem as ações novas `b7:wa:escanear` e `b7:wa:abrir-grupo`.

## Banco — `migration_whatsapp_grupos.sql` (aplicada, só acrescenta)
- Tabela `whatsapp_grupos` (nome, cliente, tipo, conferido, ignorar e estado da última mensagem), com leitura só pela equipe interna e tempo real.
- RPCs `whatsapp_grupos_sincronizar` e `whatsapp_grupo_vincular`.

## Sistema — `js/whatsapp.js`
- **Casamento grupo → cliente:**
  - O nome do grupo é dividido em partes pelos separadores ( - | : ).
  - Em "Suporte X - …", o X é o pacote e não casa como cliente.
  - Grupos internos (interno, equipe, "(você)", concluídos, produção b7) ficam de fora.
  - Ligado sozinho: quando o nome inteiro do cliente aparece e só um cliente casa.
  - Sugestão: casamento parcial, a conferir em "Conferir grupos".
  - O tipo é o nome do grupo sem o nome do cliente (ex.: "Suporte B7-3X", "Artes · Loja").
  - Testado com os 23 clientes reais: Infinite Fio, C6 Farma, AutoEscola Modelo, Águas Mucugê e Sabor da Feira ligam sozinhos. Mercato e Óticas ficam como sugestão. Núcleo7 Social Interno e "Suporte Núcleo7 - Ninno" não casam.
- **Painel ao lado** (liga e desliga, preferência guardada):
  - cartão do cliente com vídeos, design e gravações pendentes;
  - atalho para enviar no grupo;
  - "possível aprovação" por palavras-chave nas mensagens do cliente;
  - lista "esperando resposta" (mais de 15 min, até 3 dias), com aviso do Windows depois de 1 h, uma vez por mensagem;
  - ligar ou ignorar um grupo sem cliente.
- **"Conferir grupos":** lista de sugestões e grupos ligados, com busca, "todas as conversas" e "Procurar todos os grupos" (escaneamento).
- **Enviar no WhatsApp:** se o cliente tem vários grupos, aparecem para escolher (Suporte, Artes…).
- **Visual:**
  - barra nova, entrada suave (o WhatsApp entra depois da animação da tela, sem pulo);
  - o carregando pulsa;
  - os avisos (toasts) sobem para a faixa da barra, porque ficavam atrás do WhatsApp.
- As partes novas precisam do programa 1.0.20 ou mais novo. Nos programas antigos, a tela continua como antes, sem o painel.

## zzz177 — regra do nome e tela "Grupos do WhatsApp" refeita
- **Regra do Kevin:** o cliente é o nome DEPOIS do traço, ou o grupo inteiro é o nome do cliente. O que vem antes do traço é o tipo (por exemplo, "Suporte B7 Start").
  - O casamento compara também sem espaços ("Auto Escola Sudoeste" = "AutoEscola Sudoeste").
  - "Suporte <pacote>" nunca casa como cliente.
  - Fora da regra (ex.: "ARTES MERCATO - LOJA"), vira só sugestão.
- **Ligação automática:** agora vale para todos os grupos conhecidos, e não só os que mudaram. Os grupos que ficaram como sugestão pela regra antiga se ligam sozinhos na próxima leitura.
- **Tela refeita:**
  - filtros Para conferir / Ligados / Ignorados / Todas;
  - cada grupo virou um cartão com o nome inteiro, o cliente e o tipo;
  - "Ignorar" e "Voltar a usar";
  - contador de alterações.
  - As classes `.sug`, `.ok` e `.ign` colidiam com estilos de impressão (era isso que deixava as letras espaçadas e a borda tracejada) e foram renomeadas.
- **Dado corrigido:** o tipo de "Suporte B7-3X - Infinite Fio Conquista" passou de "Suporte B7-3X · Conquista" para "Suporte B7-3X".
