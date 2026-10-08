# Relatório — Painel cheio (Painel do Videomaker)

**Versão:** `2026-10-08-zzz120` · **Cache:** `roteiros-b7-v325`
**Pedido:** "melhora 10000% a tela do painel, quero bem preenchida, com mais coisas, algo que eu possa deixar em tela cheia" (sem criar botão de tela cheia).

## O que mudou
O Painel tinha 4 indicadores e 4 blocos, e metade da tela ficava vazia no monitor. Agora são **6 indicadores, 7 blocos e um relógio**, e num monitor Full HD em tela cheia tudo cabe numa tela só, sem rolar.

**Indicadores (2 novos)**
- **Com o cliente** — demandas suas aguardando aprovação.
- **Entregues no mês** — vídeos que você entregou no mês, com quantos nesta semana.

**Blocos novos**
- **Minha fila** — uma barra dividida por etapa (para iniciar, em edição, correção, com o cliente, standby) e a contagem de cada uma. Cada etapa abre a Produção de Vídeo já filtrada.
- **Próximos 14 dias** (no lugar de "Próximos compromissos") — um quadrado por dia, com ponto rosa para gravação e âmbar para prazo de edição, e os próximos compromissos embaixo.
- **Últimas entregas** — os últimos vídeos que você entregou, com cliente e data.
- **Agência em outubro** — **só para administrador**: o anel de andamento do mês, as cinco contagens do Panorama e os cinco clientes que precisam primeiro, cada um com as sete etapas em pontinhos coloridos. Usa a mesma função e a mesma regra do Panorama.

**Relógio** no cabeçalho (some no celular).

**Atualização sozinha:** com o Painel aberto, os dados se renovam a cada 5 minutos, sem piscar e sem refazer a animação. Aba escondida não consulta; ao virar o dia, renova na hora. Se uma renovação falhar, fica o dado anterior na tela.

## Disposição
- **Tela larga (1500px ou mais):** 6 indicadores numa linha; embaixo, atenção · semana + fila · produção; na última faixa, 14 dias · agência · entregas. A última faixa estica até o pé da janela.
- **Full HD em tela cheia:** espaçamentos um pouco menores para caber tudo sem rolar.
- **Notebook (1101–1499px):** duas colunas, com rolagem.
- **Celular:** uma coluna; indicadores em pares.
- Quem não é administrador não tem o bloco da agência: "14 dias" e "entregas" dividem a última faixa.

## O que não mudou
- Regras de atraso, prazo, prioridade da lista de atenção e o gráfico de produção.
- Os Painéis de **Coordenação**, de **Design** e o **composto** (quem tem mais de uma função) ficaram como estavam.

## Banco de dados
Nenhuma migração. A leitura de entregas passou a trazer também o nome e o logo do cliente. O bloco da agência reaproveita a função `panorama_mes` (zzz119), que roda com as permissões de quem abre.

## Arquivos alterados
`js/painel.js`, `styles/painel.css`, `js/panorama.js` (expõe a regra para o Painel), `js/database.js` (cliente nas entregas), `sw.js`, `js/auth.js` (versão).

## Testes executados
**A sessão do app local expirou durante o trabalho** (não digito senha), então a tela foi conferida com **dados simulados no mesmo formato dos reais**, não com os seus dados.
- Antes de a sessão cair: a leitura de entregas com o cliente junto foi executada com a sua conta e respondeu sem erro, com o cliente preenchido.
- 1920×1080: 6 indicadores numa linha, 7 blocos, altura do conteúdo igual à da janela (sem rolagem), sem estouro lateral; conferido em captura.
- 1366×768: duas colunas, sem estouro lateral.
- Celular (375×812): uma coluna, relógio escondido, nada vaza para o lado; conferido em captura.
- Sem administrador: o bloco da agência não aparece e a última faixa se reparte em dois.

## Não testado
- **Com os seus dados reais** na tela nova (só simulados).
- A renovação automática de 5 minutos e a virada do dia (escritas, não exercitadas).
- Animações em movimento.
- Tema escuro.
- O Painel composto e os de Coordenação/Design depois da mudança (não deveriam mudar; não abri).
- Monitores maiores que Full HD.
