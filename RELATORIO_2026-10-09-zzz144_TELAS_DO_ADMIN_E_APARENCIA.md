# Relatório — Telas do administrador refeitas e Aparência com mais opções

**Versão:** `2026-10-09-zzz144` · **Cache:** `roteiros-b7-v349`
**Pedido:** melhorar UI, UX e animações das telas Comunicado, Médico, Saúde, Aparência, Redistribuição e Resumo da semana, e levar a Aparência mais longe ("perfeita, com mais opções").

## Linguagem visual nova (as seis telas)
Todas passaram a falar a mesma língua:
- **Faixa de resumo** no alto (Tudo certo / N pontos de atenção) com o ícone se desenhando ou pulsando.
- **Indicadores** em cartões, com número que sobe até o valor e barras que crescem.
- **Entrada em cascata**: cada bloco entra um pouco depois do anterior.
- **Carregamento em esqueleto** (blocos que brilham) no lugar do "Carregando…".
- Botões com ícone; o "Atualizar" gira enquanto busca.
- Respeita "animações desligadas" e "reduzir movimento": nesses casos tudo aparece parado.

## Tela a tela
- **Saúde do sistema:** quatro indicadores (rotinas em dia, avisos em 24 h, espaço dos arquivos com barra, pedidos à IA), rotinas com ponto que pulsa quando está tudo bem, serviços com ícone, hora da última atualização. A rotina semanal que ainda não rodou deixou de contar como "fora de dia".
- **Médico do sistema:** faixa com o total ("18 pendências em 3 áreas"); cada área é uma sanfona com ícone, contagem e a dica; a primeira já vem aberta; botão **Abrir →**.
- **Comunicado:** mensagem com contador de caracteres e atalhos de começo de frase; **atalhos por grupo** (Toda a equipe, Coordenação, Videomakers, Designers: com todos marcados, tocar num grupo escolhe só aquele); pessoas como cartões com avatar; **prévia de como a mensagem chega** na conversa; envio com animação; lista de enviados com **barra de "lido por X de Y"** e a lista de quem leu, com ícones (leu, recebeu, ainda não recebeu).
- **Resumo da semana:** os **seis números aparecem na hora** (sem gastar IA); o texto da IA é separado em **cartões por assunto** (o que andou, o que travou, carga, para olhar primeiro), com carregamento animado e frases que mudam; corrigi o botão **Copiar**, que aparecia durante a geração.
- **Redistribuição:** barras de carga por pessoa (a mais carregada em tom de alerta, a mais livre em verde), fluxo "A → B", "Marcar todos".

## Aparência: o que tem agora
Em **Configurações → Admin → Aparência do sistema**, com uma **prévia ao vivo** (uma telinha do B7 que muda a cada escolha, no claro ou no escuro) e a tela de trás também já mostrando; Cancelar volta ao que estava.
1. **Cor do sistema:** nove cores prontas (Padrão B7, Oceano, Floresta, Pôr do sol, **Rubi, Ametista, Índigo, Dourado**, Grafite) e **Personalizada**: você escolhe qualquer cor e o sistema monta o degradê, no claro e no escuro (uma cor clara demais é escurecida no tema claro, para o texto branco continuar legível).
2. **Menu lateral:** Padrão (azul-noite), **Tingido** (toma o tom da cor escolhida) ou Grafite.
3. **Botões:** degradê ou **sólidos**.
4. **Brilho de fundo:** uma luz suave da cor atrás das telas.
5. **Datas especiais da abertura:** linhas redesenhadas, com a bolinha da cor e o selo **"em vigor hoje"**.

**Não entrou: cantos arredondados.** Só uma parte pequena do sistema usa um valor central de cantos (175 usos contra mais de mil medidas fixas), então a opção ficaria pela metade. Prefiro não oferecer.

A cor, o menu, os botões e o brilho vêm de um CSS montado a partir das suas escolhas; uma cópia fica no aparelho e é aplicada antes da primeira pintura, então a equipe já abre na cor certa. O assistente também aceita as quatro cores novas.

## Banco de dados
`migration_aparencia_v2.sql` (aplicada): função nova `aparencia_definir`, só administrador, que valida e grava a aparência (cor, cor personalizada em formato `#RRGGBB`, menu, botões, brilho e datas). A função antiga continua como estava (telas ainda na versão anterior seguem funcionando). Nenhuma regra de acesso ou dado existente mudou.

## Servidor
`b7-ia` publicada de novo (só a lista de cores do assistente). Sem sessão, responde 401.

## Arquivos alterados
`js/admin-extra.js` (as seis telas e a Aparência, reescritas), `styles/sistema.css` (bloco novo "ad-"; os blocos antigos saíram), `styles/global.css` (saíram as regras de cor por atributo, que o JS agora monta), `index.html` (o `<head>` aplica o CSS guardado), `js/dashboard.js` (rótulo), `supabase/functions/_shared/ia/chat.ts`, `sw.js`, `js/auth.js`.

## Novidades
Nenhuma entrada: tudo é do administrador (a equipe só vê a cor, o menu etc. se você mudar).

## Testes executados
**Banco, com a sua conta, em simulação desfeita:** salvar cor personalizada, menu, botões e brilho funcionou; recusou cor sem formato `#RRGGBB`, cor desconhecida, menu desconhecido e brilho que não é verdadeiro/falso; uma conta que não é administradora foi barrada.
**Tela, aba local, dados simulados:** as seis janelas abriram e foram vistas em captura; Saúde (indicadores, faixa); Médico (sanfonas, botão Abrir); Comunicado (atalhos de grupo escolhem e somam, contador do botão, prévia, quem leu); Aparência (as nove cores, personalizada com `#1A8F6B` gerando o degradê, menu tingido, botões sólidos, prévia clara/escura, as 4 datas sugeridas com "em vigor hoje" em Outubro Rosa, sem rolagem lateral); Resumo (seis números, carregamento, quatro cartões, Copiar escondido enquanto gera); Redistribuição (barras e "Marcar todos"). A cópia no aparelho (cor, menu e brilho) foi aplicada na abertura, depois de recarregar.
**Erros achados e corrigidos:** número "2/3 rotinas" contando a semanal como atrasada; os atalhos de grupo desmarcavam o grupo em vez de escolhê-lo; avatar torto nos cartões de pessoa; linhas das datas largas demais numa janela estreita.

## Não testado
- **As animações em movimento:** o painel de testes não anima a página escondida; conferi os estados finais. A cascata, as barras crescendo e o número subindo precisam ser vistos por você.
- **Cores e menu nas telas do sistema inteiro:** vi a prévia e os valores aplicados, não cada tela (principalmente contraste do Grafite e das cores claras como Dourado, no escuro).
- **Salvar de verdade** a aparência pelo banco real, e a equipe recebendo.
- Celular.

## Rastros do teste
Nenhum registro criado ou alterado no banco (tudo desfeito). Nenhuma chamada de IA.
