# Relatório — cartão do aviso no app (zzz152, 11/10)

Teste do Kevin na zzz151: as notificações chegaram (teste, resumo do dia,
revisões), mas sem o **cartão** (a imagem grande da `b7-arte`), sem a logo do
cliente e sem os botões que aparecem no Chrome.

**Causa:** esses avisos chegaram com o app aberto. Nesse caso quem mostra o aviso
é o próprio app, e a versão da zzz151 mostrava só título e texto.

**O que mudou:**
- A `b7-push` manda nos dados do Firebase também o endereço do cartão, a logo e
  os botões do aviso.
- Com o app aberto, o app monta o mesmo aviso do Chrome:
  - **imagem grande** (o cartão), ao expandir;
  - **logo do cliente** à direita;
  - até **3 botões** ("Abrir demanda", "Ver roteiros", "Abrir calendário"…),
    cada um abrindo a tela certa.
- Com o app fechado, o Android já mostrava a imagem do cartão sozinho.
  Botões, nesse caso, o Firebase não oferece.

**Testes:**
- APK montado. `deno check` da `b7-push` ok. `testes/` ok.
- **Não testado** no celular.

Versão `2026-10-11-zzz152`, cache `v357`.
