# Relatório — Atualização sozinha quando ninguém está usando

**Versão:** `2026-10-07-zzz82` · **Cache:** `roteiros-b7-v287`
**Pedido:** "ent faça" — sobre a sugestão de o B7 atualizar sozinho depois de um tempo parado, para ninguém ficar dias na versão antiga.

## Como ficou: três caminhos para a versão nova
1. **A pessoa clica** em "Atualizar" no cartão (como sempre).
2. **O administrador exige** em Configurações → Sistema → "Atualizar todos agora" (zzz80).
3. **Novo: sozinho, quando não atrapalha.** Com versão nova esperando, a página recarrega por conta própria se:
   - a aba ficou **20 minutos sem nenhum toque, clique, tecla ou rolagem**; ou
   - a aba ficou **10 minutos em segundo plano** (outra aba, janela minimizada, celular bloqueado).

## Quando NÃO recarrega sozinho
- teleprompter aberto;
- alguma janela (modal) aberta — formulário, confirmação, detalhe;
- conversa do assistente com texto por enviar ou resposta chegando;
- sem internet.

Nesses casos ele tenta de novo no minuto seguinte. O que tem salvamento automático é salvo antes de recarregar, e a pessoa volta para a mesma tela.

Quem está usando o B7 não é interrompido: continua valendo o cartão.

## Mudança em relação a uma decisão anterior
Em 03/10 o recarregamento automático foi retirado porque acontecia cedo demais (aba em segundo plano, 8 segundos sem mexer, ou na troca de tela). Ele volta agora com prazos bem mais longos (20 e 10 minutos) e com as travas acima.

## Arquivos alterados
`js/app.js`, `js/auth.js` (versão), `sw.js` (cache). Nada de banco nem servidor.

## Testes executados
App local, versão antiga simulada, relógio adiantado por código:
- em uso (sem tempo parado): não recarregou;
- 21 minutos parado com uma janela aberta: não recarregou;
- 21 minutos parado com o teleprompter aberto: não recarregou;
- 21 minutos parado, sem nada aberto: **recarregou**.

## Não testado
- Esperar os 20 e os 10 minutos de verdade, em navegador e celular reais (navegadores atrasam relógios de abas em segundo plano; pode levar alguns minutos a mais que os 10).
- Formulário que não seja uma janela (campo solto numa tela) com texto digitado e não salvo: não há trava específica; depende do salvamento automático da tela.
