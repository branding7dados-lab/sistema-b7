# zzz245: perfil dentro das Configurações

Pedido do Kevin: "vamos melhorar o sistema de perfil, inclusive, as opções de perfil da configuração levam sempre pra mesma tela..."

## O que estava acontecendo
As três linhas da seção Conta ("Foto e nome", "Senha e verificação em 2 etapas" e "Avisos e notificações") e o cartão da conta abriam a mesma janela de perfil por cima das Configurações. Só a aba inicial mudava.

## O que mudou
- **`js/perfil.js`:**
  - O conteúdo virou peças: `htmlConta`, `htmlSeg` e `htmlNotif` montam a tela, e `ligarConta`, `ligarSeg` e `ligarNotificacoes` ligam os botões. Nenhuma regra mudou.
  - `B7.Perfil.montar(alvo, 'conta'|'seg'|'notif')` desenha uma parte do perfil dentro das Configurações.
  - `B7.Perfil.abrir(secao)` leva a equipe para a seção certa das Configurações (`#/config?s=conta|seguranca|notificacoes`). A janela com abas continua só para o cliente, que não tem Configurações.
  - Ao salvar a foto ou o nome, o cartão da conta no alto do menu é atualizado na hora.
- **Configurações (`js/dashboard.js`)**, no bloco Você:
  - **Perfil:** foto (avatar grande ao lado da área de escolher), nome, dados definidos pela Branding7 e Sessão (sair).
  - **Senha e segurança:** trocar senha, verificação em 2 etapas e Google.
  - **Notificações:** neste aparelho, testes e "O que te avisa".
  - O cartão da conta leva para Perfil.
  - A busca de ajustes também encontra textos dessas seções.
- **Visual (`styles/dashboard.css`, CONFIGURAÇÕES 10):** igual ao miolo das Configurações (cartões de borda fina, títulos grandes, sem ícones), com as chaves ligadas no degradê da B7.
- **Atalhos:** "Meu perfil" no menu da foto e o atalho de preferências do sino levam às seções.

## Versão
VERSAO `2026-10-22-zzz245`, CACHE `roteiros-b7-v447`, novidade `v-zzz245`.
