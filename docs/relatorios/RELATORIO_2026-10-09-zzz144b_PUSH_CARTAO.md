# Relatório — Cartão do push redesenhado

**Versão do sistema:** continua `2026-10-09-zzz144` (a mudança é só no servidor; ninguém precisa atualizar o B7).
**Pedido:** "eu queria melhorar o design do push".

## O que mudou
O cartão grande que aparece no aviso (a imagem gerada pela função `b7-arte`) foi redesenhado. O título, o texto e o botão do aviso são desenhados pelo Windows/Android e continuam como eram.

- **Gravações e lembretes:** o dia virou uma **folha de calendário** (mês no topo, dia grande, dia da semana) e a **hora** fica em destaque ao lado, com o nome da gravação embaixo. Sem hora marcada, o nome da gravação ocupa o lugar da hora.
- **Atrasos:** os dias de atraso viram o **número grande** numa folha vermelha, com o item ao lado.
- **Demais avisos** (atribuição, correção, aprovação, revisão, resumo): selo em pílula, título grande e duas linhas de contexto.
- **Em todos:** logo e nome do cliente no alto à esquerda, com a etiqueta "CLIENTE" (ou "AGÊNCIA · Branding7" quando o aviso não é de um cliente); selo **"Sistema B7"** com o símbolo no alto à direita; luz na cor do assunto, anéis de fundo e um fio em degradê na base; a prévia real da peça de design, quando existe, entra à direita com moldura e sombra.

## Amostras
A função ganhou um endereço de **amostra**, com dados fictícios fixos no código (não lê o banco e não mostra aviso de ninguém), para conferir o desenho: `…/functions/v1/b7-arte?amostra=gravacao` (também `semhora`, `atraso`, `item`, `longo`, `previa`, `resumo`). Os cartões de avisos reais continuam exigindo a assinatura.

## Arquivos alterados
`supabase/functions/b7-arte/index.ts` (publicada). Nenhuma mudança no banco nem nas telas.

## Testes executados
- Publicação da função e geração **real, no servidor,** das sete amostras; vi cinco delas em imagem (gravação com hora, gravação sem hora, atraso, item curto, título longo em duas linhas, com prévia, resumo sem cliente).
- Um pedido de cartão real sem assinatura válida continua respondendo 404.

## Não testado
- **Um aviso de verdade chegando num aparelho** com o cartão novo (no Windows, no Android). O caminho dos avisos reais usa o mesmo desenho das amostras, mas com os dados do banco: use **Configurações → testar notificação** para ver no seu aparelho.
- Logo de cliente real no quadro branco (as amostras usam iniciais e a marca do B7).
- iPhone (o iOS não mostra a imagem grande do aviso).
