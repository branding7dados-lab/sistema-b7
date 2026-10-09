# Relatório — Cor do sistema e datas especiais da abertura

**Versão:** `2026-10-09-zzz140` · **Cache:** `roteiros-b7-v345`
**Pedido:** itens 146 (Temas do sistema) e 147 (Tela de abertura por data).

Fica em **Configurações → Admin → Aparência do sistema → Cor do sistema e datas especiais**. Só administrador. **Nada muda para a equipe até você escolher**: o padrão continua sendo o B7 de sempre.

## Cor do sistema (146)
Cinco opções: **Padrão B7**, **Oceano**, **Floresta**, **Pôr do sol** e **Grafite**. Escolher uma mostra na hora, por trás da janela; só vale para a equipe quando você aperta **Salvar**. Cancelar volta ao que estava.
- Muda as **cores de destaque**: botões principais, marcações, degradês e contornos de seleção, no claro e no escuro (cada cor tem uma versão para cada tema).
- **Claro ou escuro continua sendo escolha de cada pessoa**, em Configurações → Aparência.
- **Não muda:** a logo, o desenho da abertura, as cores que significam status (verde de pronto, âmbar de revisão, vermelho de erro) e o Painel de TV, que tem os visuais dele. Algumas telas têm cor fixa de marca no desenho e continuam com ela.
- A equipe recebe em até 1 minuto, na consulta que cada tela já faz; quem abre o B7 de novo já abre na cor certa, sem piscar a cor antiga (o aparelho guarda uma cópia).
- O Portal do cliente não recebe a cor.

## Datas especiais da abertura (147)
Você cadastra até 12 datas com **nome, de/até (dd/mm), cor e uma frase opcional**. Dentro do período, a animação de entrada ganha a cor escolhida (rosa, vermelho, dourado, verde ou azul) e mostra a frase embaixo de "Sistema B7". Fora do período, é a abertura de sempre. Períodos que atravessam o ano (27/12 a 03/01) funcionam.
- Botão **+ Sugestões** traz Natal, Ano Novo, Outubro Rosa e Novembro Azul para você ajustar; **+ Data própria** serve para o aniversário da agência, por exemplo.
- Botão **Ver** em cada linha toca a abertura completa com aquela cor e frase, para você conferir antes de salvar.
- A logo **mantém as cores da marca**: só o céu, as luzes e as faíscas mudam de cor.
- Vale para a abertura completa (uma vez por sessão do navegador) e para a animação do Painel de TV. A versão curta, que aparece ao recarregar, não mostra a frase.

## Banco de dados
`migration_aparencia.sql` (aplicada). `sistema_config_definir` ganhou a chave `aparencia`, com validação: cor do sistema só entre as cinco, até 12 datas, datas no formato dd/mm, cores só entre as cinco, nome e frase de até 40 caracteres e sem aspas nem barra invertida. `sistema_avisos()` devolve a aparência à equipe interna (cliente recebe vazio). Nenhuma tabela, regra de acesso ou dado existente foi alterado.

## Arquivos alterados
`js/admin-extra.js` (B7.Aparencia), `js/sistema.js` (recebe a aparência na consulta de cada minuto), `js/dashboard.js` (a linha em Admin), `js/auth.js` (a cópia da aparência fica no aparelho ao sair, para a abertura já sair certa), `index.html` (aplica a cópia antes de pintar e o espaço da frase na abertura), `styles/global.css` (as cinco cores), `styles/abertura.css`, `styles/sistema.css`, `sw.js`.

## Novidades
Nenhuma entrada: é configuração do administrador e nada muda para a equipe até ele escolher.

## Testes executados
**Banco, com a sua conta, em simulação desfeita:** salvou a aparência e a equipe leu de volta pela consulta de cada minuto; recusou cor do sistema desconhecida, data 31/13, aspas na frase e cor de abertura fora da lista; uma conta que não é administradora foi barrada ao gravar.
**Tela, na aba local sem login, com dados de mentira:**
- o script do `<head>` aplicou a cor e a data especial a partir da cópia guardada, antes de a página carregar;
- as cinco cores conferidas pelo valor aplicado, no claro e no escuro (ex.: Floresta `#139A63` / `#34D399`);
- a janela: escolher cor mostra na hora; “+ Sugestões” trouxe as quatro datas; data inválida (99/99) foi barrada com aviso; salvar mandou cor e datas certas, aplicou e guardou a cópia;
- a abertura em verde com a frase "Feliz Natal" (captura): o céu ficou verde e a logo manteve a cor original;
- a conta das datas: 30/12 e 02/01 caem em Ano Novo, 04/01 em nenhuma, 09/10 em Outubro Rosa, 15/12 e 26/12 em Natal, 27/12 em Ano Novo.
- Erro achado e corrigido: o filtro de cor aplicado nas peças da abertura era ignorado pelas animações delas; passou para a cena inteira, com a logo recebendo a rotação inversa.

## Não testado
- **Telas do sistema inteiro nas cinco cores** (olhei a janela e o valor das cores, não todas as telas em uso real); pode haver detalhe de contraste, principalmente no **Grafite**.
- **As cores vermelho, dourado e azul da abertura** (vi o verde; os outros usam o mesmo mecanismo).
- A abertura numa TV ou aparelho fraco: o filtro de cor pesa um pouco mais, e só acontece nas datas especiais.
- A equipe recebendo a mudança em outro aparelho.
- Celular.

## Rastros do teste
Nenhum registro criado ou alterado no banco (tudo desfeito). Nenhuma chamada de IA.
