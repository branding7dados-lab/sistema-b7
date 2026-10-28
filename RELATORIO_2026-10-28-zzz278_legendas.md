# zzz278 — Legendas: consertar legenda (.srt) com IA

**Versão:** `2026-10-28-zzz278` · cache `roteiros-b7-v480`

Pedido do Kevin: trazer para o sistema o agente que ele usava no GPT para revisar a legenda automática dos vídeos, numa **aba própria**.

## A aba Legendas (`#/legendas`)
- **Consertar**
  - Arraste o .srt (ou cole o texto) e escolha o cliente.
  - "✨ Consertar com IA" corrige em partes de 60 legendas, com uma barra de progresso.
  - Mostra o **antes e depois** de cada legenda: palavra que saiu riscada, palavra que entrou destacada, filtro "só as que mudaram" e **Desfazer esta**.
  - Botões **Baixar .srt corrigido** (`nome (corrigida).srt`) e **Copiar**.
- **Histórico**: cada versão baixada ou copiada fica guardada, com cliente, quantas foram corrigidas, quem corrigiu e quando. Dá para baixar de novo e apagar da lista.
- **Marcas e termos**
  - A **lista geral** começa com as marcas do agente do Kevin e só quem tem acesso Total edita.
  - Os **termos do cliente** (nome do dono, produtos, procedimentos) podem ser editados por quem tem acesso Editar.
  - O nome do cliente entra sozinho.
- Na **demanda de edição de vídeo** há um bloco "Legenda" com **✨ Consertar legenda**, que abre a aba já com a demanda. As legendas corrigidas dessa demanda aparecem ali para baixar.

## Segurança da estrutura
- A IA recebe **só o texto** de cada legenda, com um índice. Número e tempo ficam no navegador e o sistema remonta o arquivo, então a IA não tem como mudar tempo, juntar, dividir ou sumir com legenda.
- **Trava contra reescrita**: se a IA devolve uma legenda muito diferente da original (menos de 55% das palavras em comum, sem contar pontuação, maiúscula, acento e números falados → algarismos, % e R$), fica a **original** e a tela avisa, mostrando a sugestão.
- Legenda que a IA não devolveu fica como estava. Cada parte que falha é tentada uma segunda vez.

## As regras da IA
É o prompt do agente do Kevin (regras 1 a 16 e a checagem contra reescrita), adaptado para o formato de entrada e saída por índice. Fica em `supabase/functions/_shared/ia/extra.ts`, operação `srt`, com temperatura 0.1. As marcas vêm de `legenda_termos` (geral + cliente) e incluem o **nome de todos os clientes** da agência (pedido do Kevin: se o vídeo citar um cliente, o nome sai certo mesmo que o vídeo seja de outro).

## Permissões
- Módulo novo **Legendas** (`legendas`): coordenação e videomaker com acesso Total por padrão; o administrador sempre tem.
- Funções e permissões controlam como os outros módulos.
- No banco, `pode_legendas(n)` protege as tabelas e funções.

## Banco (legendas_1)
- `modulos` ganha `legendas`, e `funcao_modulos` dá acesso a coordenador e videomaker.
- Tabela `legenda_termos`, com remoção por `removido_em`, sem DELETE.
- Tabela `legendas` (histórico): original + corrigido + totais + vínculo com a demanda.
- Funções: `legenda_termo_salvar`, `legenda_termo_remover`, `legenda_salvar`, `legenda_apagar`.

## Testes
- `testes/legendas.test.mjs` (12 conferências): ler e montar mantém número e tempo, legenda de duas linhas, legenda vazia, BOM e `\r\n`; a trava contra reescrita deixa passar pontuação, acento e números → %/R$ e barra reescrita.
- Teste de fumaça com `#/legendas` (as 3 abas).
- Prints da tela com a IA simulada.
- `deno check` na b7-ia.

Arquivos: `js/legendas.js` (novo), `js/video.js`, `js/nav.js`, `js/app.js`, `js/permissoes.js`, `styles/video.css`, `index.html`, `sw.js`, `supabase/functions/_shared/ia/extra.ts`, `supabase/functions/b7-ia/index.ts`, `migration_legendas.sql`, `testes/*`.
