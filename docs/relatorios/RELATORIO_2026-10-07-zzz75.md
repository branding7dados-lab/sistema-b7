# Relatório — Aviso de versão nova no canto inferior direito

**Versão:** `2026-10-07-zzz75` · **Cache:** `roteiros-b7-v280`
**Pedido:** "eu queria esse negócio mais bonito e no canto inferior direito."

## O que mudou
O aviso "Nova versão do B7 disponível" deixou de ser a faixa escura no meio da tela e virou um **cartão no canto inferior direito**:
- ícone com o degradê do B7, título "Nova versão do B7" e uma linha explicando que leva poucos segundos e que o que está aberto é salvo antes;
- botão **Atualizar** (degradê) e botão **Depois**;
- ao tocar em Atualizar, o botão vira "Atualizando…" e o ícone gira até a página recarregar;
- **Depois** esconde o cartão por 30 minutos (antes, fechar o aviso fazia ele voltar em 30 segundos);
- no celular o cartão ocupa a largura da tela, acima da barra inferior;
- funciona no tema claro e no escuro, e respeita "animações desligadas".

"Buscar atualização" (Configurações → Sistema) mostra o cartão na hora, mesmo que tenha sido adiado.

## O que não mudou
Quando o aviso aparece, como a versão é conferida e o que o botão Atualizar faz (salva pendências, baixa a versão nova e recarrega).

## Arquivos alterados
`js/app.js`, `styles/global.css`, `js/dashboard.js` (um texto), `js/auth.js` (versão), `sw.js` (cache).

## Testes executados
App local, arquivos novos, versão antiga simulada:
- o cartão apareceu no lugar do aviso antigo (nenhuma faixa no meio da tela), fixo no canto inferior direito, com os textos e os dois botões;
- "Depois" removeu o cartão; "Buscar atualização" trouxe de volta;
- em 375 px o cartão ocupa a largura com margem dos dois lados.

## Não testado
- O clique em "Atualizar" até a recarga (recarregaria a página de teste).
- Aparência por captura de tela (o navegador de teste não repinta; conferi posição, medidas e textos), tema escuro, celular físico.
- Posição acima da barra inferior com sessão real no celular (conferida só na regra de estilo).
