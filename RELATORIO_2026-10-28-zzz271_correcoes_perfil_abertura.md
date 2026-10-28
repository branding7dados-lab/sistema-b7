# zzz271 — Correções: bolinha do status e frase do carregamento

## Relatado pelo Kevin (com prints)
1. A bolinha de status do perfil (cartão da barra lateral e topo do painel) aparecia amassada em cima da foto.
2. Na tela de carregamento, "Preparando o seu espaço…" ficava ilegível sobre as faixas da abertura.

## Causa e correção
1. O avatar (`.av-pessoa`) tem `overflow:hidden` e é flex: a bolinha, colocada dentro dele, era cortada e, com foto, espremida ao lado da imagem. Agora o avatar fica dentro de um invólucro (`.pf-av`) e a bolinha é filha do invólucro, no canto (`js/perfil-lateral.js`, `styles/nav.css`).
2. A abertura "streaming" continua com faixas claras correndo enquanto o sistema não termina de carregar, e a frase ficava por cima delas. A espera ganhou uma placa de vidro escuro do tamanho do texto, acima das faixas (`styles/abertura.css`) — vale para todos os estilos de abertura.

## Testes
- `npm test` verde; prints: cartão e painel com foto (tema claro) e a abertura streaming parada na espera (antes/depois).

## Vincular com o Google (relatado depois)
- Causa: o provedor Google está **desligado** no Supabase (`/auth/v1/settings` → `external.google: false`). O cartão em Meu perfil → Segurança simplesmente sumia, sem dizer por quê.
- Agora o cartão aparece sempre e explica: no app (Windows/Android) só pelo navegador; sem o Google ligado no servidor, o administrador vê o que falta ativar.
- O que falta (do lado do Kevin, com a conta Google dele): credenciais OAuth no Google Cloud, provedor Google + "Manual linking" no Supabase e as URLs de volta. Recomendado também desligar "Allow new users to sign up" (hoje está ligado; as contas do B7 são criadas pela função b7-auth, que não depende disso).
