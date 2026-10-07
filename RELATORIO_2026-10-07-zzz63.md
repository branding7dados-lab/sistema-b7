# Relatório zzz63 — "Visualizar como…": busca no botão e entrada direta na conta (07/10/2026)

**Versão:** `2026-10-07-zzz63` · **Cache:** `roteiros-b7-v268`

## O que foi pedido
1. A pesquisa diretamente no botão "Visualizar como…" da barra lateral.
2. Estando na conta de alguém, aparecer "Visualizando como…".
3. A partir de agora, entrar na conta (não só visualizar), com acesso restrito a administradores.

## Auditoria antes de mexer
- Entrar na conta de outra pessoa já existia (`B7.Auth.entrarComo` → servidor `b7-auth`, ação `entrar_como`).
- A restrição a administradores já está no servidor: `entrar_como` está na lista de ações só de administrador, recusa conta de cliente, recusa conta inativa e anota cada entrada na auditoria com o nome de quem entrou. Nada disso foi alterado.
- Até aqui, escolher uma pessoa abria uma janela com duas opções ("Só visualizar" / "Entrar na conta").

## O que mudou
`js/previa-usuario.js` e `styles/global.css`. Sem mudança no servidor, no banco, em permissão ou RLS.

- **Busca no botão:** o botão da barra lateral virou um campo "Visualizar como…". Ao clicar, a lista de empresas e pessoas sobe acima dele; digitar filtra; Enter escolhe quando sobra um resultado; Esc ou clicar fora fecha.
- **Barra recolhida (só ícones):** continua o botão do olho, que abre o mesmo seletor em janela.
- **Entrada direta:** escolher alguém da equipe entra na conta na hora (a linha mostra "Entrando na conta…"). A janela "Só visualizar / Entrar na conta" foi removida — o modo "só visualizar" para pessoas da equipe deixou de ser oferecido.
- **Empresas:** continuam abrindo a prévia do Portal, somente leitura (o servidor não permite entrar em conta de cliente).
- **Texto:** dentro da conta de outra pessoa, a barra lateral e a faixa do celular dizem "Visualizando como" + nome (antes: "Você está como"). O botão "Voltar para minha conta" continua igual.
- O seletor do menu da conta e do "Mais" (celular) ganhou o mesmo comportamento de entrada direta.

## Atenção
"Visualizando como" descreve uma sessão de verdade: tudo o que for feito ali é salvo e fica registrado no nome da pessoa. O aviso "O que fizer fica registrado nesta conta" foi mantido.

## Testes realmente executados
No app local, com o arquivo novo carregado e as chamadas ao servidor substituídas por dados de exemplo (nenhuma conta real foi usada):
- o campo aparece no lugar do botão; ao focar, a lista abre com 2 empresas e 2 pessoas (a própria conta fica fora);
- digitar "kai" deixou só "Kaique Viana";
- clicar chamou a entrada na conta com o id certo e a linha mostrou "Entrando na conta…";
- nenhum erro de script.

## Não testado
- Entrar de verdade em uma conta e voltar (exige sessão de administrador real).
- A barra recolhida, o celular e a aparência com a barra lateral real.
