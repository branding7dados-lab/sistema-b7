# Relatório — Painel de TV cinematográfico e modo "só a animação da B7"

**Versão:** `2026-10-09-zzz137` · **Cache:** `roteiros-b7-v342`
**Pedido:** "eu quero o painel de TV mais cinematográfico, eu quero uma opção do painel de TV só com a animação da B7."

## 1 · Só a animação da B7
A TV fica apenas com a **abertura do sistema**, em ciclo, sem número nenhum:
1. a sequência completa de entrada (a lâmpada acende, os raios, o clarão) — cerca de 7 segundos;
2. corte para o preto;
3. a cena viva, por 50 segundos: o logo da Branding7 aceso, estrelas derivando, raios girando devagar, poeira de luz subindo e um feixe que cruza a tela;
4. corte, e recomeça.

É a mesma animação que já existe na entrada do sistema; não criei uma nova. Sem som.

**Como abrir:**
- **Configurações → Geral → Painel de TV → "Abrir só a animação da B7"** — vale só para aquele aparelho, na hora;
- ou **Configurações → Admin → Painel de TV → Configurar**, e escolher "Só a animação da B7": aí **toda TV** que abrir o Painel de TV mostra a animação.

Nesse modo a tela não consulta dado nenhum da agência. O cursor do mouse some; mexer o mouse traz o botão de sair (ou Esc).

## 2 · Painel mais cinematográfico
O painel ganhou cena própria, **sempre escura** (não segue mais o tema claro/escuro do aparelho):
- fundo profundo com duas luzes (magenta e violeta) derivando devagar, grão de filme e vinheta nas bordas;
- cartões de vidro, com um fio de luz no topo;
- relógio grande em degradê, com brilho;
- um ponto de luz que corre a linha do cabeçalho e um reflexo que atravessa o resumo de tempos em tempos;
- anel do andamento com brilho, que se desenha ao entrar;
- **os números sobem até o valor** quando a tela entra;
- barras das etapas que crescem, cada cor com a sua luz;
- **as telas saem e entram** (painel ↔ agenda da semana), em vez de trocar de repente.

Os dados, os blocos e as opções são os mesmos de antes; mudou a apresentação.

## 3 · Vinheta (opcional)
Na configuração entrou **"Vinheta da B7 a cada 5 minutos"**: a abertura completa passa por cima do painel por uns 7 segundos e some, e o painel reentra com os números subindo. Vem desligada.

## Banco de dados
A função que grava a configuração da TV passou a aceitar duas chaves: o modo (painel ou animação) e a vinheta. Só administrador grava. Nenhuma tabela ou regra de acesso mudou.

## Arquivos alterados
`js/tv.js`, `styles/tv.css`, `js/dashboard.js` (entrada "Abrir só a animação"), `js/app.js` (o Painel de TV passa a poder montar a cena da abertura), `migration_admin_tv_sessoes_ia.sql` (nota), `sw.js`, `js/auth.js` (versão).

## Desempenho
Tudo que se mexe em ciclo usa só deslocamento e transparência, sem desfoque de fundo, pensando em TV com placa fraca. Com "movimento reduzido" no aparelho ou o **modo leve** do B7, as luzes e reflexos ficam parados; no modo só animação, com movimento reduzido fica apenas a cena viva, sem a sequência de entrada.

## Testes executados
Aba local **sem login**, com dados de mentira (20 clientes), em 1920×1080:
- **painel:** visual novo conferido em captura; cabe na tela; os números chegam ao valor certo (4, 8, 3, 5 e 67%) depois de subir;
- **só a animação** (pelo endereço): o cabeçalho e os blocos somem; entra a sequência completa e, depois, a cena viva com o logo — conferido em duas capturas; sair com Esc remove tudo e não deixa cena para trás;
- **configuração:** os dois modos aparecem; escolher "só a animação" apaga as opções de bloco; salvar grava modo, vinheta e intervalo;
- **troca de tela:** com a agenda ligada, o painel saiu e a agenda da semana entrou (captura);
- **vinheta:** adiantando o relógio do teste, ela entrou com corte, ficou 7 segundos e saiu sozinha.

Testes automáticos (sintaxe e fumaça) rodam na publicação.

## Não testado
- **Numa TV de verdade**: é onde importa. Não sei como o brilho, o grão e as luzes ficam numa tela grande nem se a TV aguenta sem engasgar.
- Horas seguidas ligado (o ciclo da animação e a vinheta foram vistos uma vez cada).
- Com a sua conta e os dados reais.
- 1366×768 e celular com o visual novo (a estrutura é a mesma que já tinha sido testada nesses tamanhos; o visual novo eu só vi em 1920×1080).
- O modo escolhido na configuração chegando a uma TV já aberta (ela relê a configuração a cada 5 minutos; testei pelo endereço e abrindo de novo).

## Rastros do teste
Nenhum registro criado ou alterado no banco. Nenhuma chamada de IA.
