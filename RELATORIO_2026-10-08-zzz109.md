# Relatório — Folha "Mais": linhas encolhidas (correção da zzz108)

**Versão:** `2026-10-08-zzz109` · **Cache:** `roteiros-b7-v314`
**Relato:** print do celular com a lista da zzz108 quebrada — cada linha só da largura do nome, com a seta e o fio colados no texto em vez de irem até a borda.

## Causa
Erro meu. A grade antiga da folha tinha uma regra de alinhamento ("comece no início") que continuou valendo quando troquei a grade por lista. Numa lista, essa regra faz cada linha ter só a largura do seu conteúdo. Por isso a seta ficava logo depois do nome e o fio tinha o comprimento do texto.

**Por que não peguei antes:** o teste da zzz108 foi feito com o arquivo de estilos antigo ainda em cache no navegador de teste, misturado com o novo. A tela que eu vi não era a que foi publicada. Desta vez removi o estilo em cache e carreguei só o arquivo novo.

## O que mudou
- As linhas ocupam a **largura inteira do bloco**: seta e visto na borda direita, fio até a borda.
- Linhas um pouco mais baixas, para a lista **caber inteira sem rolar** num celular do tamanho do print.

## Arquivos alterados
`styles/nav.css`, `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
No app local, no tamanho do celular do print (412×892), tema claro, **só com o arquivo de estilos novo carregado**:
- as 15 linhas medem a largura do bloco (380 de 380 px);
- reproduzi o defeito de propósito: aplicando a regra antiga numa linha, ela encolhe para 151 px — confirma a causa;
- a folha tem 789 de 892 px e não rola;
- captura da folha aberta, conferida visualmente: linhas inteiras, setas alinhadas à direita, visto em "Arquivados".

## Não testado
- A animação (o navegador de teste não roda animações).
- Tema escuro, contas com menos destinos e aparelho físico.
