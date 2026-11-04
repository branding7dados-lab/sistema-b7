# Relatório zzz225 — Super admin completo (os 14 itens do plano)

Pedido do Kevin: "Faz tudo" — os 14 itens do plano do super admin.

## Tela nova: Super admin (`#/super`, menu da sua foto → "Super admin")
Só aparece e só abre para super admin (o banco confere de novo em cada ação). Abas:

| Aba | O que tem |
|---|---|
| Painel | administradores (último acesso, 2 etapas ligada ou não, derrubar sessões), **o que aconteceu** nos últimos 30 dias (cofre de auditoria), chamados de administradores, aparelhos novos e contas paradas |
| Aprovações | pedidos dos administradores comuns, com Aprovar / Recusar (com motivo) e o histórico decidido |
| Limites | para cada ação: Livre / Pede aprovação / Só super admin |
| Segurança | 2 etapas de cada administrador, **derrubar todas as sessões**, alertas de aparelho novo |
| Uso e backup | banco e arquivos contra o limite gratuito, IA (30 dias, hoje, erros, tokens, por área), e-mails restantes na Brevo, avisos e contas, **baixar backup** |
| Avaliações | nota do assistente e da equipe, e a nota de cada pessoa que atendeu chamados |
| Supremo (só o Kevin) | **emergência**, **tirar o administrador de alguém**, **passar o cargo de supremo** com código no e-mail |

## Itens
1. **Painel do super admin** — acima.
2. **Limites para administradores** — `sistema_config.limites_admin`. Padrão: criar contas e mudar acessos *livre*; excluir conta *pede aprovação*; entrar como *livre*; excluir cliente *pede aprovação*; política de 2 etapas *pede aprovação*; configurações críticas *só super admin*. Vale no servidor (b7-auth e gatilhos), não só na tela.
3. **Aprovação dupla** — tabela `super_aprovacoes`. Ações de conta (excluir conta, mudar acesso, política de 2 etapas) viram pedido na b7-auth; excluir cliente vira pedido pela tela (o banco recusa a exclusão direta). Ao aprovar, a ação é feita (cliente vai para a lixeira; ações de conta são reenviadas à b7-auth com a sessão do super). Quem pediu recebe aviso.
4. **Chamados de administradores só para super** — política restritiva em `suporte_chamados`: o chamado de um administrador comum só é visto por quem abriu e pelos super admins (os avisos já iam só para eles desde a zzz224).
5. **2 etapas obrigatória para administradores** — todo administrador passa a ser "exigido" (o B7 pede para ligar no próximo acesso), independente da política geral.
6. **Derrubar todas as sessões** — b7-auth `super_derrubar_todos` (e `super_derrubar` para uma conta); também desconfia dos aparelhos de confiança.
7. **Alerta de acesso estranho** — no login de administrador, aparelho (sistema + navegador) e rede (começo do IP, sem localização) novos geram aviso para os super admins e entram no cofre. Tabela `acesso_aparelhos`.
8. **Cofre de auditoria** — gatilho impede alterar ou apagar `auditoria` (nem pelo servidor). Mudanças de configuração e clientes excluídos agora também são registrados.
9. **Configurações críticas só para super** — gatilho em `sistema_config`: manutenção, IA, recursos, aparência e segurança recusam administrador comum (limite "config_critica").
10. **Uso e custos** — `super_uso()` + Brevo pela b7-auth.
11. **Backup só para super** — o botão saiu de Configurações para quem não é super e está na aba Uso e backup. (O backup é montado no navegador com as leituras que o administrador já tem; a trava é na tela.)
12. **Avaliações dos administradores** — `super_avaliacoes_equipe()`: a nota vai para quem deu a última resposta no chamado.
13. **Passar o cargo de supremo** — código de 6 números no e-mail da verificação em 2 etapas do supremo (vale 10 min); confirmado, o supremo vira super e o escolhido vira supremo.
14. **Botão de emergência** — trava o sistema para todos (equipe, administradores e clientes), menos os super admins; e "tirar administrador" de qualquer um (a pessoa sai do B7 e fica com a função escolhida).

## Testes feitos
- Banco (bloco desfeito no fim): administrador comum recebe "Esta configuração está liberada só para o super admin" na manutenção; exclusão direta de cliente recusada ("precisa da aprovação"); pedido criado; apagar auditoria recusado; super aprovou e o cliente foi para a lixeira; painel, uso e avaliações respondem.
- `b7-auth` publicada e respondendo.
- Tela local com dados de mentira: as 7 abas abrem e mostram os dados; sintaxe dos JS alterados conferida.

## Não testado
- Com contas reais: pedido de aprovação vindo do Kaique, alerta de aparelho novo, derrubar sessões, emergência, tirar administrador e passar o cargo (nenhum foi executado em produção).
- A exigência de 2 etapas para administradores no próximo login (Yury e Kaique ainda não ligaram).
- Celular.
