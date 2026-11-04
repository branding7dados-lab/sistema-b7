# Relatório — atualização só quando a pessoa clicar (pacote zzh, 03/10)

Pedido do Kevin: "quando aparece que o site tem uma atualização, eu nem clico e ele já atualiza… Eu tenho que clicar em atualizar e aí sim ele vai atualizar o site."

## Como era (decisão anterior, documentada em `js/app.js`)
Ao detectar versão nova, o sistema mostrava o aviso "Nova versão do B7 disponível · Atualizar" e **também recarregava sozinho**:
- com a aba em segundo plano;
- depois de 8 s sem toque (a cada 2 s tentava);
- na próxima troca de tela.

Por isso a página atualizava sem o clique.

## Como ficou (`js/app.js`)
- **Só o clique em "Atualizar" recarrega.**
  - Removidas as três recargas automáticas (temporizador de 2 s, `visibilitychange`, `hashchange`).
  - Saiu também a trava "uma vez por versão" (`b7-recarga-alvo`), que só existia por causa da recarga automática.
- Ao clicar, se houver alteração ainda por salvar, o sistema salva antes (`B7.Save.agora()`) e então recarrega.
- O aviso fica na tela (até 24 h); **um só**, sem empilhar outro igual a cada conferência de 30 s. Se sumir, volta na próxima conferência.
- Continua valendo: abrir o app de novo ou recarregar a página já traz a versão nova (o service worker busca na rede primeiro).

Nada de dados, regras ou banco.

## Testes executados (de verdade, no navegador do app, servidor local)
1. Página aberta na versão `zzg`; marquei a página (`window.__marca`).
2. Troquei a versão publicada no servidor local para `teste` e disparei a conferência.
   - **Resultado:** apareceu **um** aviso "Nova versão do B7 disponível · Atualizar"; uma segunda conferência não criou outro.
3. Simulei troca de aba (`visibilitychange`) e troca de tela (`hashchange`) e esperei **15 s**.
   - **Resultado:** a página **não recarregou** (marca intacta).
4. Cliquei em "Atualizar".
   - **Resultado:** recarregou e entrou na versão nova (`2026-10-02-teste`).
5. Devolvi o arquivo de versão ao valor real antes de publicar.

**Não testado:** celular físico e PWA instalado; o caminho "salvar antes de recarregar" com alteração pendente real.
