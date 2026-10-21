# Relatório — zzz217 · Suporte com perguntas frequentes

**Versão:** `2026-10-21-zzz217` · **Cache:** `roteiros-b7-v420`
**Pedido:** "uma função que envolva a área de suporte diretamente… perguntas mais frequentes… só abrir um suporte se realmente for necessário… falar com assistente ou falar com suporte."

## Equipe — #/suporte
1. **"Como podemos ajudar?"** com uma caixa só para escrever a dúvida. Atalhos menores ao lado: Relatar um problema, Mandar uma ideia, Elogiar, Abrir uma dúvida.
2. Sem nada escrito: a lista de **Perguntas frequentes** (abre e fecha).
3. Ao escrever: **Respostas prontas** (até 3, a primeira já aberta) e **Tutoriais sobre isso**. Cada resposta tem "Isso resolveu? Sim / Não".
4. **Perguntar ao assistente**: a resposta aparece ali mesmo, com base nas perguntas frequentes e nos tutoriais, também com "Isso resolveu?". Fica guardada no histórico de conversas do assistente da pessoa.
5. **Falar com a equipe**: abre o chamado de Dúvida já com o resumo e "Já tentei: perguntas X… / o assistente respondeu…".
6. Seus chamados e Ideias da equipe continuam embaixo.

## Administração — Central de atendimento
- Aba nova **Perguntas frequentes**: números de 30 dias (resolvidas pelas perguntas, pelo assistente, viraram chamado, sem resposta), a lista com "N resolveu / N não resolveu" de cada pergunta, **Editar** e **+ Nova pergunta**.
- **O que procuram e não acham**: buscas sem resposta pronta e respostas marcadas como "não resolveu", com **Criar pergunta** já preenchido.
- Em cada chamado: **Virar pergunta frequente** (título do chamado + última resposta da equipe).
- Editor: pergunta, resposta, palavras parecidas, tutorial ligado, ordem, no ar / fora do ar (nada é apagado).

## Assistente (b7-ia)
- O chat do assistente e o Suporte mandam os ids das perguntas frequentes parecidas (`faq_ids`); o servidor lê o texto no banco (só as que estão no ar) e responde por elas.
- Vindo do Suporte (`origem: 'suporte'`), o assistente só responde: não propõe criar demanda, gravação etc.

## Banco (aplicado; `migration_suporte_faq.sql`)
- `suporte_faq` (equipe interna lê as que estão no ar; admin/coordenação leem todas; escrita só pela função `suporte_faq_salvar`).
- `suporte_autoajuda` (sem acesso direto; `suporte_autoajuda_registrar` grava, até 60 por pessoa por hora; `suporte_autoajuda_resumo` só para admin/coordenação).
- 15 perguntas iniciais escritas a partir dos tutoriais: senha, esqueci a senha, foto e nome, notificações, desligar aviso, app do celular, programa do Windows, modo escuro, lentidão, entregar várias demandas, remarcar gravação, recuperar algo apagado, busca rápida, WhatsApp, sair da conta.

## Testes
- Sintaxe dos arquivos e `npm test` (todas as telas abrem).
- Prints com dados simulados: tela da equipe (vazia, com dúvida, com resposta do assistente, sem resposta → chamado), Central (chamado com "Virar pergunta frequente", aba Perguntas frequentes, editor), computador e celular.

## Não testado
- Com contas reais: resposta real do assistente vinda do Suporte, os registros de "resolveu" e os números da aba nova.
