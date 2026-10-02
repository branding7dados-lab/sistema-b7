# Relatório 2026-10-02-y — Resumo do Mês no padrão do sistema e IA com mais substância

Edge Function `b7-ia` (**publicada**) e front-end. **Nenhuma migration.**

## O que você pediu

1. O Resumo do Mês tem que sair como imagem, no formato dos outros documentos, e seguir o padrão de design do sistema.
2. O texto gerado pela IA estava superficial.
3. (da mensagem anterior) O Resumo do Mês estava difícil de achar.

## 1. Resumo do Mês refeito no padrão do Status Semanal

- **Formato:** 1080 × 1350 (4:5), o mesmo do Status Semanal. Antes era uma folha A4 com visual próprio.
- **Visual:** usa as mesmas peças do Status Semanal — cabeçalho escuro com a marca B7, faixa do cliente com logo e linha editorial, corpo claro, rodapé "B7 / BRANDING7 · RESUMO DO MÊS", mesmas fontes e cores.
- **Conteúdo da página:** leitura do mês (se houver), quatro números (conteúdos publicados, artes, vídeos, gravações), barras por formato e a lista de conteúdos do mês com a situação de cada um (publicado, programado, em produção).
- **Uma página, sempre:** a página é medida de verdade antes de fechar. Mês leve usa letra grande para preencher; mês cheio usa duas colunas na lista e, se precisar, encurta a lista e mostra "+ N conteúdos no mês".
- **Exportação:** botão principal **Baixar imagem** (PNG de 2160 × 2700) e **Baixar PDF** (página 4:5, como o Status Semanal).

**Sobre o "4x3":** o padrão dos documentos do sistema é 4:5 (é o tamanho do Status Semanal), então segui esse. Se você quis mesmo 4:3, me diga se é deitado (paisagem) ou em pé (3:4) que eu ajusto.

## 2. Onde fica

- Botão **Resumo do mês** à vista no cabeçalho da página do cliente, ao lado de "Editar cliente". Continua também no menu ⋯.

## 3. IA com mais substância

O texto era raso porque a IA só recebia contagens. Agora ela recebe o planejamento por trás dos números:

| | Antes | Agora |
|---|---|---|
| Resumo do mês | números e títulos publicados | + objetivo do mês, pilares trabalhados (na ordem de presença), do que trata cada conteúdo publicado, o que está programado e quantos estão em produção |
| Status semanal | dia, tipo, título e situação | + objetivo do mês, pilar e "do que trata" de cada demanda ligada à linha editorial, marcação do que depende do cliente |

As instruções também mudaram:

- O texto tem que dizer o que os números e a lista **não** dizem: que assunto o mês (ou a semana) trabalhou e por quê, o que depende do cliente, o que vem a seguir.
- Proibido enchimento ("agradecemos a parceria", "seguimos à disposição").
- Linguagem do cliente, sem jargão interno (funil, conversão, gatilho, tráfego, premium).
- Descreve a intenção do conteúdo, nunca o efeito ("gerou", "alavancou").
- O objetivo do mês é tratado como anotação interna: orienta o texto, mas não é copiado, e o público do cliente nunca é descrito por renda ou idade.
- Tamanho: leitura do mês até cerca de 760 caracteres (o campo aceita 800); observação da semana até cerca de 480.

Exemplo real, depois da mudança (setembro de um cliente):

> Trabalhamos para maximizar o alcance do seu perfil com conteúdos focados em histórias reais de transformação e relatos de superação, como nos vídeos sobre camuflagem de calvície e teste de hidratação. Também apresentamos a estrutura da clínica e o rigor técnico do transplante e da terapia capilar […] Neste período, planejamos 22 conteúdos e publicamos 17, realizamos 1 gravação e entregamos 19 vídeos. Temos 5 materiais em produção para as próximas etapas.

A conferência de números continua: número que não está entre os contados pelo sistema (ou que não aparece num título/texto da equipe) invalida a resposta.

## Arquivos

- `js/resumo-mes.js` (reescrito), `styles/print.css` (bloco do resumo reescrito), `js/dashboard.js` (botão), `supabase/functions/_shared/ia/resumo.ts`, `IA.md`, `sw.js`, `js/auth.js` (versão `2026-10-02-y`).

## Testes executados

**Automatizados:** nenhum.

**Servidor publicado, IA de verdade, dados reais, sessão aberta no navegador daqui** (só leitura, nada aplicado):

- Leitura do mês de setembro para 3 clientes, em três rodadas de ajuste das instruções (7 gerações): conferi os números de cada texto com os da folha; todos bateram.
- Observação da semana para 3 status reais, nas mesmas rodadas (7 gerações).
- Nas rodadas intermediárias apareceram e foram corrigidos: frase de efeito inventado ("ajudaram a alavancar o topo de funil"), jargão interno ("gera escassez e urgência") e descrição do público por renda copiada do objetivo interno.

**Página local com a tela de verdade e dados simulados:**

- Página 1080 × 1350 montada com 0, 4, 6, 9, 13, 22 e 30 conteúdos, com e sem leitura: coube em uma página em todos os casos; com 30 conteúdos e leitura, listou 22 e mostrou "+ 8 conteúdos no mês".
- Mês leve subiu para letra grande; mês cheio ficou no tamanho normal em duas colunas.
- Janela: prévia inteira visível, "Escrever com IA" → Aplicar → leitura aparece na página.
- **Baixar imagem:** PNG de 2160 × 2700 gerado. **Baixar PDF:** arquivo gerado.
- Conferi visualmente a página em captura de tela.

**Não testado:**

- A janela nova no site publicado com um cliente real (logo real do cliente na imagem).
- Como a imagem aparece no WhatsApp.
- Celular e aparelho físico.

## Limitações

- O modelo é pequeno: a redação melhorou bastante, mas ainda pode sair uma frase dura ("Fizemos 22 conteúdos planejados"). Leia antes de enviar.
- A profundidade depende do que está preenchido na Linha Editorial: sem objetivo do mês, pilares e ideia dos conteúdos, a IA volta a ter só números e títulos.
- A IA não tem dados de resultado (alcance, engajamento). Uma leitura de desempenho só será possível com a integração do Instagram.
- A leitura do mês continua só em memória (some ao recarregar a página).
