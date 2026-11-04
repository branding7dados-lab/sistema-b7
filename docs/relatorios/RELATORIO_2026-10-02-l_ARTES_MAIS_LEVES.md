# Relatório 2026-10-02-l — Artes mais leves no envio

Só front-end (`js/database.js`). Sem migration; nenhuma regra do fluxo de Design mudou.

## Por quê

O Storage do plano gratuito tem 1 GB e as artes ocuparam 132 MB em menos de três semanas. Os PNG são 21% dos arquivos e 35% do espaço (média de 1,2 MB cada).

## O que mudou

Quando o designer (ou a equipe) envia a **arte** de uma peça, o navegador a deixa mais leve antes de subir:

- **PNG sem transparência** vira JPEG de alta qualidade (92%).
- **PNG com transparência** sobe como veio.
- **JPEG** só é regravado se for grande demais: mais de 1,2 MB ou lado maior que 2160 px. JPEG comum sobe como veio.
- O lado maior é limitado a 2160 px (o dobro do que o Instagram usa). Arte em 1080 px não é redimensionada.
- Só vale se economizar pelo menos 20%; senão sobe o original.
- Anexos, arquivos de produção e arquivo final **não** são alterados.
- Qualquer falha na conversão envia o arquivo original: a otimização nunca bloqueia um envio.

Escolhi JPEG, e não WebP, porque é o formato que as redes aceitam no envio: o arquivo que a equipe baixa para postar é este.

## Consequência

- O arquivo guardado e baixado passa a ser o JPEG otimizado, com o nome terminando em `.jpg`. O PNG original do designer não fica no sistema.
- As artes já enviadas não mudam.

## Arquivos

- `js/database.js`: `_otimizarArteDesign`, chamada em `enviarArquivoDesign` para o papel "prévia".
- `js/auth.js` versão `2026-10-02-l`; `sw.js` cache `v139`.

## Testes realizados

Em página local, com **imagens geradas na hora** (não são artes reais), chamando a função de verdade:

| Caso | Antes | Depois |
|---|---|---|
| PNG 1080×1350, arte chapada | 1.219 KB | 216 KB (JPEG) |
| PNG 1080×1350, com textura | 3.129 KB | 690 KB (JPEG) |
| PNG 1080×1920, com textura | 4.434 KB | 936 KB (JPEG) |
| PNG com transparência | 193 KB | sem mudança |
| JPEG 1080×1350 comum | 145 KB | sem mudança |
| JPEG 4000×5000 | 12.869 KB | 949 KB, 1728×2160 |
| PDF | — | sem mudança |
| Arquivo corrompido com nome .png | — | sem mudança, sem erro |

## O que NÃO foi testado

- Um envio real pelo sistema, logado, até o Storage (a função de envio não mudou além da chamada acima).
- Arte real de um designer, para conferir a qualidade a olho.
- Celular.

## Limite desta medida

- A economia vem quase toda dos PNG. Pelos números atuais, deve reduzir o crescimento em algo perto de um quarto, não mais.
- O que libera mais espaço é a limpeza de versões substituídas (23 MB hoje) e de peças finalizadas (54 MB hoje). Isso é exclusão de arquivo e não foi feito: depende de você definir a regra.
