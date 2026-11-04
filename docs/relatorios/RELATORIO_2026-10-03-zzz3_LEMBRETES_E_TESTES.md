# Relatório — lembretes da produção e testes automáticos (pacote zzz3, 03/10)

Pedido: itens 8 e 11.

## 8. Lembretes automáticos (`migration_lembretes_producao.sql`, aplicada)

### O que já existia (não foi refeito)
- Agenda: 24h e 1h antes da gravação ou apresentação.
- Prazos de vídeo e design: vence amanhã, atrasou, atraso escalado.
- Resumo diário às 8h.
- Peça de design parada.
- Lembrete ao cliente: continua fora. Nenhum cliente usa o Portal, então o aviso não chegaria a ninguém.

### O que faltava: três avisos novos
Todos saem às 8h, na rodada agendada que já existe. Não duplicam no mesmo dia e respeitam as preferências de cada pessoa.

| Aviso | Quando | Quem recebe |
|---|---|---|
| **Gravação amanhã com roteiro em aberto** | véspera da gravação, todo dia, se houver roteiro que não está "Pronto para gravar" ou se não houver roteiro nenhum. Um aviso por gravação | videomaker da gravação, coordenação, admin com "Atrasos críticos" |
| **Gravação sem conclusão** | dia útil, quando há gravação com a data já passada que continua Agendada ou Pendente. Um aviso com a contagem | coordenação, admin com "Atrasos críticos" |
| **Conteúdo parado na revisão** | dia útil, quando há conteúdo "Em revisão" há 3 dias ou mais. Um aviso com a contagem | coordenação ("Aguardando revisão"), admin com "Revisões pendentes" |

Ensaio com os dados reais, dentro de uma transação desfeita no final. Conferi depois que nada ficou gravado.
- **Domingo, 04/10:** 3 avisos "Gravações de Outubro · 3 de 3 roteiros ainda não estão prontos" (gravação de segunda, 05/10).
- **Mesmo dia, de novo:** 0 avisos. Não duplica.
- **Segunda, 05/10:**
  - "5 gravações já passaram e não foram marcadas como gravada ou cancelada · a mais antiga, há 19 dias";
  - "9 conteúdos aguardando revisão há 3 dias ou mais · o mais antigo, há 26 dias".
- **Primeiro envio real:** amanhã (04/10) às 8h, o de roteiro em aberto. Os outros dois na segunda (05/10).
- **No sistema:** os três avisos entram no filtro "Prazos" do sino, e as descrições das preferências foram atualizadas.

## 11. Testes automáticos (`testes/`, `.github/workflows/testes.yml`)
A cada envio ao GitHub, rodam três testes:
1. **Sintaxe:** todos os 56 arquivos .js compilam, e todo arquivo listado no service worker existe.
2. **Memória de dados:** as regras do `js/memoria.js`. Leitura recente não volta ao banco, escrita força ir ao banco, resposta antiga sai na hora e redesenha quando muda, o editor nunca vem da memória e não há memória sem login.
3. **Fumaça:** abre o sistema num Chromium de celular (390×844) com o banco simulado e passa por 19 telas. Falha se alguma lançar erro de JavaScript, abrir vazia ou mostrar mensagem de erro.

Prova de que o teste pega defeito: estraguei o Kanban de propósito, o teste acusou "#/kanban → erro de JavaScript" e depois desfiz.

**Para rodar no computador:** `cd testes && npm install && npm test`.

**Limite:** o GitHub Pages publica direto do main, então o teste avisa (vermelho ou verde no PR e no commit), mas não segura a publicação sozinho. Eu confiro o resultado antes de cada merge.
