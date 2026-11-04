# Relatório — Administrar conversando com o assistente

**Versão:** `2026-10-09-zzz142` · **Cache:** `roteiros-b7-v347`
**Pedido:** item 121 (Admin por conversa).

Só para **administrador**, no chat do assistente (botão no canto da tela). Você escreve, por exemplo: "desliga a IA de voz", "põe a cor do sistema em oceano" ou "avisa os designers que a reunião é às 15h". O assistente **monta um cartão** com o antes e o depois, e **nada muda até você tocar em Aplicar**. Cancelar descarta.

## O que dá para pedir (três comandos)
1. **Ligar, desligar ou liberar um recurso**: Conversas da equipe, Painel de TV, "Hoje é dia de…", Falar com o assistente, Imagem no assistente, Ouvir a resposta, Ideias de conteúdo nas Oportunidades, Criar roteiro com IA pelo conteúdo. Para todos, ninguém, ou só administradores + funções (Coordenação, Videomakers, Designers). O cartão mostra "Agora: Todos → Fica: Desligado".
2. **Cor do sistema** (a da zzz140): "Agora: Padrão B7 → Fica: Oceano". As datas especiais da abertura que você cadastrou são mantidas.
3. **Comunicado** pela conversa (o da zzz139): para toda a equipe ou para uma função. O cartão mostra para quem vai e a mensagem inteira.

## O que ficou de fora, de propósito
- **Permissões, funções, módulos, senhas, contas e exclusões.** O assistente é instruído a não propor nada disso e a mandar você para Usuários e acessos. Escolhi assim porque é o ponto mais sensível do sistema e um erro de leitura da IA ali custa caro.
- **Agendamento ("dá acesso só até sexta")**: esse tipo de acesso temporário não existe no sistema. O assistente explica isso e só propõe sem prazo se você quiser.
- **Painel de TV e manutenção**: ficam nas Configurações, não pelo chat.

## Como é protegido
- O servidor só aceita valores de uma **lista fechada** (os oito recursos, as cinco cores, três funções); qualquer outra coisa é descartada e não vira cartão.
- Quem não é administrador **não recebe** essa instrução e o servidor ignora o comando se ele aparecer.
- Quem aplica é o **seu navegador, com a sua sessão**, pelas mesmas funções das Configurações; o banco só deixa passar administrador. A tela confere de novo antes de aplicar.
- O cartão pede o toque em Aplicar para **cada** alteração.
- **Risco que continua:** o assistente lê dados do sistema (textos escritos pela equipe e por clientes). Se um desses textos tentasse induzi-lo a propor uma alteração, o resultado seria no máximo um cartão — dentro da lista fechada, mostrando exatamente o que mudaria — que só vale se você tocar em Aplicar.

## Banco de dados
Nenhuma mudança. As alterações usam funções que já existem: `sistema_config_definir` (recursos e aparência) e `chat_comunicado`.

## Servidor
`b7-ia` publicada de novo (`_shared/ia/chat.ts`: novo tipo de proposta "admin", só liberado a administrador e a telas que o sabem mostrar). Conferido depois: sem sessão responde 401.

## Arquivos alterados
`supabase/functions/_shared/ia/chat.ts`, `supabase/functions/b7-ia/index.ts`, `js/ia-chat.js` (cartão novo; a tela passa a se anunciar como versão 3), `js/admin-extra.js` (aplicação dos comandos; a cor e o comunicado ganharam entradas para o assistente), `sw.js`, `js/auth.js`.

## Novidades
Nenhuma entrada: é só do administrador.

## Testes executados
**Lógica do servidor (cópia da regra, testada no navegador com 8 marcadores):** o recurso válido com funções repetidas e inválidas ficou só com "designer"; recurso desconhecido ("usuarios"), modo inválido ("ligar"), cor inexistente ("neon"), comunicado curto demais e um comando "permissao" foram **todos descartados**; a cor "porsol" e o comunicado válido passaram.
**Tela, na aba local sem login, com a resposta do assistente simulada:** três cartões no chat (recurso, cor, comunicado) com o antes e o depois; o botão "Criar todas" apareceu; Aplicar nos três mandou: recurso `ia_voz` desligado; cor oceano **mantendo as datas especiais**; comunicado para os 2 designers (e não para as outras funções); os cartões viraram "Alteração aplicada".
**Servidor:** publicação e resposta 401 sem sessão.

## Não testado
- **O assistente de verdade propondo o cartão.** Não chamei a IA: o modelo precisa entender o pedido e escrever o marcador certo. É o ponto mais incerto; se ele errar (ex.: não propor, ou propor algo fora da lista), o cartão simplesmente não aparece ou é descartado, e o ajuste é no texto das instruções.
- Aplicar com o banco real (as três funções foram testadas separadamente nos pacotes anteriores).
- Celular.
- Dica de uso: peça uma coisa de cada vez nas primeiras tentativas.

## Rastros do teste
Nenhum registro criado ou alterado no banco. Nenhuma chamada de IA.
