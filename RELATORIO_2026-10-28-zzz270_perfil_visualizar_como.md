# zzz270 — Perfil na barra lateral, status e "Visualizar como" para equipe e clientes

## Pedido do Kevin
- Tirar o perfil do topo e colocá-lo na barra lateral, acima do "Visualizar como" (aprovado a partir do desenho; o "Visualizar como" continua na barra).
- "Visualizar como" para pessoas da equipe **e dos clientes**, com duas opções: só visualizar ou entrar na conta — e sem a abertura/tela de carregamento a cada troca. Só administradores (admin, super admin, admin supremo).

## O que mudou
### Perfil na barra lateral (`js/perfil-lateral.js`, `styles/nav.css`)
- Cartão no pé da barra (foto, nome, função, status com bolinha colorida). No computador o avatar do topo some; no celular continua no topo (a barra é gaveta) e o painel abre como folha.
- Painel: topo com "Editar perfil"; **Meu status** (Disponível, Em gravação, Em reunião, Ausente, Não perturbe + recado de até 80 letras); **Meu dia** (para hoje, atrasadas, gravações de hoje — cada número leva à tela); atalhos (configurações, super admin, tema, ajuda, suporte, atalhos de teclado, sair/voltar).
- Banco (`migration_perfil_status.sql`, aplicada como perfil_status_1): `perfis.status_presenca`, `status_recado`, `status_em`; `meu_status_definir`; `meu_dia()`; `em_silencio` passa a valer também no "Não perturbe" (avisos guardados no sino, sem push/som, resumo ao voltar — o caminho do horário de silêncio).

### Visualizar como (`js/previa-usuario.js`, `js/portal.js`, b7-auth)
- Lista com três grupos: Equipe B7, Pessoas dos clientes (com empresa e papel) e Empresas.
- Pessoa → escolha **Só visualizar** (equipe: prévia existente; cliente: prévia do Portal com o papel dela — gestor/equipe/dono decide o menu e o "pode aprovar") ou **Entrar na conta**.
- `b7-auth` (`entrar_como`): agora aceita conta de cliente (continua só administrador, respeitando a trava de super admin, e anotado na auditoria). Versão `2026-10-28-entrar-como-cliente`.
- No Portal, dentro da conta de um cliente: faixa "Você está na conta de …" e "Voltar para minha conta".
- **Troca sem abertura**: entrar/voltar marca `b7_troca_rapida`; o `index.html` liga `html.ab-sem` — a cortina vira um fundo liso com um carregador pequeno, sem a sequência, sem som e sem esperar o tempo mínimo da abertura.

## Testes
- `npm test` verde.
- Prints: cartão e painel (escuro e claro), lista do "Visualizar como" com os três grupos, escolha de modo e a prévia "como Marina (Gestor)".
- Banco: `meu_dia()` como o Kaique (1 aberta, 1 atrasada); `em_silencio` com o trecho do "Não perturbe".

## A conferir com contas reais
- Entrar na conta de um cliente de verdade e voltar (depende da função b7-auth publicada pelo GitHub ao juntar).
