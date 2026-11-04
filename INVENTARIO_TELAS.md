# Sistema B7 — todas as telas e animações (versão zzz308)

Levantado do código em 04/11/2026. A coluna **Endereço** mostra o que aparece na barra (`#/…`). A coluna **Quem vê** usa estas siglas:

| Sigla | Papel |
|---|---|
| A | Administrador |
| Co | Coordenação |
| De | Designer |
| Vi | Videomaker |
| Cl | Cliente (Portal) |

---

## 1. Antes de entrar

| Tela | O que tem |
|---|---|
| Login | Usuário e senha, entrar com Google |
| Verificação em 2 etapas | Código por e-mail (ou botão no e-mail) ou app autenticador |
| Esqueci minha senha | Código no e-mail de recuperação e senha nova |
| Pedido de acesso | Quem ainda não tem permissão pede para entrar |
| Senha provisória (cliente) | Aviso para trocar a senha no primeiro acesso |
| Abertura | Animação da marca ao abrir o sistema (ver seção 7) |
| Carregamento | Versão curta da abertura ao recarregar (ver seção 7) |

---

## 2. Estrutura fixa (aparece em todas as telas da equipe)

| Peça | O que tem |
|---|---|
| Barra lateral (computador) | Menu de módulos, recolher/expandir, cartão da conta no pé |
| Perfil lateral | Status (disponível, não perturbe…), Meu dia, tema, atalhos |
| Topo | Título da tela, busca, sino de notificações, Criar |
| Barra de baixo (celular) | Abas principais em vidro líquido, botão "Mais" |
| Folha "Mais" (celular) | Saudação, Meu dia, busca de telas, "Usados por você", grupos de módulos |
| Notificações | Lista do sino, marcar como lida |
| Assistente de IA (chat) | Conversa, ferramentas, respostas em blocos visuais |
| Conversas | Chat da equipe (lista e conversa) |
| Meu dia (Hoje) | O que a pessoa tem para fazer hoje |
| Novidades | Cartão "o que mudou" de cada versão |
| Tour | Apresentação guiada para quem é novo |
| Menu de contexto | Botão direito / segurar o dedo nos cartões |
| Toasts | Avisos curtos (salvo, erro, nova versão) |
| Recado fixo da equipe | Faixa no alto da tela |
| Ao vivo | Acompanhar a tela de outra pessoa (administração) |

---

## 3. Telas da equipe

### Início e visão geral
| Tela | Endereço | Quem vê | O que tem |
|---|---|---|---|
| Panorama (início) | `#/` | A, Co | O dia da agência: atrasos, o que vence, o que espera você |
| Painel | `#/painel` | todos da equipe | Uma visão por função: Vídeo, Design, Coordenação ou várias juntas |
| Painel de TV | `#/tv` | A | Telão da agência com a produção |
| Gestão | `#/gestao` | A | 6 abas: **Visão geral**, **Equipe**, **Saúde dos clientes**, **Avulsos**, **Pedidos** e **Recados** |

### Clientes
| Tela | Endereço | Quem vê | O que tem |
|---|---|---|---|
| Clientes | `#/clientes` | A, Co | Carteira de clientes, fixar, buscar |
| Cliente | `#/cliente/<id>` | A, Co (De e Vi só leem) | 10 seções, listadas abaixo |
| Prévia do Portal | `#/previa/<id>` | A | Ver o Portal como o cliente vê |

As 10 seções da tela do cliente:
1. Visão geral (métricas, últimas gravações, oportunidades)
2. Editorial
3. Gravações
4. Roteiros
5. Vídeos
6. Design
7. Ideias
8. Projetos
9. Inteligência (ICP, posicionamento)
10. Arquivados

### Planejamento
| Tela | Endereço | Quem vê | O que tem |
|---|---|---|---|
| Linhas editoriais | `#/linhas` | A, Co, De | Todas as linhas do mês |
| Linha editorial | `#/linha/<id>` | A, Co, De | Conteúdos do mês, Criativo (painel lateral), status de cada peça |
| Publicações do dia | `#/publicacoes` | A, Co | O que sai hoje em todos os clientes |
| Calendário | `#/calendario` | todos | Mês/semana, gravações e oportunidades, Google Agenda |
| Oportunidades | `#/oportunidades` | A, Co | Datas comemorativas com fonte e relevância por cliente |
| Trends | `#/trends` | A, Co, Vi | Mural de tendências |

### Gravação
| Tela | Endereço | Quem vê | O que tem |
|---|---|---|---|
| Gravações | `#/gravacoes` | A, Co, Vi | Cartões das sessões, situação, prévia dos roteiros |
| Gravação (diária) | `#/gravacao/<id>` | A, Co, Vi, De | A sessão: roteiros, cenas e itens gravados |
| Editor de roteiro | `#/gravacao/<id>/roteiros` | A, Co | Escrita do roteiro, cenas, IA |
| Roteiros | `#/roteiros` | A, Co, Vi | Todos os roteiros |
| Teleprompter | (tela cheia) | A, Co, Vi | Leitura do roteiro com rolagem |
| Apresentação (slides) | (tela cheia) | A, Co | Roteiro em modo apresentação |

### Produção
| Tela | Endereço | Quem vê | O que tem |
|---|---|---|---|
| Produção de Vídeo | `#/video` | A, Co, Vi | Cartão-resumo do mês, filtros, Quadro (6 colunas) ou Lista, seleção em lote |
| Demanda de vídeo | `#/video/<id>` | A, Co, Vi | Etapas, versões, comentários com tempo, conclusão, roteiros vinculados |
| Gestão de vídeo (janela) | — | A, Co | Resumo do mês, carga da equipe, por cliente e por videomaker, fechar mês |
| Design | `#/design` | A, Co, De | Fila de peças, abas **Equipe**, **Finalizadas** e **Todas**, quadro |
| Peça de design | `#/design/<id>` | A, Co, De | Versões, ajustes, aprovação |
| Design da linha | `#/design/linha/<id>` | A, Co, De | Peças de uma linha editorial |
| Kanban geral | `#/kanban` | A, Co | Demandas avulsas em colunas |
| Projetos | `#/projetos` | A | Projetos avulsos e o detalhe de cada um |
| Legendas | `#/legendas` | A, Co | 3 abas: **Consertar** (.srt com IA), **Histórico** e **Marcas e termos** |

### Cliente e aprovação
| Tela | Endereço | Quem vê | O que tem |
|---|---|---|---|
| Aprovações | `#/aprovacoes` | A, Co | O que está com o cliente, comentários |
| Aprovação | `#/aprovacoes/<id>` | A, Co | Detalhe com as partes e os comentários |
| Status semanal | `#/semanas` | A, Co | Relatórios de 7 dias |
| Status da semana | `#/semana/<id>` | A, Co | Documento da semana, pronto para enviar |
| WhatsApp | `#/whatsapp` | A | Grupos dos clientes, esperando resposta, possível aprovação |

### Ajuda e outros
| Tela | Endereço | Quem vê |
|---|---|---|
| Ajuda | `#/ajuda` | todos |
| Suporte (chamados) | `#/suporte` | todos |
| Lixeira | `#/lixeira` | A |
| Arquivados | `#/arquivados` | A, Co |
| Retrospectiva / Resumo do mês | (janela) | todos |

### Configurações (`#/config`)

**Você** (todos):
- Perfil
- Senha e segurança
- Notificações
- Preferências
- Aparência
- Abertura e sons
- Teleprompter
- Apps e TV
- Este aparelho

**Administração**:
- Pessoas e acessos (Colaboradores, Parceiros B7 e Clientes)
- Funções e permissões
- Pacotes de produção
- Equipe
- Ausências e aniversários
- Sistema da equipe
- Saúde e manutenção

**Super admin**:
- Painel
- Pedidos para aprovar
- Limites dos administradores
- Segurança
- Uso e backup
- Avaliações do suporte
- Supremo

---

## 4. Portal do cliente (Cl)

| Tela | Endereço |
|---|---|
| Início do Portal | `#/` |
| Aprovações | `#/aprovacoes` |
| Revisar uma peça | `#/revisar/<id>` |
| Minha linha editorial | `#/minha-linha` |
| Minha produção | `#/minha-producao` |
| Minhas gravações | `#/minhas-gravacoes` |
| Meus status | `#/meus-status` |
| Calendário de publicações | `#/meu-calendario` |
| Pedidos | `#/pedidos` |
| Histórico | `#/historico` |
| Equipe da empresa (Dono e Gestor) | `#/equipe` |
| Perfil | `#/perfil` |
| Suporte | `#/suporte` |
| Pesquisa de satisfação | (janela) |
| Comunicados da B7 | (faixa e janela) |

---

## 5. Janelas que aparecem dentro das telas

Ficam por cima da tela, sem trocar de endereço:

- Nova demanda (vídeo e design)
- Mover para…
- Confirmar
- Perguntar ("o que precisa corrigir?")
- Registrar decisão do cliente
- Repasse de quem sai
- Convidar
- Foto de perfil (recorte)
- Imprimir
- Importar planilha
- Descartados

---

## 6. Programa do Windows e app Android

As telas são as mesmas acima. Cada plataforma tem algumas peças próprias:

- **Windows:**
  - janelas de aviso com a cara do B7;
  - atualização do programa;
  - pílula "Tela compartilhada".
- **Android:**
  - atalhos do ícone;
  - aviso de conversa estilo WhatsApp (Responder, Marcar como lida, Silenciar);
  - convite para instalar o app.

---

## 7. Animações

### Abertura (ao abrir o sistema), 9 estilos
| Estilo | Como é |
|---|---|
| Streaming (padrão) | Faixas de luz |
| Hiperespaço | Estrelas e o salto |
| Tinta | Gotas de tinta nas cores da marca giram até o logo |
| Glitch | Tela de terminal digitando "B7_SISTEMA", estoura no logo |
| Aurora | Céu estrelado com cortinas de aurora |
| Neon | Letreiro liga com faíscas |
| Mosaico | Quadrados viram das bordas e revelam o logo |
| Big bang | Big bang de ideias com câmera 3D |
| Clássica | A original |

Tem também o **som da abertura**.

### Carregamento (ao recarregar), 6 estilos
- Relâmpago (padrão)
- Pulso
- Órbita
- Barra
- Brilho
- Pontos

### Movimento entre telas
| Animação | Onde |
|---|---|
| Morph entre módulos | Trocar de módulo: a tela que sai desfoca e recua, a nova chega de baixo (View Transitions) |
| Voo do cartão | Abrir um cartão: ele cresce até virar a tela de detalhe, com brilho enquanto carrega |
| Deslizar entre abas | Celular: arrastar para o lado vai para a aba vizinha |
| Puxar para atualizar | Celular: puxar o topo para baixo, com o indicador girando |
| Direção da navegação | Ir mais fundo, voltar ou ir para o lado, cada um com um movimento |
| Entrada da tela | Conteúdo sobe de leve ao abrir (`entra`) |
| Cascata dos cartões | Cartões entram um depois do outro |

### Peças animadas
- **Vidro líquido:** a barra de baixo distorce o que passa atrás (Chromium).
- **Cartão-resumo do vídeo:** números em odômetro, anel de progresso com cometa, barra por etapa.
- **Esqueleto de carregamento:** blocos com faixa de luz na diagonal.
- **Arrastar no quadro:** cartão fantasma, coluna que acende e cartão que assenta ao soltar.
- **Toasts:** entrada, saída e empilhamento.
- **Configurações:** seletor com pílula deslizante e chaves liga/desliga.
- **Botões e cartões:** sombra e escala ao tocar ou passar o mouse.
- **Prévia dos roteiros:** aparece ao passar o mouse na gravação.

Quase tudo respeita "Reduzir movimento". Em Configurações → Aparência dá para desligar as animações.
