# zzz189 — Aviso (toast) em branco no modo leve

Bug do vídeo de 15/10: depois de salvar um conteúdo, apareciam caixinhas brancas vazias no pé da tela (e a "barra branca" do print anterior). Eram os avisos ("Salvo", etc.): o texto do aviso é branco, e o modo leve (`html.modo-leve`, ligado no PC do Kevin) trocava o fundo para `--elevado`, que no tema claro é branco. Agora, no modo leve, o aviso usa o fundo escuro de sempre (`--sidebar`; erro continua vinho; no tema escuro segue `--elevado`).
