# Relatório — IA que enxerga mais, sobras do WhatsApp removidas

**Versão:** `2026-10-07-zzz85` · **Cache:** `roteiros-b7-v290`
**Pedido:** remover as sobras do WhatsApp, fazer o resumo do dia, a IA que enxerga mais e o relatório mensal por cliente.

## 1. Sobras do WhatsApp — removidas
`migration_remove_sobras_whatsapp.sql` (aplicada): apagou a tabela `perfil_contatos` e as colunas `whatsapp_status` / `whatsapp_em` de `notificacoes`. A migração conferia antes que estava tudo vazio (estava: 0 números, 0 avisos marcados). O arquivo `migration_whatsapp.sql` saiu do repositório, já que não descreve mais nada que exista.

## 2. IA que enxerga mais — feito
O chat continuava vendo só o que está em aberto. Agora, a cada mensagem, o servidor também lê (com o acesso da própria pessoa):

| Novo | O que entra |
|---|---|
| Vídeos entregues | mês atual e anterior, por cliente e por videomaker |
| Artes finalizadas | mês atual e anterior, por cliente e por designer |
| Aprovações | o que aguarda o cliente e o que foi decidido nos últimos 14 dias (quem decidiu e quando) |
| Publicações | 7 dias para trás e 7 para a frente: as de hoje, as que passaram sem publicar, as programadas |
| Roteiros | quantos em criação e quantos prontos para gravar |

Com cliente em foco, tudo isso vem só daquele cliente e com mais detalhe (títulos).

As sugestões da tela inicial do chat mudaram: sem cliente — "Resumo do meu dia", "O que está atrasado hoje?", "O que os clientes aprovaram esta semana?", "Quantos vídeos entregamos este mês?"; com cliente — situação, ideias, aprovações e publicações dele.

### Um cuidado com os números de vídeo
A contagem de vídeos entregues usa o **mês de referência da demanda** (competência), não a data de entrega. Motivo, visto no banco: a importação de 14/09 carimbou 400 demandas com a mesma data de entrega e gerou mais de 1.500 registros de histórico no mesmo mês; contar por data daria um setembro inflado. Pela competência os números são: agosto 60, setembro 89, outubro 18 (até agora). A IA é avisada de que a contagem é por mês de referência.

### Continua fora
Meses mais antigos que o anterior, o texto dos roteiros e das legendas, comentários e histórico de cada item.

## 3. Resumo do dia — já existia; não construí outro
Ao auditar, vi que o B7 já tem isto, e errei ao sugerir como novidade:
- **Painel** de cada função (Videomaker, Designer, Coordenador): atrasadas, vencem hoje, a semana e os próximos compromissos, só da pessoa.
- **Aviso "Resumo diário"** às 8h, com os prazos do dia e as gravações de amanhã. Está **desligado por padrão**; cada pessoa liga em Perfil → Avisos → Resumo diário.

O que acrescentei foi o botão **"Resumo do meu dia"** no chat, que pede à IA um resumo com os dados acima.

Decisão que fica com o Kevin: ligar o aviso das 8h por padrão para toda a equipe. É mudança de regra de notificação, então não mexi.

## 4. Relatório mensal por cliente — já existia; não construí outro
Também já existe: na página do cliente, botão **"Resumo do mês"**. Gera um documento 4:5 no padrão dos documentos de cliente, com planejado, publicado, artes, vídeos e gravações do mês, e sai em PNG ou PDF.

Se faltar algo nele (outro formato, mais seções, gerar para vários clientes de uma vez), é só dizer o quê.

## Arquivos alterados
`supabase/functions/_shared/ia/chat.ts` (função `b7-ia` publicada), `js/ia-chat.js`, `migration_remove_sobras_whatsapp.sql` (novo), `migration_whatsapp.sql` (removido), `js/auth.js`, `sw.js`.

## Testes executados
**Banco** (só leitura, com a sessão simulada de duas pessoas): as seis leituras novas rodam e respeitam o acesso — a administração vê 30 aprovações pendentes e 3 decididas; um designer vê 0 de vídeo e 0 de aprovações, e as mesmas 29 artes finalizadas.
**Banco:** conferência das datas de entrega (o carimbo de 14/09) e da contagem por competência.
**Servidor:** `b7-ia` publicada e respondendo (401 sem sessão).

## Não testado
- Uma conversa real depois da mudança: não vi a IA responder com os dados novos (não tenho sessão). Vale perguntar "quantos vídeos entregamos este mês?" e comparar com a tela.
- As sugestões novas na tela (mudança de texto, conferida só no código).
- O gasto: cada mensagem agora manda mais contexto à IA, então consome mais da cota gratuita.
