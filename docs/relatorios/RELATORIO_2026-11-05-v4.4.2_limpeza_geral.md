# v4.4.2: limpeza geral do sistema

Pedido do Kevin: "limpeza, revisa o sistema todo". Foram quatro frentes: banco, registros de erro reais, varredura das telas e código.

## 1. Banco de dados (`migration_limpeza_45.sql`, aplicada)
- **71 chaves estrangeiras sem índice** receberam índice, criado automaticamente para cada uma. Apagar ou alterar pessoas, clientes e demandas deixa de varrer tabelas inteiras. O aviso sumiu do verificador.
- **Políticas do "Ao vivo"** (`realtime.messages`): `auth.uid()` e as checagens de equipe são calculadas uma vez por consulta, em vez de uma vez por linha. O aviso sumiu.
- **`gravacao_videomakers`:** `search_path` fixo, como pede o aviso de segurança.
- **Funções de gatilho** (`_grav_extra_avisar`, `_projeto_sync_demanda`, `_projeto_sync_gravacao`): visitante sem login não pode mais chamá-las direto.

Ficaram de fora, de propósito:
- Avisos das páginas `cmc_*` e `promo1010_*`: são de outros sites do mesmo projeto, abertos ao público de propósito.
- Várias políticas de leitura por papel: são o desenho das permissões.
- Índices "sem uso": a maioria acabou de ser criada.
- Tabela `_teste_ddl`: é uma sobra de teste, mas apagar fica para quando o Kevin autorizar.
- **Proteção contra senhas vazadas:** é um interruptor no painel do Supabase (Authentication → Policies). Fica a recomendação de ligar.

## 2. Erros reais nos registros (últimas 24 h)
- **Imagens do Design quebrando (400 no Storage).**
  - Causa: as URLs assinadas valem 10 min, mas `design.js` (`cacheThumb`, `cacheUrlArte`) e `portal-calendario.js` as guardavam num `Map` para sempre. Com a tela aberta mais de 10 min, as imagens quebravam. Todos os 324 arquivos e 303 miniaturas existem no Storage.
  - Correção: `B7.DB.mapaUrlsAssinadas()` esquece cada URL depois de 8 min.
- **Painel pedindo `videomaker_id=eq.null` (400).**
  - Causa: o Painel recarregava sem sessão (saindo ou com a sessão expirada).
  - Correção: `carregar()` não busca nada sem usuário.
- **`design_resumo` com 500** (15 vezes em 03/11, por volta das 20h): coincidiu com uma migração. Hoje a view responde normal, então não houve correção.

## 3. Varredura das telas
Foram 28 rotas, nos temas escuro e claro no computador e escuro no celular, procurando erro de JavaScript, erro no console e conteúdo passando da largura da tela.
- **Gestão → Equipe:** erro `Cannot read properties of null (reading 'kpis')` quando `gestao_painel` volta vazio. Corrigido com `|| {}`.
- **Central de atendimento no celular:** as 4 abas e o botão empurravam a tela para o lado. Agora as abas rolam de lado dentro da cápsula.
- **Gestão → Equipe no celular:** o filtro de período não encolhia. Corrigido.
- Na nova varredura, nenhuma rota teve erro nem conteúdo vazando.

## 4. Código
- `node --check` em todos os arquivos JS: nenhum erro.
- Nenhum `console.log` esquecido.
- `npm test` passou.
