# Relatório 2026-10-01-x — Cartão ilustrado da notificação e aviso de nova versão

Duas coisas: o cartão que faltava nos avisos (a parte que tinha ficado de fora do pacote v) e uma correção para o celular não ficar preso na tela antiga depois de uma publicação.

> **Situação (01/10/2026).** Publicado: função nova `b7-arte`, `b7-push` versão `2026-10-01-x` e front no GitHub. Sem migration.

## Cartão da notificação

### O que é

No aviso expandido do Android, a única área livre para desenhar é a imagem grande. Agora essa imagem é um cartão gerado pelo B7, no estilo das referências: fundo escuro com acento B7, logo do cliente, um selo do que aconteceu, o dado principal em destaque e uma linha de contexto.

Não é anúncio: não tem foto de banco de imagens, slogan nem arte decorativa. A única imagem além da logo é a **prévia real da peça de Design**, quando o aviso é de uma peça.

### Modelos

São três, escolhidos pelo tipo do evento. Não existe um desenho por notificação.

| Modelo | Usado em | Destaque |
|---|---|---|
| Data | gravação atribuída, remarcada, cancelada; lembretes | `08 OUT · 09:00` |
| Item | atribuição, correção, ajuste, aprovação, revisão, roteiro | nome do item; em atraso, `3 DIAS`; em prazo, `AMANHÃ` |
| Resumo / sistema | resumo do dia, teste | identidade B7, sem cliente |

O selo e a cor acompanham o evento: violeta (padrão), magenta (correção e ajuste), vermelho (atraso, cancelada, recusado), âmbar (prazo, remarcada) e verde (aprovado, entregue, roteiro pronto). A cor é acento: uma barra lateral, o selo e um brilho discreto. O cartão nunca fica todo vermelho.

### Como funciona

- **Função nova `b7-arte`.** Recebe o id da notificação, lê os dados no banco e devolve um PNG 1200×600. O desenho é feito na hora em que o aparelho pede a imagem; nada é guardado em bucket.
- **`b7-push`** passou a mandar o endereço do cartão no campo de imagem do aviso. O service worker não mudou: ele já sabia mostrar imagem.
- **Fontes:** Inter e Archivo, as mesmas do sistema, buscadas do jsDelivr uma vez por instância. Se a busca falhar, o cartão sai com a fonte padrão.
- **Logo:** a do cliente. Sem logo, as iniciais. Sem cliente, o símbolo da B7.
- **Texto longo:** o destaque usa o maior tamanho que cabe; acima de duas linhas, corta com reticências.
- **Sem cartão, o aviso continua completo:** se a imagem falhar ou o aparelho não mostrar imagem (iPhone), ficam título, texto, ícone e botões, como antes.

### Segurança

- O endereço do cartão leva uma assinatura (HMAC do id) que só a `b7-push` sabe gerar. Sem a assinatura certa, a `b7-arte` responde 404: não dá para pedir o cartão de uma notificação adivinhando o id.
- O endereço só viaja dentro do push, para quem já é destinatário.
- O cartão mostra o mesmo que o texto do aviso já mostra (cliente, item, data). O texto escrito pelo cliente ou pela equipe continua fora.
- A prévia de Design continua em bucket privado: a função assina a leitura por 2 minutos, só para montar o cartão.

### Limite que continua valendo

A moldura do aviso (título, texto, botões, posição da imagem) é do Android e não pode ser redesenhada por um site. O cartão aparece quando o aviso está expandido; recolhido, o Android mostra só título, texto e ícone. Os botões continuam sendo os do sistema, abaixo do cartão.

## Tela antiga no celular depois de publicar

### O que aconteceu

O celular mostrava service worker novo e tela antiga. O service worker novo assume o controle sem recarregar a página, então o código que estava na memória continuava sendo o da versão anterior. No computador não aparecia porque a página tinha sido recarregada depois.

### O que mudou

Quando uma versão nova assume o controle com o B7 aberto:

- **com a pessoa olhando:** aparece o aviso "Nova versão do B7 disponível" com o botão **Atualizar**;
- **com o B7 em segundo plano:** ele recarrega sozinho;
- **com alteração ainda não salva:** nunca recarrega sozinho. Espera o salvamento terminar.

Isso só vale para atualização. Na primeira instalação nada aparece.

## Banco / migrations

Nenhuma migration de banco foi necessária para esta atualização.

## Arquivos alterados

- `supabase/functions/b7-arte/index.ts` (novo)
- `supabase/functions/b7-push/index.ts`: endereço assinado do cartão; versão `2026-10-01-x`
- `js/app.js`: aviso de nova versão
- `sw.js`: cache `v122`
- `js/auth.js`: versão 2026-10-01-x

## Testes executados

**Cartão** — gerado pela função publicada e conferido visualmente:

- gravação com data, lembrete real da agenda (com a logo real do cliente e a data vinda do evento), atraso, aprovação, resumo, teste;
- título muito comprido e nome de cliente comprido;
- cartão com a prévia real de uma peça de Design;
- sem assinatura, com assinatura errada e com o modo de prova usado no desenvolvimento: 404 nos três;
- com assinatura válida: PNG, de 1,5 a 5 segundos por cartão (o primeiro depois de um tempo parado é o mais lento).

**Push** — a `b7-push` nova responde com a versão `2026-10-01-x`. Antes desta mudança, dois pushes reais já tinham chegado ao seu celular (os testes das 17h34 e 17h38, registrados como `enviado`), o que confirmou o envio de ponta a ponta.

**Aviso de nova versão** — com o trecho real do `app.js` no navegador: tela aberta mostra o aviso e não recarrega; segundo evento não duplica o aviso; segundo plano com alteração pendente não recarrega; segundo plano sem pendência recarrega; o botão Atualizar recarrega.

## Limitações

- **Não vi o cartão dentro de um aviso real no Android.** A imagem foi conferida fora do aparelho. Falta você mandar um teste e olhar o aviso expandido: tamanho, corte nas bordas e tempo para a imagem aparecer.
- **Tempo de geração:** de 1,5 a 5 s. O aviso chega na hora; a imagem pode entrar um instante depois.
- **Dependência externa:** as fontes vêm do jsDelivr. Fora do ar, o cartão sai com a fonte padrão.
- **Avisos anteriores ao pacote v** têm texto no formato antigo, e o cartão deles fica mais pobre (sem a linha de contexto).
- **O aviso de nova versão** só existe em quem já carregou esta versão. Para chegar nela, o celular ainda precisa de um último recarregamento manual.

## Pendências

- Conferir o cartão no Android e ajustar tamanho ou margens se o aparelho cortar.
- As três pendências do pacote v continuam: quem revisa (opção "Revisões pendentes da agência" para admin), o erro antigo do Kanban com peça de Design, e os avisos individuais de publicação.
