# Relatório zzz226 — Super admin: visual revisto

O que o Kevin pediu: "dá uma revisada na tela do SuperAdmin... o UI e o UX ficaram feião."

## O que estava ruim (visto em prints com os dados reais, só leitura)
- Os blocos ficavam **colados** uns nos outros: não havia espaço entre os números, os quadros e o histórico.
- Os números (6 cartões) quebravam em 5 + 1 sozinho na linha de baixo e não tinham ícone.
- O histórico mostrava **códigos crus** ("desligar_2fa", "editar_proprio_perfil", "avatar_removido_por_admin", "avatar_definido"), sem separação por dia, e a lista era enorme.
- Os botões de perigo ("Ligar a emergência", "Derrubar todas as sessões", "Tirar administrador", "Confirmar e passar o cargo") pareciam botões comuns, quase invisíveis no escuro.
- O campo "Código de 6 números" aparecia **antes** de pedir o código (o `hidden` era anulado pelo CSS).
- No celular, as abas Uso, Avaliações e Supremo ficavam escondidas sem sinal de que dava para rolar; o botão "Derrubar sessões" ocupava meia linha.
- Uso: nomes técnicos ("design-files", "analise", "oportunidade") e números de IA soltos no meio da tela.
- Menu da conta: "Super admin" usava o mesmo ícone de "Usuários e acessos", e o selo embaixo do nome dizia só "Administrador".

## O que mudou
- **Tela toda**: espaço fixo entre os blocos; cada bloco tem ícone, título e uma linha explicando; abas com ícone e contador vermelho de aprovações; no celular as abas rolam e a aba aberta vem para o centro.
- **Painel**: 6 números com ícone numa linha só; os de alerta ficam âmbar e levam à aba que resolve (aprovações → Aprovações, sem 2 etapas/aparelhos → Segurança). Administradores com selo (supremo/super), "você", pílula "2 etapas"/"sem 2 etapas" e botão pequeno de derrubar sessões. "Chamados", "Aparelhos novos" e "Contas paradas" viraram um bloco só, **Precisa de atenção** (com "Nada fora do normal" quando vazio).
- **Histórico**: frases legíveis para todas as ações, agrupado por dia (Hoje, Ontem, 19 de outubro…), hora à direita, coroa ao lado de quem é super admin, ponto vermelho para exclusões/travas e âmbar para acessos sensíveis (entrar como, redefinir senha, desligar 2 etapas). Mostra 4 dias e "Ver os outros N dias".
- **Aprovações**: ícone por tipo de pedido, motivo em destaque, pílula de resultado (feito, recusado, falhou).
- **Limites**: ícone por linha, colunas alinhadas (em "Entrar na conta de outra pessoa" o meio aparece como "—"), legenda das três opções e barra de salvar fixa embaixo com **Desfazer**.
- **Segurança**: barra de quantos administradores já ligaram as 2 etapas, pílulas "Ligada"/"Falta ligar"; "Derrubar todas as sessões" em bloco vermelho com botão vermelho.
- **Uso e backup**: números no topo; espaço com barras e as pastas com nome em português (Artes de design, Logos dos clientes, Arquivos das conversas, Fotos de perfil); IA por área em barras; e-mails restantes em número grande; backup com ícone.
- **Avaliações**: foto, estrelas e nota de cada pessoa; abre para ver as notas e comentários.
- **Supremo**: aviso no topo; botões de perigo vermelhos; botões só ficam ativos depois de escolher a pessoa; "Passar o cargo" em 2 passos numerados, e o campo do código só aparece depois de enviar (aceita só números e libera com 6 dígitos).
- **Erro ao carregar**: mensagem com "Tentar de novo".
- **Menu da conta**: ícone de coroa em "Super admin" e selo "Admin supremo"/"Super admin" ao lado de "Administrador".
- **Usuários e acessos**: o selo "Admin supremo"/"Super admin" perdeu o pontinho cinza que sujava o dourado.

Nenhuma regra mudou: as mesmas chamadas ao banco e à b7-auth, as mesmas confirmações.

## Testes feitos
- Prints das 7 abas no computador (tema escuro e claro) e no celular, com os dados reais do painel lidos do banco (só leitura) e exemplos para aprovações, chamados e avaliações; também com tudo vazio.
- Sintaxe dos JS alterados conferida; nenhum erro no console nos prints.

## Não testado
- Aprovar/recusar, salvar limites, derrubar sessões, emergência e passar o cargo com contas reais (a lógica não mudou).
