# zzz261 — Portal do cliente: papéis Dono, Gestor e Equipe

Pedido do Kevin: dois clientes querem login. Precisava de usuários e acessos do lado do cliente (dono, gestor…).
Escolhas dele: os 3 papéis; logins criados pela B7 **e** pelo Dono (B7 avisada); revisão do portal de ponta a ponta.

## Banco (`migration_cliente_papeis.sql`, já aplicada)
- `perfil_clientes.papel` (`dono` | `gestor` | `equipe`, padrão `gestor`) e `convidado_por`: o papel é **por empresa**.
- `perfis.senha_provisoria`: conta de cliente nasce com ela; some quando a pessoa troca a senha.
- `aprov_pode_decidir`: aprova a equipe da B7 ou quem é **dono/gestor** daquela empresa (antes: `perfis.pode_aprovar`).
- `minhas_empresas()` e a view `minha_sessao` trazem o papel em cada empresa e `senha_provisoria`.
- `cliente_pessoas(client)` (dono ou equipe B7), `cliente_definir_papel(client, perfil, papel)` (só dono/admin; a empresa
  nunca fica sem dono), `_cliente_avisar_b7` (notifica os administradores).
- Nenhuma conta de cliente existia ainda: não houve dado para converter.

## Função `b7-auth`
- Novas ações do dono (conferido no banco que ele é dono daquela empresa e que o serviço está ativo; admin também pode):
  `cliente_convidar` (gera usuário a partir do nome e senha provisória de 12 caracteres), `cliente_nova_senha`
  (não mexe em conta ligada a outra empresa) e `cliente_remover` (tira o vínculo; sem empresa nenhuma, a conta é desativada).
  Todas auditadas e avisam a B7.
- `criar_usuario`/`alterar_conta` aceitam `empresas: [{client_id, papel}]` (o formato antigo segue valendo) e preservam o
  papel de quem já estava ligado. `listar_usuarios` devolve o papel nos vínculos.
- `minha_senha`/`meu_perfil` limpam `senha_provisoria`; `redefinir_senha` de cliente a marca de novo.

## Telas
- Portal: item **Equipe** (só Dono) com a lista, papel, senha nova e tirar; convite mostra usuário/senha uma vez, com
  "Copiar mensagem" e "Mandar no WhatsApp". Faixa "Crie a sua senha" enquanto a senha é provisória.
- Aprovação: botões só para Dono/Gestor da empresa do material. Equipe vê "Aguardando aprovação", "Ver e comentar"
  e "Esperando a aprovação da empresa" no início.
- Meu perfil (portal e janela): o papel em cada empresa.
- Configurações → Pessoas: o interruptor "Pode aprovar" virou o papel em cada empresa marcada (nova empresa começa como Dono).

## Conferido
- Testes de tela (`npm test`) e capturas do portal como Dono, Gestor e Equipe, no PC e no celular.
- Banco: funções testadas numa transação desfeita como administrador.
