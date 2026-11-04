# Relatório 2026-10-02-j — "Visualizar como" na barra lateral e entrar na conta de alguém da equipe

Front-end e a função de acesso `b7-auth` (publicada). Sem migration: nenhuma tabela, policy ou regra de RLS mudou.

> **Situação (02/10/2026).** Função `b7-auth` versão `2026-10-02-j` publicada e respondendo. Front no GitHub. O mecanismo foi provado no servidor e a tela foi testada com um servidor simulado; **o fluxo completo, com você logado, ainda não foi exercitado**.

## Resumo da atualização

- **"Visualizar como…" voltou para o rodapé da barra lateral** (continua também no menu da conta e no "Mais" do celular).
- Ao escolher alguém da equipe, agora há duas opções: **Só visualizar** (como já era: nada é salvo) e **Entrar na conta** (novo).
- **Entrar na conta** é de verdade: você passa a usar a sessão da pessoa, o que fizer é salvo e fica registrado no nome dela.
- Enquanto estiver na conta de outra pessoa, o rodapé da barra lateral mostra **"Você está como …"** e o botão **"Voltar para minha conta"**.

## Como funciona

1. Você escolhe a pessoa e clica em "Entrar na conta".
2. O servidor confere que quem pede é administrador e devolve uma sessão da pessoa escolhida. Não usa nem revela a senha dela.
3. A sua sessão fica guardada neste navegador para a volta, e a página recarrega já como a outra pessoa: menus, permissões, painel e autoria são os dela.
4. "Voltar para minha conta" encerra só aquela sessão e devolve a sua. A página recarrega como você.

## Travas e decisões

Você pediu que as ações fiquem registradas como se fossem da pessoa, e é assim que ficou. Em volta disso, coloquei quatro travas:

- **Só administrador.** A checagem é no servidor, com o papel lido do banco.
- **Conta de cliente, não.** O servidor recusa entrar em conta de cliente. O que um cliente aprova é registro da decisão dele; uma aprovação feita pela agência em nome do cliente seria um registro falso. Para ver o Portal continua existindo "Visualizar como" a empresa, que é só leitura.
- **Auditoria.** Cada entrada grava na tabela de auditoria quem entrou, na conta de quem e quando. O histórico do sistema mostra a pessoa; esse registro é o que permite saber depois que foi o administrador. Só o servidor lê essa tabela; não há tela para ela.
- **Presença intacta.** Entrar na conta de alguém não o faz aparecer "online agora" nem mexe no "último acesso" dele.

Outros cuidados:

- **Sair** de dentro da conta de outra pessoa volta para a sua conta. O "sair" comum derrubaria todas as sessões dela, em todos os aparelhos; isso não acontece.
- Antes de trocar de conta, o que estava sendo salvo é concluído, para nada seu sair no nome errado.
- Não dá para entrar em outra conta estando dentro de uma: primeiro volta.
- Outras abas do B7 abertas no mesmo navegador recarregam quando uma delas entra ou sai de uma conta, para nenhuma ficar mostrando uma pessoa e gravando como outra.
- Se a sessão da outra pessoa cair, o B7 volta sozinho para a sua conta ao recarregar.
- A sua própria conta e contas desativadas não aparecem na lista.

## Onde aparece

- **Barra lateral, rodapé (administrador):** botão "Visualizar como…".
- **Dentro da conta de outra pessoa:** no mesmo lugar, um bloco âmbar com a foto e o nome da pessoa e o botão "Voltar para minha conta". Com a barra recolhida, ficam a foto e o ícone de voltar.
- **Celular:** uma faixa no topo com o mesmo aviso e o mesmo botão.
- **Menu da conta:** "Sair da conta" vira "Voltar para minha conta".

## Arquivos

- `supabase/functions/b7-auth/index.ts`: ação `entrar_como`.
- `js/auth.js`: `entrarComo`, `voltarParaMinhaConta`, `naContaDeOutro`, `contaDeOrigem`; `sair` e `iniciar` cientes desse modo.
- `js/database.js`: `encerrarSessaoLocal`.
- `js/previa-usuario.js`: escolha entre visualizar e entrar; rodapé da barra lateral; faixa do celular.
- `js/presenca.js`, `js/topo.js`, `js/nav.js`: ajustes para esse modo.
- `index.html`, `styles/global.css`.
- `js/auth.js` versão `2026-10-02-j`; `sw.js` cache `v137`.

## Testes realizados

**No servidor, reais:**

- Antes de publicar, comparei a `b7-auth` em produção com a do repositório: idênticas.
- Mecanismo da sessão sem senha (função temporária, apagada depois), usando a **sua própria conta** como alvo: a sessão é criada, pertence à conta certa, o banco responde como ela, a sessão é revogada em seguida e o token deixa de valer. Presença não mudou.
- Depois de publicar: `ping` responde a versão `2026-10-02-j` com `entrar_como` na lista; `entrar_como` sem sessão é recusado (401); o caminho de login continua respondendo.

**Na tela, com servidor simulado (página local, apagada depois):**

- Administrador vê "Visualizar como…" no rodapé; a lista não traz a própria conta nem cliente.
- "Entrar na conta": erro do servidor aparece e nada muda; com sucesso, a página recarrega como a pessoa, com o bloco "Você está como…" e a sessão de origem guardada.
- "Voltar para minha conta" e "Sair" de dentro da conta: encerram só a sessão local, devolvem a sua e limpam o registro. O encerramento global não é chamado.
- Registro de volta velho: descartado quando a sessão já é a sua; conta de origem retomada quando a sessão da outra pessoa não vale mais.
- Quem não é administrador: bloco vazio e escondido; tentativa de entrar é barrada antes de chamar o servidor.
- Celular (390 px): faixa no topo visível, com o botão.

## O que NÃO foi testado

- **O fluxo real, logado:** entrar na conta de alguém pelo B7, fazer uma ação e ver a autoria; voltar.
- A recusa do servidor para **não administrador** e para **conta de cliente** (precisam de uma sessão real; a regra de administrador é a mesma das outras ações administrativas).
- O registro na auditoria gravado por uma entrada de verdade.
- O recarregamento das outras abas.
- "Só visualizar" depois desta mudança (o código dele não foi alterado, mas não foi exercitado).
- Celular de verdade, modo escuro.

## Observações

- Um administrador pode entrar na conta de **outro administrador**. Fica na auditoria, mas vale você saber.
- As notificações do sino, dentro da conta de outra pessoa, são as dela; marcar como lida marca para ela.
- A sessão guardada para a volta fica no armazenamento do navegador, como a sessão normal já fica.
