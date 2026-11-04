# Relatório 2026-10-01-w — Versão nova aparece no primeiro recarregamento

É só o service worker. Sem migration e sem mudança de tela.

## O problema

Depois de publicar o pacote v, o aparelho mostrava o service worker novo (`v120`) e a tela antiga de Notificações ao mesmo tempo.

A causa: o service worker já buscava "rede primeiro", mas essa busca passava pelo cache HTTP do navegador, e o GitHub Pages deixa cada arquivo valer por 10 minutos. Quem abrisse o B7 nesse intervalo recebia os arquivos antigos, mesmo com a versão nova publicada. Só o `config.js` escapava disso.

## O que mudou

- **Ao abrir o B7:** o service worker passa a perguntar ao servidor se cada arquivo mudou (`cache: 'no-cache'`). Sem mudança, o servidor responde "304" e o navegador usa a cópia que já tem; com mudança, baixa a nova. A versão publicada aparece no primeiro recarregamento.
- **Ao instalar uma versão nova:** a reserva offline é baixada direto do servidor (`cache: 'reload'`), e não mais do cache HTTP, que podia entregar arquivos da versão anterior.
- **Offline:** nada muda. Sem rede, a reserva continua sendo usada.

O custo é uma consulta leve por arquivo a cada abertura, em vez de zero durante 10 minutos.

## Arquivos

- `sw.js`: busca com revalidação e instalação com recarga; cache `v121`.
- `js/auth.js`: versão 2026-10-01-w.

## Banco / migrations

Nenhuma migration de banco foi necessária para esta atualização.

## Testes executados

No navegador embutido, com o app real servido localmente:

- o service worker `v121` instalou, assumiu a página e montou a reserva com 84 arquivos;
- a página recarregada veio inteira pelo service worker: 78 arquivos, nenhum com erro;
- no log do servidor, os arquivos do recarregamento aparecem como `304` (consulta feita, nada baixado de novo).

Não testado: o comportamento no GitHub Pages em si e em Android real.

## Limitações

- Esta correção só vale depois que o aparelho pegar o service worker `v121`. Na primeira abertura após a publicação ele ainda pode mostrar a tela anterior uma vez; da segunda em diante, não.
