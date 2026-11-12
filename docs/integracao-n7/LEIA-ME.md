# Site da Branding7 → banco do N7

O Sistema B7 envia, a cada minuto (contatos na hora), as métricas e os contatos do site
branding7.com.br para o banco do N7, **só em tabelas novas com final `_b7`**.
Nada do N7 é alterado ou apagado.

## Tabelas (`n7_tabelas_b7.sql`)
| tabela | o que tem | chave |
|---|---|---|
| `site_leads_b7` | contatos do formulário (nome, WhatsApp, cidade, interesse, mensagem, fonte, campanha, status) | `id` |
| `site_eventos_b7` | cada evento do site: visita, engajou, vídeo, WhatsApp, formulário, lead, Instagram | `id` |
| `site_metricas_dia_b7` | por dia: visitantes, engajaram, clicaram para falar, leads, cliques, aparelhos | `dia` |
| `site_origens_dia_b7` | por dia e fonte (meta, instagram, google, direto...) | `dia, fonte` |
| `site_campanhas_dia_b7` | por dia e campanha (utm_campaign) | `dia, campanha` |
| `site_resumo_b7` | resumo pronto de 7, 30 e 90 dias (JSON) | `periodo_dias` |

Reenviar o mesmo dado só atualiza a própria linha `_b7` (ex.: status do contato).
Os últimos 3 dias são recalculados a cada envio (o dia de hoje muda a cada visita).

## Como ligar
1. **N7:** rodar `n7_tabelas_b7.sql` uma vez no SQL Editor do projeto.
2. **B7 (Kevin):** Supabase do Sistema B7 → Edge Functions → Secrets:
   - `N7_URL` = `https://<projeto-do-n7>.supabase.co`
   - `N7_SERVICE_KEY` = chave **service_role** do N7 (de preferência a nova, depois de trocar a que foi exposta no chat).
3. Os dados chegam em até 1 minuto (função `n7-sync`, job `n7-sync` no pg_cron do B7, a cada minuto); contato novo ou mudança de status vai na hora (gatilho em `site_leads`).

## Conferir
```sql
select * from site_metricas_dia_b7 order by dia desc;
select nome, cidade, interesse, fonte, status, criado_em from site_leads_b7 order by criado_em desc;
select periodo_dias, dados->'funil' from site_resumo_b7;
```
