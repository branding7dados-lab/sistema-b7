# Checklist de testes — Sistema de Roteiros B7

Os oito testes obrigatórios foram rodados de forma automatizada contra a
aplicação real (mesmo HTML/CSS/JS que está sendo entregue), com o banco
substituído por um Supabase simulado em memória — o mesmo contrato de chamadas,
sem depender de credenciais.

**Resultado da última execução: 8 de 8 passaram, sem erros de JavaScript.**

Isso valida a lógica da aplicação. O que só você pode validar, porque depende do
seu ambiente, está na seção final.

---

## Testes automatizados

| # | Teste | O que foi verificado | Resultado |
|---|---|---|---|
| 1 | **Autosave** | Digitar título e texto de cena → indicador mostra "Salvando…" e depois "Salvo ✓" → recarregar a página → o texto continua lá | ✅ |
| 2 | **Outro computador** | Criar cliente, gravação e roteiros num navegador; abrir o mesmo endereço em outro contexto → tudo aparece igual, sem login | ✅ |
| 3 | **Duplicação** | Duplicar roteiro → título, objetivo e as 3 cenas copiados, com ids novos e diferentes do original | ✅ |
| 4 | **Ordem** | Mover cena para baixo → recarregar → ordem mantida (`Narrativa, Gancho, CTA`) | ✅ |
| 5 | **Exclusão** | Excluir cena → some do banco → "Desfazer" restaura → excluir de novo e recarregar → não volta | ✅ |
| 6 | **Impressão** | Selecionar roteiros + página de abertura → gera 3 folhas A4 (abertura + 2 roteiros), interface não entra na impressão | ✅ |
| 7 | **Overflow** | Encher uma cena com 14 parágrafos → escala automática caiu para 74% e o conteúdo coube; sem alerta de estouro | ✅ |
| 8 | **Erro de internet** | Simular queda → indicador mostra "Sem conexão · 1 pendente" → digitar → fila local → voltar a conexão → fila esvazia e o texto chega ao banco | ✅ |

### Verificações extras que também passaram

- Sem credenciais no `config.js`, aparece a tela explicando o que configurar (não quebra).
- Dashboard vazio mostra empty state com botão de ação, não uma tela em branco.
- Nome da gravação é obrigatório; a data é opcional e nasce em branco.
- Sem data, a coluna de data some da folha A4 (`CLIENTE · GRAVAÇÃO · VÍDEO`); com data, ela aparece.
- Três clientes com gravações na mesma data convivem como registros independentes.
- Página do cliente lista as gravações sem agrupar por mês.
- Duplicar gravação copia roteiros e cenas e vem com a data em branco.
- `Ctrl+K` abre as ações rápidas, com filtro funcionando.
- Links antigos `#/diaria/<id>` redirecionam para `#/gravacao/<id>`.
- Criar gravação leva direto ao editor, já com um roteiro e três cenas.
- Erro de banco simulado → indicador mostra "Erro ao salvar"; clicar nele recupera e volta para "Salvo ✓".
- Busca global encontra cliente, gravação e roteiro.
- Exportar backup gera JSON com todas as tabelas.
- Prévia A4 renderiza gancho, narrativa, narração com sugestão de cenas, e CTA.

---

### Verificado depois do redesign visual (v2.0)

- Sidebar navega entre Dashboard, Clientes, Gravações e Roteiros recentes; recolher funciona e fica guardado.
- Dashboard monta hero, 4 métricas com dados reais, gravação em destaque, cards e clientes em grid.
- Filtros de clientes (Todos / Mais recentes / Com gravações / Sem gravações) e busca local funcionam.
- Ctrl+K abre a paleta, busca no banco e navega por teclado; Enter abre o resultado.
- Ficha A4 preservada, agora com o símbolo colorido no cabeçalho e o lockup branco na abertura.
- Data ausente continua sumindo por completo do dashboard, do cliente, do editor e da folha impressa.
- Autosave, duplicação, drag and drop, desfazer, impressão e backup seguem passando nos 8 testes.

### Verificado na entrega de logos de cliente

- Criar cliente com logo: prévia antes de salvar, arquivo no bucket, só a referência na tabela (nada de base64).
- Criar cliente sem logo: funciona normalmente e usa iniciais (ClimaPro → CP, Mercato Sadia → MS).
- Validação: arquivo acima de 2 MB e formato não suportado são recusados com toast, sem `alert()`.
- Editar cliente: renomear mantém o mesmo id, sem perder gravações; trocar logo apaga a antiga do bucket.
- Remover logo: volta para as iniciais e limpa a referência, sem excluir o cliente.
- Upload que falha: o modal não fecha, o aviso aparece e a logo anterior é preservada.
- Excluir cliente: a confirmação mostra quantas gravações e roteiros serão apagados e exige digitar o nome.
- Ficha A4: logo do cliente aparece discreta ao lado do nome; sem logo, o layout segue sem espaço vazio.

### Verificado no redesign do modal de impressão e nos temas

- Modal em duas colunas, cards clicáveis (clique em qualquer parte alterna), Todos/Nenhum, contador correto.
- Folha de abertura separada e fora do contador de roteiros; botão desabilita sem seleção.
- Teclado: Espaço/Enter marcam, Tab circula dentro do modal, ESC fecha e o foco volta ao botão que abriu.
- Impressão continua gerando abertura + uma folha A4 por roteiro selecionado.
- Tema: sistema escuro abre escuro; escolha manual vence e sobrevive ao reload; script no `<head>` evita flash.
- Dashboard, editor, modais, paleta e formulários acompanham o tema.
- **A folha A4 continua branca no modo escuro**, na tela e na impressão (verificado no PDF gerado com o app em dark).
- Logo da B7 troca de arquivo por tema; logos de clientes não recebem nenhum filtro.

### Verificado no B7 Interface System e no workspace do cliente

- Trilha da sidebar aparece no item ativo e desliza ao trocar de seção.
- Capas de gravação montadas em CSS, com logo do cliente quando existe e iniciais quando não.
- Dashboard: hero, 4 métricas reais, destaque com capa, gravações recentes, clientes recentes, 5 ações rápidas.
- Workspace do cliente: capa, breadcrumb, 4 métricas próprias, 3 abas, atividade recente (derivada de `updated_at`), roteiros recentes clicáveis abrindo o editor.
- Aba Gravações do cliente: filtros por status e busca funcionando.
- Empty state do cliente sem gravações, com o símbolo B7 discreto.
- Capas e componentes novos funcionando nos dois temas.
- Todas as suítes anteriores (autosave, logos, impressão, tema) seguem passando.

### Verificado na rodada de design system e produtividade

- Atalhos N, C, F, P, ?, `/`, Ctrl+K e Ctrl+S funcionando — e não disparando dentro de campos de texto.
- Painel de atalhos com a lista completa.
- Command palette abre com Recentes (gravações e clientes) + Ações, e navega por teclado.
- Prévia dos roteiros ao passar o mouse numa gravação, com "+N roteiros" quando há mais.
- Fixar cliente grava no banco e move o card para o topo.
- Configurações com cinco seções; densidade compacta aplica e sobrevive ao reload.
- Empty states com símbolo B7 e microcopy própria; erro com "Tentar novamente" e volta para a Central.
- Título da aba muda por contexto (dashboard, cliente, gravação).
- Rota inexistente não quebra a tela.

### Verificado nos sistemas vNext

| Teste | Resultado |
|---|---|
| Download PDF de um roteiro | ✅ arquivo A4 real (595×842 pt), 1 página, nome `MERCATO_SADIA_ROTEIRO_01_CASHBACK.pdf` |
| Download PNG | ✅ 2382×3369 px, proporção 1.414 (A4 exata) |
| Seleção múltipla no Download Center | ✅ contador de folhas, Todos/Nenhum, botão desabilitado sem seleção |
| Quick View | ✅ abre, mostra miniatura da folha, fecha no ESC |
| Estágio do roteiro | ✅ salva, persiste após reload e vira atividade |
| Nota interna | ✅ salva e **não** aparece na folha A4 |
| Fixados | ✅ grava no banco e cria a seção no dashboard |
| Arquivar | ✅ sai da Central, aparece em Arquivados, desarquiva |
| Lixeira | ✅ excluir manda para a lixeira; restaurar devolve com roteiros ligados |
| Apresentação | ✅ abre limpa, navega, contador 01/02, ESC sai |
| Atividade | ✅ timeline com eventos reais |
| Regressões | ✅ suíte completa, logos, impressão, tema, workspace e produtividade |

## O que testar você mesmo depois de publicar

Estes dependem do seu Supabase e da sua rede, então não dá para automatizar aqui.

1. **Banco real** — rodou o `supabase_setup.sql` sem erro? No Supabase, em
   **Table Editor**, aparecem as tabelas `clientes`, `gravacoes`, `roteiros` e
   `cenas`? Se você já tinha a tabela `gravacoes`, ela deve ter virado `gravacoes`
   com todos os registros preservados.

2. **Dois computadores de verdade** — crie no computador A: cliente
   `Mercato Sadia`, gravação `Conteúdos Setembro`, três roteiros. Feche. Abra no
   computador B pelo mesmo link. Tudo precisa estar lá. Se não estiver, o
   `config.js` dos dois provavelmente aponta para projetos diferentes.

3. **Impressão em papel** — imprima uma folha de verdade, com margens em
   "Nenhuma" e "Gráficos de plano de fundo" marcado. Confira se o gradiente do
   gancho saiu colorido e se nada encostou na borda.

4. **Celular** — abra no celular e confira as abas Editor / Prévia.

5. **Instalação como app** — no Chrome, instale pelo ícone na barra de endereços
   e veja se abre em janela própria com o ícone da B7.

6. **Logo de verdade** — suba a logo de um cliente real e confira no dashboard e
   numa folha impressa. Se a imagem não aparecer, quase sempre é o bucket
   `client-logos` que não foi criado: rode o `supabase_setup.sql` de novo.

7. **Queda de conexão real** — desligue o wi-fi, digite, ligue de novo. O
   indicador deve avisar e depois sincronizar sozinho.
