# Relatório — Admin: Painel de TV, textos padrão e liga/desliga de recursos

**Versão:** `2026-10-09-zzz129` · **Cache:** `roteiros-b7-v334`
**Pedido:** da lista de funções de admin, "37, 39, 40".

## 37 · Painel de TV
Uma tela nova (`#/tv`) com a agência no mês, para deixar aberta numa TV. Entrada: **Configurações → Geral → Painel de TV**.

O que mostra:
- relógio grande, data e a faixa "Hoje é dia de…" (as mesmas datas relevantes do aviso);
- andamento médio do mês e quantos clientes estão em dia, em andamento, pedindo atenção e com atraso;
- **todos os clientes com movimento**, um por linha, com as sete etapas do Panorama (Linha, Roteiros, Gravação, Vídeo, Design, Aprovação, Publicações) e o percentual;
- **etapas da agência**: quantos clientes estão em dia, andando, em atenção ou atraso em cada etapa;
- publicações de hoje (publicadas de quantas) e as próximas gravações.

O que **não** mostra (foi o que tratei como "dado sensível"): nome de pessoa da equipe, comentários, notificações, valores, contato de cliente. Não há nenhum link nem botão de ação: ninguém opera nada dali. Enquanto ela está aberta, o menu, o topo, o sino, o assistente e os avisos do canto ficam escondidos.

Comportamento de TV:
- o relógio anda sozinho e os dados se renovam a cada 5 minutos;
- a tela não apaga (quando o navegador permite);
- com mais clientes do que cabe, a lista **troca de página sozinha** a cada 20 segundos;
- para sair: **Esc**, ou o botão que aparece ao mexer o mouse;
- não coloquei botão de tela cheia (você já tinha dito que faz isso pelo navegador — F11).

Os números vêm das mesmas fontes do Panorama, do Calendário, das Publicações e das Oportunidades. Nenhuma consulta nova no banco.

**Atenção — a conta que fica logada na TV.** A tela esconde o menu, mas não é uma trava: quem tiver o teclado da TV aperta Esc e está dentro do sistema com a conta que estiver logada. E ela só mostra o que essa conta pode ver. **Não deixe a sua conta de administrador na TV**; o caminho mais seguro é uma conta de coordenação só para isso. Uma conta "só TV", que não abre mais nada, exigiria mexer no modelo de permissões — não fiz; se quiser, eu desenho antes.

**Nomes de clientes aparecem**, inclusive os que estão com atraso. Se a TV ficar onde cliente visita, vale pensar se quer isso.

## 39 · Textos padrão
**Configurações → Admin → Textos padrão → Editar textos padrão.** Dez textos, em dois grupos:

Mensagens para o cliente (as que o sistema copia para você colar no WhatsApp):
- arte pronta para aprovação; lembrete de arte aguardando; várias artes prontas; lembrete de várias artes (Design → "Copiar mensagem");
- status semanal (Status semanal → Exportar → "Copiar mensagem");
- entrega de usuário e senha (Usuários → "Copiar usuário e senha").

Portal do cliente:
- frase de entrada (abaixo do "Olá");
- serviço pausado; serviço encerrado (valem quando o cliente não tem mensagem própria);
- como falar com a agência.

Como funciona:
- palavras entre chaves, como `{titulo}` ou `{periodo}`, são trocadas pelo dado de verdade; cada texto lista as que aceita;
- a janela avisa (sem impedir) se você usar uma palavra que não existe ou tirar uma que o texto padrão usa;
- "Voltar ao padrão" em cada texto; campo vazio também volta ao padrão;
- até 800 caracteres por texto; só administrador grava (o banco confere);
- o que você escreve é tratado como texto puro: não vira código na tela do cliente.

Sem nenhuma alteração, tudo sai **idêntico** ao que saía antes.

**Fora do escopo:** o sistema hoje não envia notificação nenhuma para cliente (conferi no banco: zero), então "avisos ao cliente" aqui são as mensagens copiadas. As demais frases do Portal (títulos e telas vazias) continuam fixas; posso incluir mais se você disser quais.

## 40 · Liga e desliga de recursos
**Configurações → Admin → Recursos.** Sete recursos, cada um com quatro opções:
- **Todos** (padrão);
- **Só você** — ninguém mais vê;
- **Administradores e funções** — administradores sempre, mais as funções marcadas (Coordenação, Videomakers, Designers);
- **Desligado** — ninguém vê.

Recursos na lista: Painel de TV · "Hoje é dia de…" no Painel · Falar com o assistente · Imagem no assistente · Ouvir a resposta · Ideias de conteúdo nas Oportunidades · Criar roteiro com IA pelo conteúdo.

O que isso é e o que não é:
- é um controle de **lançamento**: esconde a entrada de quem ainda não deve ver. **Não dá acesso a módulo nenhum** e não substitui Funções e acessos;
- os três que chamam a IA (voz, imagem e ideias) são conferidos também **no servidor**: desligado, o pedido é recusado mesmo que alguém force;
- os outros quatro são só de tela;
- a equipe recebe a mudança **ao reabrir o B7** (não é na hora);
- recurso novo só entra nessa lista se eu cadastrar: nas próximas entregas passo a incluir.

## Banco de dados
`migration_textos_e_recursos.sql` (aplicada):
- a função que grava configurações do sistema passou a aceitar duas chaves novas ("textos" e "recursos"), com validação; continua só para administrador;
- uma função nova que entrega os textos a quem pede: a equipe recebe todos, o cliente do Portal recebe só os do Portal.

**Nenhuma regra de acesso (RLS) criada ou alterada**, nenhuma tabela ou coluna nova.

## Arquivos
Novos: `js/tv.js`, `styles/tv.css`, `js/recursos.js`, `migration_textos_e_recursos.sql`.
Alterados: `js/dashboard.js`, `styles/dashboard.css`, `js/app.js`, `js/permissoes.js`, `js/auth.js`, `js/ia-chat.js`, `js/oportunidades.js`, `js/linha.js`, `js/painel.js`, `js/design.js`, `js/semana.js`, `js/usuarios.js`, `js/portal.js`, `index.html`, `sw.js`, `supabase/functions/b7-ia/index.ts` (função publicada).

## Testes executados
**Limitação desta rodada:** a aba local de teste estava **sem login** (eu não digito senha). Então as telas foram testadas com dados de mentira e com a gravação no banco substituída por um simulador. O banco de verdade foi testado à parte.

**Banco (com contas reais, simulado e desfeito):**
- administrador grava textos e recursos; texto em branco não é guardado; função desconhecida é descartada; "Só você" guarda a pessoa certa;
- coordenador lê os textos e **não** consegue gravar ("Só administrador altera…");
- cliente do Portal recebe **só** o texto do Portal;
- chave de texto desconhecida é recusada.

**Painel de TV (dados de mentira, 24 e 44 clientes):**
- 1920×1080: cabe sem rolagem, 20 clientes por página em duas colunas; conferido em captura, tema claro e escuro;
- 1366×768: cabe sem rolagem, três páginas com 44 clientes; a página trocou sozinha depois de 20 s;
- celular (375 px): vira lista corrida, sem estouro lateral (depois de um ajuste);
- Esc fecha e devolve o menu; assistente e avisos ficam escondidos; nenhum link dentro da tela.
- Erros achados e corrigidos no teste: a tela não fechava ao sair por Esc em um caso; nomes de clientes cortados; faltava o nome das etapas acima das colunas; bloco de gravações cortando a última linha.

**Recursos (com gravação simulada):** a janela abre, salva e o rótulo muda ("Admin + Coordenação", "Só você"); com "funções = Coordenação", designer não vê e coordenador vê; "Só você" some para outro administrador; "Desligado" some para todos; "Todos" limpa a regra.

**Textos (com gravação simulada):**
- os oito textos comparados deram **exatamente** a frase antiga quando nada foi alterado;
- editar, salvar, reabrir e "Voltar ao padrão" funcionam; os avisos de palavra inexistente e de palavra faltando aparecem;
- um texto com `<b>` saiu como texto, sem virar marcação.

**Servidor de IA:** publicado; sem sessão responde 401 como antes.

## Não testado
- **Nada disso com a sua conta de verdade na tela**: a aba Admin real, salvar um recurso e um texto de verdade, e o Painel de TV com os dados reais.
- A recusa do servidor de IA para recurso desligado (precisa de sessão real).
- Os botões escondidos na tela de verdade (microfone, imagem, Ouvir, ideias, roteiro com IA, "Hoje é dia de…"): testei a regra que decide, não cada botão sumindo.
- O Portal mostrando um texto alterado, com conta de cliente.
- TV física, tela que não apaga, e a tela aberta por horas seguidas.
- Contas de coordenador, videomaker e designer.

## Rastros do teste
Nenhum registro criado ou alterado no banco. Nenhuma chamada de IA.
