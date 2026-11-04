# zzz244: toda a administração dentro das Configurações

Pedido do Kevin: "aquele cartão da minha conta ta repetido ali n? a parte de administração (seja admin supremo, superadmin, admin) quero tudo nas configurações."

## Cartão da conta repetido
A seção Conta mostrava um segundo cartão com o nome, logo abaixo do que já aparece no alto do menu. Esse segundo cartão saiu. O perfil continua abrindo pelo cartão do menu e por "Foto e nome".

## Administração nas Configurações
- **Pessoas e acessos** (bloco Administração): a tela de Usuários e acessos (`B7.Usuarios`) é desenhada dentro da seção. A trilha e o título próprios dela ficam escondidos, porque o cabeçalho da seção já mostra "Administração · Pessoas e acessos". O grupo "Pessoas", que só tinha um link, saiu de "Equipe e acessos".
- **Super admin** (bloco Super admin): cada área virou uma seção. São elas: Painel do super admin, Pedidos para aprovar, Limites dos administradores, Segurança, Uso e backup, Avaliações do suporte e Supremo (só para o supremo).
  - O miolo vem do `B7.Super`, sem o cabeçalho e as abas próprios.
  - Os números clicáveis do painel levam à seção certa.
  - "Exportar backup" e "Restaurar" ficam embaixo de "Uso e backup".
- **Como funciona:**
  - `B7.Usuarios.abrir({ alvo })` e `B7.Super.abrir(aba, { alvo, irAba })` desenham dentro do elemento recebido.
  - Só uma dessas seções fica montada por vez; as outras são esvaziadas para não repetir ids.
  - No PC a seção carrega ao ser escolhida. No celular, ao entrar nela.
  - A atualização em tempo real de Usuários continua funcionando quando a tela está dentro das Configurações.
- **Endereços antigos:**
  - `#/super/<aba>` leva para `#/config?s=super-<aba>`;
  - `#/usuarios` leva para `#/config?s=pessoas` (mantém `pedidos=1`);
  - os avisos do servidor (`#/super/aprovacoes`, `#/super`) continuam funcionando;
  - o menu da conta (Super admin, Usuários e acessos) abre as seções.
- **Ajuda:** atualizei o "onde fica" de Usuários e acessos e regenerei as cópias da IA (`_shared/ia/ajuda.ts` e `ajuda_admin.ts`).

## Versão
VERSAO `2026-10-22-zzz244`, CACHE `roteiros-b7-v446`, novidade `v-zzz244`.
