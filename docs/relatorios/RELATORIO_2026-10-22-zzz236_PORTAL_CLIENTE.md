# zzz236: revisão do Portal do cliente

Pedido do Kevin: "vamos também ver a questão do portal do cliente".

## Corrigido
| Problema | Correção |
|---|---|
| **Aprovação às cegas:** a "Peça de design" ia para o cliente aprovar sem a arte (o bucket `design-files` só deixava a equipe ler) | Função `design_arquivo_de_aprovacao_visivel` + política de leitura no Storage: quem vê a empresa lê **só** os arquivos do snapshot de uma aprovação de design dela. O Portal mostra a arte (URL assinada), e Aprovar/Ajustes/Recusar ficam travados até ela carregar. Sem arte: aviso para falar com a Branding7 |
| Tipo aparecia como "design_versao" | Rótulo "Peça de design" |
| No celular as abas das Aprovações sumiam (o CSS interno esconde `.ap-abas` ≤760px) | O Portal usa a classe própria `pt-abas` |
| Erro de carga aparecia como "Nada por aqui" (Aprovações, Produção, Gravações, Status, Histórico, Linha) | Tela de erro com "Tentar de novo" e "Início" |
| Erro ao abrir um material: frase solta sem saída | Erro com "Tentar de novo" e "Ver Aprovações" |
| Telas lentas desenhavam por cima de outra tela | `B7.Rota.marca()` em todas as telas do Portal. Nas Aprovações, só a última troca de aba desenha |
| Trocar de empresa mantinha o tempo real da empresa anterior | O canal é fechado na troca |
| Conflito de versão (outra pessoa decidiu, versão nova) só recarregava em 2 dos 6 comandos | Todos os comandos recarregam a tela ao detectar o conflito |
| Histórico listava "parcial" (ainda aberto) como decidido | Fica de fora |

## Banco
`migration_portal_design_arte.sql` (aplicada). Conferida: arquivo do snapshot visível, outro arquivo e usuário estranho bloqueados.

## Ficou para depois (precisa de decisão)
- O cliente consegue ler, via API, colunas internas da própria linha (ex.: nota interna do serviço, motivo de anulação não marcado como visível). Para fechar isso é preciso separar essas colunas em tabela própria ou servir o Portal por views. Essa mudança de estrutura afeta telas internas, então vai num pacote separado.

## Conferido
Capturas da prévia do cliente no computador e no celular: a arte aparece e as abas também. `npm test` passou.
