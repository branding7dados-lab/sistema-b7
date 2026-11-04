# Relatório 30/09 (f) — Painel unificado (fase 4, várias funções)

## Arquitetura do Painel
**Como estava:** três Painéis prontos, com a mesma base visual (`B7.Painel.ui`: cabeçalho, KPI, linha de atenção, dia da semana, estados) mas orquestração separada. Quem tinha duas funções via **abas de visão** no cabeçalho (`?visao=`), ou seja, uma troca de perfil disfarçada.

**Como ficou:** um sistema só.
- **Resolução central:** `B7.Painel.contexto()`, em `js/painel.js`, decide funções operacionais, função principal e se é Painel único ou composto. `B7.Painel.abrir()` é a única porta de entrada.
- **Uma função:** abre o Painel dela, com toda a especificidade de antes (Videomaker, Coordenador ou Designer).
- **Várias funções:** abre o **Painel composto** (`js/painel-multi.js`, `B7.PainelMulti`).
- **Adaptadores por domínio:** cada domínio expõe um adaptador no próprio arquivo:
  - `B7.Painel.adaptador` (vídeo);
  - `B7.PainelCoord.adaptador` (editorial);
  - `B7.PainelDesign.adaptador` (design).

  O adaptador usa **as mesmas fontes e as mesmas regras** do Painel da função e só normaliza o formato: KPIs, itens de atenção, eventos da semana, próximos e gráfico. A regra de negócio fica no domínio; a composição fica centralizada.
- **Abas de visão removidas:** saíram o `?visao=` e a preferência `painel_visao`. Não existe mais troca de visão nem de perfil.

## Funções operacionais
- **Onde está a regra:** `B7.Perm.funcoesOperacionais()`, a mesma regra que já decide a navegação.
- **Coordenador:** papel coordenador, ou Administrador com a função extra "coordenador".
- **Videomaker:** papel ou função extra "videomaker".
- **Designer:** papel ou função extra "designer".
- **Administrador não é função operacional:** é acesso e gestão. Muda rotas, ferramentas, o Criar e o acesso à Central, mas não muda o conteúdo do Painel.

## Administrador puro
- A casa continua sendo a **Central B7**. `painelElegivel()` dá falso, então não aparece Painel na navegação e `#/painel` é recusado pela guarda de rota.
- Não existe "Painel do Administrador". A visão da agência é a Central.

## Administrador + função
- **Admin + Videomaker:** Painel do Videomaker (Atrasadas, Vencem hoje, Em produção, Próximas gravações), com o cabeçalho "Administrador · Videomaker".
- **Admin + Coordenador:** Painel do Coordenador.
- **Admin + Designer:** Painel do Designer.
- **Nos três casos:**
  - nenhum número da agência entra no Painel;
  - a Central B7 e as ferramentas de admin continuam na navegação;
  - os dados são sempre **pessoais**: `videomaker_id` ou `designer_id` igual à pessoa, e a operação editorial recortada por data e status.

## Multi-função
Um Painel só, com a mesma hierarquia de sempre: cabeçalho → 4 KPIs → Precisa da sua atenção → Minha semana → gráfico → Próximos.
- **Cabeçalho:** um só, com as funções reais ("Administrador · Coordenador de mídias · Videomaker") e **uma** ação, a da função principal.
- **Sem pilha de Painéis:** nenhuma seção se repete por função.
- **Sem carrossel, sem abas de papel.**
- **Função sem trabalho não vira bloco vazio.** Exemplo: Videomaker + Designer sem peças mostra só o trabalho de vídeo, e os KPIs dizem "4 vídeos".
- **Admin + Coordenador + Videomaker:** compõe só coordenação e vídeo. O admin só dá acesso.

## Função operacional principal
- **Não existia** uma "função principal" no banco nem na tela Usuários. Não criei coluna nem preferência.
- **Regra fixa (só apresentação):** coordenador → videomaker → designer, a mesma ordem que a navegação já usava.
- **O que a principal decide:** o gráfico inicial e a ação do cabeçalho.
- **O que ela não decide:** ela nunca esconde trabalho das outras funções.

## Indicadores
**Uma função:** os KPIs específicos de antes, sem mudança.
- Videomaker: Atrasadas / Vencem hoje / Em produção / Próximas gravações.
- Coordenador: Linhas em andamento / Precisam de atenção / Próximas publicações / Revisões.
- Designer: Ajustes pendentes / Vencem hoje / Em criação / Aguardando revisão.

**Várias funções:** sempre **4 cards**, com uma linha de quebra por domínio.

| Card | O que soma | Exemplo de quebra |
|---|---|---|
| **Atrasadas** | vídeo atrasado (regra do vídeo), peça de Design atrasada nas mãos do designer, publicação vencida sem "Publicado" (mesma lista de Pendentes) | "2 vídeos · 1 design" |
| **Vencem hoje** | prazos de hoje do vídeo e do Design (nas mãos da pessoa) e publicações de hoje ainda não publicadas | — |
| **Em andamento** | vídeos nas mãos, peças de Design nas mãos e linhas editoriais em andamento | "4 vídeos · 25 linhas" |
| **Próximos** | próximos 7 dias: gravações a partir de agora, prazos de amanhã em diante e publicações de amanhã em diante, **sem repetir a mesma gravação** | "3 gravações · 1 prazo · 9 publicações" |

- **Card de um domínio só:** quando só um domínio contribui e a tela dele mostra exatamente aquele número, o card abre a lista canônica (por exemplo, a fila de vídeo atrasado).
- **Nos demais casos:** o card abre uma **folha de detalhe** com os itens agrupados por domínio (VÍDEO / DESIGN / EDITORIAL). Cada item leva ao registro canônico, e o grupo tem "Abrir a lista" quando existe uma tela filtrada equivalente. Não é outra lista de tarefas.
- **Folha no celular:** sobe de baixo. No desktop é um diálogo. Nos dois, o foco fica preso, Esc fecha e o foco volta ao card.

## Precisa da sua atenção
- **Fontes:** as mesmas regras dos três Painéis.
  - Vídeo: atrasada, correção pedida, vence hoje, gravação hoje e amanhã, standby a revisar, vence amanhã.
  - Design: atrasada, ajuste do cliente, revisão pediu ajuste (com o slide), vence hoje, briefing atualizado, vence em 1 ou 2 dias, para começar.
  - Editorial: publicações atrasadas, planejamento atrasado, ajustes do cliente, publicações de hoje e amanhã não prontas, gravação sem roteiro pronto, revisões.
- **Normalização:** cada item vira {chave do registro, domínio, prioridade, motivo, título, contexto, data, rota canônica}, montado em memória.
- **Prioridade global (uma tabela só):**
  1. atraso ou bloqueio;
  2. correção ou ajuste pedido;
  3. hoje;
  4. risco próximo;
  5. revisão ou ação pendente.

  Dentro da mesma prioridade, ordena por data e depois pela ordem do domínio.
- **Sem repetição:** a chave é o registro (por exemplo, a demanda ou `grav:<id da gravação>`). Se o mesmo registro aparece por dois motivos, fica **o motivo mais forte**. A mesma gravação que chega pelo vídeo e pela coordenação vira **uma** linha.
- **Limite:** até **5** itens. O resto aparece como "E mais 8 itens (6 de editorial, 2 de vídeo)".
- **Origem discreta:** a origem aparece em texto pequeno ("VÍDEO", "DESIGN", "EDITORIAL"), sem cor nova. A urgência continua marcada por ícone e texto.

## Minha semana
- **Uma semana só, segunda a domingo** (sábado e domingo aparecem só com algo). Fontes: prazos de vídeo e de Design, gravações, publicações e início de linha editorial.
- **Sem repetição:** o evento é identificado por registro e dia. A mesma gravação conta uma vez.
- **Resumo por dia:** ícone e número por tipo (atrasadas, gravações, prazos, publicações, inícios de linha). No celular aparece a palavra por extenso.
- **Detalhe do dia:** o dia com algo vira um botão que abre a folha do dia, agrupada em VÍDEO / DESIGN / EDITORIAL / GRAVAÇÕES, com cada item levando à tela dele.

## Gráfico
- **Um gráfico por vez:** o da função principal. O coordenador vê "Fluxo de conteúdos"; o videomaker, "Minha produção" (entregas); o designer, "Minha produção" (versões enviadas).
- **Seletor:** com mais de uma função, aparece um seletor pequeno ("Conteúdo | Vídeo | Design"), acessível por teclado e com `aria-pressed`. Quem tem uma função só não vê seletor.
- **Preferência:** a escolha fica guardada neste aparelho (`B7.pref`, chave `painel_grafico`). Não criei migration.
- **Mesmo código:** os três gráficos saíram das funções que já existiam (`graficoVideo`, `graficoFluxo`, `graficoDesign`), então o Painel de uma função e o composto desenham o mesmo gráfico.

## Próximos
- **Uma lista curta e cronológica, até 5 itens:** gravações, prazos de vídeo e de Design, e publicações.
- **Origem:** texto pequeno (VÍDEO / DESIGN / EDITORIAL / GRAVAÇÃO) e o tipo à direita (Gravação / Prazo / Publicação).
- **Sem repetição:** o que já está em "Precisa da sua atenção" não se repete, e a mesma gravação aparece uma vez.
- **Link:** "Ver agenda", só para quem tem acesso ao Calendário.

## Dados
- Tudo é derivado dos registros canônicos (`demandas_edicao_resumo`, `design_resumo`, `design_versoes`, conteúdos, linhas, aprovações, `agenda_compromissos`), com as mesmas consultas das telas donas.
- Nenhuma tabela de tarefas ou de alertas foi criada. Nada é gravado.

## Performance
- **Paralelo:** cada domínio carrega as próprias fontes em paralelo, e cada fonte tem limite de 15 s.
- **Sem consulta repetida:** a leitura de gravações da agenda, que o vídeo e a coordenação faziam **igual e em dobro**, agora sai **uma vez por abertura** (`B7.Painel.ui.umaVez`). Conferido no teste: Coordenador + Videomaker faz uma única chamada da agenda.
- **Mesmo recorte de antes:** dados pessoais do vídeo e do Design, conteúdos do mês até 13 dias à frente, pendentes dos últimos 60 dias (até 50) e agenda de 3 semanas.
- **Por seção:** cada seção espera só o necessário. O gráfico pinta assim que o domínio dele chega, e a lista de atenção espera todos os domínios, para a prioridade fazer sentido.
- **Domínio que falha não derruba o resto:** aparece "Não foi possível carregar seus dados de Design. [Tentar de novo]", os KPIs mostram "· sem Design" e nunca somam zero no lugar do dado que faltou.

## Permissões
- A composição não abre nada novo: cada adaptador usa as mesmas leituras (RLS) e o mesmo escopo pessoal do Painel da função.
- A guarda de rota (`podeRota('painel')` = `painelElegivel()`) e a navegação continuam iguais.
- Administrador não vira domínio do Painel.

## Banco / migrations
Nenhuma migration de banco foi necessária para a unificação dos Painéis.

## Arquivos alterados
- **Novo:** `js/painel-multi.js`, o Painel composto.
- `js/painel.js`:
  - resolução `contexto()`/`abrir()`, sem abas de visão;
  - gráfico extraído (`graficoVideo`);
  - adaptador de vídeo;
  - consultas compartilhadas (`umaVez`, `gravacoesDaJanela`);
  - dia da semana como botão;
  - prioridade e chave nos itens de atenção.
- `js/painel-coord.js`: prioridade e chave nos grupos de atenção, `graficoFluxo`, adaptador editorial e agenda compartilhada.
- `js/painel-design.js`: prioridade nos itens, `graficoDesign`, adaptador de design.
- `styles/painel.css`: grade `.pnm`, origem discreta, seletor do gráfico, folha de detalhe e dia como botão.
- `index.html`: include.
- `sw.js`: cache v104.
- `js/app.js`: comentário.

## Tests (executados)
- **Combinações de função (harness com dados sintéticos e reais):**
  - Videomaker, Designer, Coordenador, Admin + Videomaker: o Painel específico continua igual (mesmos KPIs, atenção e links);
  - Admin puro: sem Painel;
  - Designer + Videomaker, Coordenador + Designer, Admin + Coordenador + Videomaker: Painel composto, 4 KPIs, 4 seções, 1 gráfico, 0 abas de papel.
- **KPI ↔ folha:** a soma da folha é igual ao número do card nos 4 KPIs de Designer + Videomaker e de Coordenador + Designer (por exemplo, 2/2, 3/3, 8/8, 6/6 e 14/14, 4/4, 29/29, 14/14).
- **Regressão do Painel do Designer:** KPI ↔ Produção de Design continua batendo (30 = 30, 39 = 39 nos dados reais).
- **Deduplicação:** a gravação `gv1`, que chega pelo vídeo e pela coordenação, vira 1 item na atenção (o motivo mais forte) e 1 no KPI Próximos. Sem repetição na atenção nem em Próximos, e nada da atenção se repete em Próximos.
- **Semana:** a folha do dia vem agrupada por domínio.
- **Gráfico:** a troca funciona, grava `painel_grafico` e o `aria-pressed` acompanha.
- **Teclado:** Enter no KPI abre a folha, Esc fecha e o foco volta ao card.
- **Falha só do Design:** a atenção continua com o vídeo, aparece o aviso com "Tentar de novo" e os KPIs mostram "· sem Design".
- **Uma função sem trabalho:** nenhum bloco "DESIGN — nenhum item".
- **Visual:** 1920, 1440, 1280, 1024 (escuro), 820, 390, 412 (compacto), 360 (escuro) e celular deitado 844×390. Sem rolagem horizontal e sem texto vazando (corrigi o encolhimento do nome do cliente depois da marca de origem).
- **Navegação:** o resolvedor em 10 perfis continua igual (casa, barra inferior, sem duplicatas, nada sem permissão).
- **`index.html` real sem sessão:** sem erro de JS.

## Pendências
- **Quem muda de verdade hoje:** pelo banco, o **Kevin França** é Administrador + Videomaker + Coordenador. Ele deixa de ter as abas "Coordenação | Edição de vídeo" e passa a ver o **Painel composto**, com o Fluxo de conteúdos como gráfico inicial e o seletor para Vídeo. O **Kaique Viana** (Admin + Videomaker) continua no Painel do Videomaker.
- **Validar com login real:** o Kevin, e mais Mateus (Coordenador) e Alissan (Designer), no desktop e no celular. O Painel composto só foi visto com dados sintéticos.
- **Admin + Designer continua sem poder ser atribuído** pela tela Usuários e pelo `b7-auth` (pendência da fase 3).
- **"Vencem hoje" do Design:** no Painel composto conta só o que está nas mãos do designer. No Painel do Designer continua seguindo o filtro "Para hoje" da Produção de Design. A diferença é intencional e está documentada no código.
- **Função principal:** a escolha manual (por exemplo, "prefiro ver o Design primeiro") não foi feita, como pedido. Hoje vale a ordem fixa, e o seletor do gráfico lembra a escolha no aparelho.
