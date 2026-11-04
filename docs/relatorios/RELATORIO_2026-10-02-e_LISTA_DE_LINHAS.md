# Relatório 2026-10-02-e — Tela "Linhas editoriais" (lista geral)

Só front-end (`js/conteudo.js`, `styles/conteudo.css`). Sem migration. Nenhuma regra de negócio, permissão ou consulta mudou: são os mesmos dados (`linhas_resumo`), apresentados de outro jeito.

## Resumo da atualização

- O card passou a ser **o cliente**, com situação e progresso. Antes repetia "Outubro 2026" em todos os cards de um grupo que já se chama "Outubro 2026".
- **Filtro por situação** em chips com contagem, ao lado da busca.
- **Meses antigos recolhidos**; a tela abre no mês atual e no anterior.
- Buscar e filtrar não recarregam mais a tela inteira.

## O que estava ruim

- O nome do cliente, que é o que distingue um card do outro, vinha pequeno e cinza; o título grande era o mês, igual em todos.
- Não havia situação (em criação, aprovada…) nem noção de quanto do mês estava pronto.
- O botão "Abrir" ocupava espaço num card que já era clicável inteiro.
- Cada mês aparecia dentro de uma caixa com borda. Não era intencional: a classe `.grupo-mes` também existe no Status Semanal com outro desenho, e as duas regras se somavam aqui.
- Cada letra digitada na busca relia o banco e redesenhava a página com o esqueleto de carregamento.

## O que mudou

### Barra

- Busca com ícone, à esquerda.
- Chips: **Todas**, **Em criação**, **Em revisão**, **Aprovada**, **Finalizada**, cada um com a quantidade. Situação sem nenhuma linha não aparece. As quantidades acompanham o que está na busca.

### Grupo do mês

- Título maior, etiqueta **Mês atual** no mês corrente e, à direita, um resumo: "8 linhas · 85 conteúdos · 3 em criação".
- Clicar no título recolhe ou abre o mês. Meses anteriores ao mês passado nascem recolhidos. Com busca ou filtro ativo, todos abrem.
- Dentro do mês, os clientes ficam em ordem alfabética.

### Card

- Logo e **nome do cliente** em destaque (quebra em duas linhas antes de cortar). Abaixo, o nome da linha quando ela tem um nome próprio; senão, os canais.
- **Conteúdos:** quantidade, a meta quando existe ("16 conteúdos de 16 na meta") e uma barra com quantos já estão estruturados — a mesma medida do card de linha dentro do cliente.
- Linha sem conteúdo mostra "Nenhum conteúdo planejado ainda".
- Rodapé: selo de situação (mesmas cores do card dentro do cliente), o aviso **Começa em breve** quando a linha ainda está em criação perto do início do período (a regra que o Painel do Coordenador já usa) e "editada há…".
- O card inteiro é um link: abre com clique, com Enter e em nova aba.
- Entrada em cascata e barra preenchendo ao abrir a tela; quem tem "reduzir movimento" ligado não vê animação.

### Celular

- Busca em largura total, chips em uma faixa que rola para o lado, um card por linha.

## O que não mudou

- "Clientes sem planejamento" continua igual (só ganhou uma frase dizendo que o clique cria a primeira linha).
- O filtro vindo do Painel (`#/linhas?status=…`) continua funcionando, com o aviso "Mostrando: …".
- Designer continua só leitura, sem botão de criar.
- Limite de 60 linhas da consulta: o mesmo de antes.

## Arquivos

- `js/conteudo.js`: `abrirLinhasGlobais`, novo `pintarListaLinhas`, `blocoLinhasPorMes`, `cardLinhaGlobal`.
- `styles/conteudo.css`: classes `.lg-*`.
- `js/auth.js` versão `2026-10-02-e`; `sw.js` cache `v132`.

## Testes realizados

Página de teste local com 25 linhas inventadas em 4 meses (apagada depois), no navegador embutido:

- 1366 px: 4 grupos, mês atual e anterior abertos, dois antigos recolhidos; resumo e etiqueta "Mês atual" corretos; captura de tela conferida.
- Chips com as contagens certas; clicar em "Em criação" mostra só as 3 linhas e abre o grupo.
- Busca: mantém o foco no campo, atualiza as contagens, abre todos os grupos; sem resultado mostra a mensagem e "Limpar filtros", que restaura tudo.
- Card: link aponta para `#/linha/<id>`; linha sem conteúdo mostra o aviso; nome comprido não é cortado.
- 390 px: sem rolagem lateral, um card por linha, chips em faixa; captura de tela conferida.
- Sem erro no console.

## O que NÃO foi testado

- Dentro do B7 logado, com as linhas reais e as logos dos clientes.
- Modo escuro e densidade compacta.
- Como designer (o caminho de só leitura não foi alterado, mas não foi exercitado).
- O filtro vindo do Painel do Coordenador.
- "+ Nova linha editorial" e "Clientes sem planejamento" (código de criação intocado).
