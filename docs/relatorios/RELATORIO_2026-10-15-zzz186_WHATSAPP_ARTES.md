# zzz186 — Várias artes, WhatsApp sem "boiar" e atualização que fecha

- **Instalador "Não é possível fechar o Sistema B7":** o WhatsApp Web registra `beforeunload`; a view segurava o programa aberto. Agora `will-prevent-unload` é sempre liberado e, antes de instalar, `fecharParaInstalar()` fecha o WhatsApp, destrói as janelas, chama `quitAndInstall` e, se algo segurar, `app.exit(0)` em 4 s. Vale a partir da próxima atualização (a versão instalada hoje ainda tem o problema: fechar pelo Gerenciador de Tarefas e clicar em Repetir).
- **Várias artes:** escolher arquivo de arte aceita várias (imagens/PDF); as artes da versão mais nova aparecem com caixinha para marcar quais vão, e dá para somar outras do computador.
- **WhatsApp por cima da janela escura (modo claro):** a foto do WhatsApp é renovada a cada 2 s; ao abrir janela por cima, a troca é imediata (antes esperava até 400 ms tirando a foto, e o WhatsApp ficava claro por cima do escurecido).
