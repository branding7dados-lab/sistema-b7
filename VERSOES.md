# Versões do Sistema B7

A partir de 04/11/2026 o B7 deixou o código `zzz` (a última foi a **zzz308**) e passou a usar um número de três partes, como os apps: **3.0.0**.

## O que cada número quer dizer

| Parte | Sobe quando | Exemplo |
|---|---|---|
| **Grande** (1º) | Muda o jeito de usar: redesenho das telas, troca de tecnologia | 3.4.2 → 4.0.0 |
| **Novidade** (2º) | Chega algo que a equipe percebe: tela nova, recurso novo | 3.4.2 → 3.5.0 |
| **Correção** (3º) | Conserto ou ajuste pequeno | 3.4.2 → 3.4.3 |

Quando um número sobe, os que vêm depois dele voltam a zero (3.4.2 → 3.5.0).

Começamos no **3**: o B7 já teve duas fases. A primeira foi a Roteiros B7, de setembro de 2026. A segunda foram as versões `zzz`, de outubro a novembro de 2026.

## Onde o número fica

| Lugar | Como |
|---|---|
| `js/auth.js` | `const VERSAO = '3.0.0'`: a fonte de tudo |
| `sw.js` | `const CACHE = 'b7-v3.0.0'`: sempre igual à VERSAO |
| `js/novidades.js` | `versao: '3.0.0'` no registro da versão (só quando a equipe percebe a mudança) |
| Configurações → Este aparelho | mostra `v3.0.0` |
| App Android | o nome da versão do APK é a VERSAO (`.github/workflows/apk.yml`) |
| Programa do Windows | `<grande>.<novidade>.<execução>`, ex.: `3.0.57`. O último número precisa sempre crescer para a atualização automática do Windows funcionar, então ele conta as gerações do instalador, não as correções (`.github/workflows/desktop.yml`) |
| Relatório | `docs/relatorios/RELATORIO_<data>-v3.0.0_<assunto>.md` |

O aviso de "Nova versão" de cada aparelho compara só se o número mudou, então qualquer subida (inclusive de correção) faz todos atualizarem.
