# Relatório — Ajustes nas Configurações e no menu da conta

**Versão:** `2026-10-07-zzz72` · **Cache:** `roteiros-b7-v277`
Pedido do Kevin, item a item. Só telas; nada de banco, RLS ou servidor.

## O que mudou
1. **Aba "Sistema" só para administrador.** Coordenador, Designer, Videomaker e Cliente não veem mais essa aba (versão, buscar atualização, instalar, limpar dados, banco).
2. **Sair da conta foi para a aba "Geral".** O bloco inteiro de sessão (último login, Sair da conta, Sair de todos os aparelhos) fica no fim da aba Geral. A aba "Conta" deixou de existir.
3. **Menu da conta (foto no topo):** saíram "Ver abertura" e a chave de "Animações". Os dois continuam em Configurações → Aparência.
4. **Teleprompter nas Configurações:** só aparece para quem tem a função Videomaker ou Coordenador (e para administrador). Antes aparecia para qualquer um com acesso a Roteiros ou Gravações.

Abas por perfil agora:
- Administrador: Geral, Aparência, Admin, Sistema
- Coordenador, Videomaker, Designer: Geral, Aparência
- Cliente: Geral (só a sessão), Aparência

## Arquivos alterados
`js/dashboard.js`, `js/topo.js`, `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
App local, arquivos novos, sessão simulada:
- abas e grupos de cada perfil (administrador, videomaker, coordenador, designer com Roteiros liberado, cliente) conferidos — designer sem Teleprompter mesmo com Roteiros;
- "Sair da conta" presente na aba Geral em todos os perfis;
- menu da conta aberto: sem "Ver abertura" e sem "Animações"; seletor de tema e "Sair da conta" continuam.

## Não testado
Conta real, captura de tela, tema escuro e celular físico.

## Observação
A regra do item 4 vale para os **ajustes** nas Configurações. Quem abre o teleprompter em si continua seguindo o acesso a Roteiros/Gravações, como antes.
