# Relatório 2026-10-02-za — Inteligência do cliente: tela redesenhada

Só front-end (`js/conteudo.js`, `styles/conteudo.css`). **Nenhuma migration, nenhuma regra de negócio alterada.** Os campos, a gravação automática e as permissões são os mesmos.

## O que você pediu

"Essa tela tá feia, melhora a ui/ux" — a Inteligência do cliente, vista no celular.

## Auditoria (o que estava ruim na captura)

- **Texto cortado:** Nicho, Instagram e Site ficavam os três lado a lado no celular. "Formação de condutores" aparecia como "Formação".
- **Seções todas iguais:** sete caixas com "0 de 4 preenchidos", sem dizer o que vai em cada uma nem mostrar o que já está escrito.
- **Contagem errada e parada:** contava só 4 campos por seção (Observações não entrava) e não mudava enquanto a pessoa digitava. "0 cadastrados" em Produtos também não mudava ao adicionar.
- **Sem visão do todo:** não dava para saber quanto do cadastro estava preenchido.
- Rótulos colados na borda de cima da seção e seta em caractere de texto (▾).

## O que mudou

1. **Resumo do cadastro no topo:** logo ou iniciais do cliente, nome, "7 de 31 campos preenchidos", barra de progresso e percentual. Atualiza enquanto você digita.
2. **Seções com ícone, prévia e selo:**
   - vazia: mostra o que vai ali ("Como a marca fala e o que evita");
   - com conteúdo e fechada: mostra o que já está escrito ("Formação de condutores · Autoescola voltada à…");
   - selo à direita com a contagem real (3/5), cinza quando vazia, magenta quando parcial, verde quando completa. Produtos e Provas mostram a quantidade.
3. **Campos no celular:** um por linha, largura inteira — nada mais cortado. Letra do campo em 16 px (o iPhone não dá zoom ao tocar) e rótulos um pouco maiores.
4. **Atalho "Abrir ↗"** ao lado de Instagram e Site quando o valor é um perfil ou endereço válido. Abre em outra aba.
5. **Exemplos dentro dos campos vazios** das Informações gerais ("Ex.: Odontologia", "@perfil", "https://").
6. **Selo "Salvo ✓" removido do corpo da tela** (versão `zb`): ficava parado abaixo do título e empurrava o conteúdo. O estado do salvamento continua no topo do sistema, como nas outras telas.
7. **Detalhes:** o título do cartão de produto/prova acompanha o nome digitado; a contagem de produtos e provas muda ao adicionar e remover; a seta virou ícone; área de toque maior; foco visível no teclado.

A mesma moldura de seção é usada no **Onboarding mensal**, que ganhou a seta nova e o espaçamento corrigido (sem ícone nem selo).

## Regras mantidas

- Nada é obrigatório: o percentual é informativo, não bloqueia nada.
- Gravação automática igual (mesmos campos, mesma tabela). Designer continua somente leitura.

## Testes executados

**Automatizados:** nenhum.

**Página local com a tela de verdade (`conteudo.js`, `ui.js` e os estilos reais) e banco simulado, navegador em tamanho de celular (390×844 e 375×812):**

- Cliente preenchido: resumo "7 de 31 campos · 23%"; selos 5/5, 0/9, 1/8, 1/6, 0/3; prévias corretas; produtos "1"; as sete seções cabem numa tela.
- Cliente em branco: "Cadastro em branco — comece pelas informações gerais", 0%.
- Digitar em Nicho, Instagram e Site: selo foi a 3/5, percentual a 10%, seção marcada como parcial, três gravações enviadas ao autosave.
- Atalho "Abrir": `@cantinhodoposto` → instagram.com/cantinhodoposto; `cantinho.com.br` → https://cantinho.com.br; texto inválido esconde o atalho.
- Adicionar produto: selo "1", título do cartão acompanhou o nome; remover: selo "0".
- Abrir seção: campos empilhados (um por linha, 320 px de largura em tela de 390), área de texto com altura correta.
- Sem rolagem lateral; nenhum erro no console.
- Tema escuro e tema claro conferidos em captura de tela.

**Site publicado, sessão real, somente leitura (emulação de celular 390×844):**

- AutoEscola Modelo: logo do cliente no resumo, "3 de 31 campos preenchidos · 10%", selo 3/5, "Formação de condutores" inteiro no campo, campos um por linha, sem rolagem lateral. Nada foi digitado nem gravado.

**Não testado:**

- Digitar e gravar no site publicado (a gravação automática não foi alterada, mas não foi exercitada de novo em produção).
- Aparelho físico: só emulação de celular no navegador.
- Sessão de designer e o Onboarding mensal em tela (compartilha a moldura da seção; só conferido por leitura do código).
- Computador em tela larga em captura (o layout de três campos lado a lado foi mantido como era).

## Limitações

- O percentual conta os 31 campos de texto. Produtos e provas não entram na conta.
- A prévia mostra até três campos preenchidos da seção, cortados no espaço disponível.
