# Relatório — avisos do programa de PC em caixas do Windows (zzz162, 14/10)

Kevin clicou em "App Windows → procurar versão nova" e apareceram **caixas
brancas vazias** no canto da tela, uma por clique.

## O que era
Para avisar ("Procurando versão nova…", "Você já está na versão mais nova"),
o programa escrevia um aviso **dentro da página** do sistema. No navegador e
nos testes esse aviso sai certo (fundo escuro, texto branco — conferido nos
temas claro e escuro, com e sem cor pessoal), mas dentro do programa ele saía
**branco e sem texto**. Mexer na página de fora era frágil.

## O que mudou
O programa agora fala pelos meios do próprio Windows, sem mexer na página:
- **procurar atualização** (menu Ajuda ou Configurações → Sistema → App
  Windows): uma **caixa do Windows** responde — "Tudo em dia (versão X)",
  "Versão X encontrada, baixando…" ou o erro;
- o download da atualização continua mostrando o **progresso no ícone da
  barra de tarefas**, e a pergunta de instalar ao terminar (já era assim);
- **arquivo baixado** (PDF, planilha…): **aviso do Windows** no canto da tela;
  tocar nele abre a pasta com o arquivo selecionado.

## Arquivo
- `app-desktop/main.js`.
