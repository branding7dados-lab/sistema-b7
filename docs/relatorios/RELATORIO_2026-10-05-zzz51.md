# zzz51 — a porta aberta da sincronização e o engasgo de cada toque

**Versão:** `2026-10-05-zzz51` · **Cache:** `roteiros-b7-v256`

Os dois últimos achados da revisão de 04/10 que ainda estavam em aberto.

---

## 1. `oportunidades-sync` aceitava rodada sem autenticação

### O que havia

No handler, só `forcar` e `diagnostico` exigiam admin. Uma rodada **normal**
(corpo vazio) passava com a chave **pública anon** — a mesma que está em
`js/config.js`, à vista de qualquer um que abra o site.

Quem soubesse o endereço disparava a sincronização de todas as fontes à
vontade. Não vaza dado e não apaga nada (quem grava é a função do banco, que é
idempotente), mas são duas coisas ruins: trabalho de graça no nosso servidor, e
tráfego **em nome da Branding7** contra os sites oficiais — Ministério da
Saúde, OMS, ONU, IBGE. É assim que se perde acesso a eles.

### O que mudou

Toda rodada agora precisa de **uma** das duas coisas:

- JWT de administrador (o botão "Sincronizar agora"), ou
- o cabeçalho `x-b7-cron-secret` batendo com o segredo `B7_CRON_SECRET`.

Sem segredo configurado a função **recusa** (503) em vez de voltar a aceitar
qualquer chamada. É a mesma decisão já tomada no `b7-push`: é o cron que tem de
ser consertado, não a porta que tem de ficar aberta. Comparação em tempo
constante (`iguais()`, de `_shared/cors.ts`).

### O que o Kevin precisa fazer

A Edge Function **não sobe junto com o merge** — o GitHub Pages só serve os
arquivos estáticos. Na ordem:

1. Guardar o segredo: Supabase → Edge Functions → Secrets → `B7_CRON_SECRET`.
2. Rodar `migration_oportunidades_cron.sql` no SQL Editor, trocando
   `<SEGREDO_DO_CRON>` pelo mesmo valor.
3. Subir a função (`supabase functions deploy oportunidades-sync`).

O segredo **não entra no repositório** — ele é público. Vive nos secrets da
função e dentro do banco (`cron.job`).

---

## 2. O travamento: `fotografar()` em `js/movimento.js`

### O que havia

A "foto da tela" guarda `painel.innerHTML` para que voltar a uma tela já vista
não pisque esqueleto. Boa ideia; o gatilho é que estava errado:

```js
document.addEventListener('click', e => {
  if (e.target.closest('input, textarea, select, [contenteditable]')) return;
  fotografar();            // → guardarFoto() → p.innerHTML
}, true);
```

Clique em **fase de captura no documento inteiro**. Ou seja: todo toque fora de
um campo de texto serializava o painel inteiro. Abrir um filtro, marcar um
chip, fechar um modal, rolar e encostar na tela — tudo. Numa tela cheia de
cartões isso é caro, e acontecia dezenas de vezes por minuto para ser usado
**uma** vez, quando enfim houvesse navegação.

Era isto que o Kevin sentia quando gravou o vídeo dizendo "tá travando
bastante, e meu celular é muito bom". Na época eu ataquei pelo lado errado —
mexi em animação, e ele mandou voltar como estava. Estava certo: não era a
animação.

### O que mudou

A foto passou a ser tirada **uma vez por navegação**, em dois pontos:

- `popstate` — o "voltar" do aparelho, que chega antes do `hashchange`;
- `B7.fotoDaTela.antesDeNavegar(de)` — chamado por `js/app.js` como a primeira
  linha do `hashchange` dele.

O momento é delicado e o comentário antigo já avisava: no `hashchange` comum já
é tarde, porque `app.js` chama o roteador num microtask logo depois do listener
**dele**, que roda antes do de `movimento.js`. Por isso o gancho é dentro do
listener do `app.js`, na primeira linha, com a tela antiga ainda intacta.

O endereço antigo vem de quem chama (`de`, que o `app.js` já guardava), e não
de uma variável interna — assim a chave da foto não depende da ordem em que os
listeners foram registrados.

Uma janela de 250 ms evita serializar duas vezes na mesma ida, quando o
`popstate` e o `hashchange` disparam juntos.

---

## Teste novo: `testes/foto.test.mjs`

Mede a coisa exata que foi corrigida. Instrumenta o getter de `innerHTML` do
painel (propriedade própria sombreando a de `Element.prototype`) e conta:

| | esperado | antes | agora |
|---|---|---|---|
| 20 toques que não navegam | 0 | **20** | 0 |
| uma navegação | 1 | 1 | 1 |
| voltar mostra a foto | sim | sim | sim |

**A suíte foi provada**: reintroduzi o listener antigo e o teste reprovou
(`20 serializações`), com os outros três casos ainda passando. Ou seja, ele
pega a regressão e não passa por acaso.

Um detalhe que o teste documenta: a rota importa. `#/clientes → #/gravacoes` é
troca de **módulo** (raízes diferentes) e vai pelo morph de View Transitions,
onde `movimento.js` pula a foto de propósito (`html.b7-vt`). O caminho da foto
é o de dentro do mesmo módulo — lista → detalhe → voltar. Minha primeira versão
do teste escolheu o par errado e acusou uma regressão que não existia; o teste
agora afirma explicitamente que não passou pelo morph, para não enganar
ninguém de novo.

`testes/package.json` passou a rodar `foto.test.mjs` na suíte.

---

## Estado da revisão

Dos 23 achados de 04/10, **23 fechados**. Segue em aberto, por escolha e não
por esquecimento: quebrar `js/design.js` (3.747 linhas) e `js/video.js` (2.996)
em partes — refactor sem efeito visível, risco maior que o retorno.
