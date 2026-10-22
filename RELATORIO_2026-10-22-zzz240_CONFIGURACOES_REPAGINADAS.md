# zzz240: Configurações repaginadas

Pedido do Kevin: "ainda assim não gostei… muda toda essas configurações, se quiser adicionar mais opções ta autorizado… quero mais opções de admin, super admin tb tem que aparecer ai… quero repaginado".

## Nova organização
As 4 abas viraram 11 seções curtas, em três blocos:

| Bloco | Seções |
|---|---|
| **Você** | Conta (perfil, senha e 2 etapas, avisos, sessão) · Preferências (tela inicial, calendário, interface, impressão, filtros, refazer o tour) · Aparência (visual; movimento e desempenho) · Abertura e sons · Teleprompter · Apps e TV · Este aparelho |
| **Administração** | Equipe e acessos · Sistema da equipe · Saúde e manutenção |
| **Super admin** | As 7 áreas do super admin (o Supremo só para o supremo) e o backup |

## Opções novas
- **Super admin** dentro das Configurações: Painel, Pedidos para aprovar, Limites, Segurança, Uso e backup, Avaliações e Supremo.
- **Equipe e acessos:**
  - Lixeira e Arquivados.
  - Visualizar como outra pessoa.
  - Ajuda da administração.
- **Conta:** atalhos diretos para Foto e nome, Senha e verificação em 2 etapas, e Avisos e notificações.
- **Preferências:** Refazer o tour.
- **Abertura e sons:** o som de notificação e o teste dele valem para todos. Antes só o administrador via.
- **Este aparelho** (versão, buscar atualização, instalar, limpar dados) para todos. Antes ficava só na aba Sistema do admin.

## Novo desenho
- **Computador:**
  - à esquerda, fixos: o título, o cartão de quem está usando, a busca e o menu de seções;
  - cada seção do menu tem ícone colorido e uma linha dizendo o que tem dentro, e a seção aberta fica marcada;
  - à direita, o cabeçalho da seção com o ícone grande e o conteúdo.
- **Celular:** o menu é a primeira tela, como os Ajustes do telefone. Tocar numa seção abre `#/config?s=<seção>`, com "‹ Configurações" para voltar; o Voltar do aparelho também volta.
- **Administração e Super admin em mosaico:** cada atalho é um cartão. Grupos com 3 ou mais atalhos ocupam a largura toda; no celular, os cartões ficam em duas colunas.
- **Busca:** procura em todas as seções e mostra só o que bate. No celular, ela também funciona a partir do menu.

## Técnico
- Os controles são os mesmos de antes (mesmos `data-*` e mesmos tratadores), só reorganizados em seções.
- `cfg_aba` guarda a última seção.
- Ícones novos: coroa, escudo, painel, caixa, limites, gráfico, estrela, lixo.

## Conferido
- Capturas no computador (Conta, Equipe e acessos, Sistema da equipe, Saúde, Super admin) e no celular (menu, seção aberta, busca).
- `npm test` passou.
