# Sistema B7 · Direção Espectro — pacote de implementação

Tudo o que é preciso para readaptar o Sistema B7 à nova identidade da Branding7.

## Referência visual

As telas e animações estão no artefato **"Sistema B7 — Telas e animações (direção Espectro)"**:
https://claude.ai/artifact/9H5eq7SJvStB3sJWGYxXLi

São 128 telas e animações (computador, celular, portal do cliente, Windows, Android e TV), nos temas claro e escuro. O canvas abre em "Fundamentos": capa, Tokens e Componentes. Comece por eles.

## O que tem no pacote

| Pasta | Conteúdo |
|---|---|
| 01-Manual | Manual de Identidade Visual Branding7 2026 (PDF) |
| 02-Logos | Kit completo em SVG e PNG: vertical, horizontal, símbolo, versões mono branca e preta, lâmpada, B7 e wordmark |
| 03-Grafismos | Padrões da lâmpada (violeta, matriz e coral) e a construção oficial do logo |
| 04-Fonte | Grimblade (OTF), a fonte única do sistema |
| 05-Codigo | `b7-espectro.css`: tokens e peças principais prontos para o global.css |

## Regras de marca no sistema

- Logo branco sobre fundo colorido ou escuro. O logo em degradê só vai sobre fundo branco.
- Não redesenhar, distorcer nem recolorir o logo. Use sempre os arquivos de 02-Logos.
- Grimblade em tudo: títulos, números e texto da interface. A Inter sai.
- O Espectro curto (Violeta → Magenta → Coral) aparece no botão Criar, nas barras de progresso e nos momentos de marca.
- Ações comuns usam Violeta Quantum. O hover usa Roxo Neural.

## Ordem sugerida de implementação

1. **Tokens.** Trocar as variáveis do global.css pelas de `b7-espectro.css` e carregar a Grimblade.
2. **Casca.** A barra lateral azul vira o menu flutuante (84 px, a 24 px das bordas, item ativo em Violeta Quantum). O topo ganha o título grande, a busca em pílula, o sino e o botão Criar no Espectro.
3. **Componentes.** Botão, campo, abas, etiqueta, cartão, aviso e janela, conforme o quadro "Componentes" do canvas.
4. **Telas com desenho próprio.** Login, portal do cliente, ficha A4 do roteiro, telas de celular e Painel de TV.
5. **Animações.** Aberturas, carregamentos e telas em movimento (página "Animações cinematográficas" e "Telas em movimento").

Sugestão: fazer tudo numa branch separada, ou atrás de uma chave de tema, e liberar para a equipe antes dos clientes.
