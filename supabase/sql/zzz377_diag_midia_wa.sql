-- 4.80.6: só leitura — onde estão os arquivos do WhatsApp (Storage do Supabase × Google Drive)
select json_build_object(
  'buckets', (select json_agg(x) from (select bucket_id, count(*) n, pg_size_pretty(sum((metadata->>'size')::bigint)) tam, max(created_at)::text ultimo
               from storage.objects group by 1 order by sum((metadata->>'size')::bigint) desc nulls last) x),
  'midias', (select json_agg(x) from (select tipo, count(*) total, count(*) filter (where drive_id is not null) drive,
               count(*) filter (where midia_path is not null and drive_id is null) storage,
               count(*) filter (where midia_path is null and drive_id is null) so_whatsapp,
               max(criada_em) filter (where drive_id is not null)::text ultimo_drive
             from wa_mensagens where tipo in ('audio','imagem','video','documento','figurinha') group by 1) x),
  'drive', (select json_agg(x) from (select status, ultimo_erro, conectado_em::text, token_expira_em::text from drive_conexoes order by conectado_em desc limit 3) x),
  'tabelas', (select json_agg(x) from (select relname, pg_size_pretty(pg_total_relation_size(c.oid)) tam from pg_class c join pg_namespace s on s.oid = c.relnamespace
               where s.nspname = 'public' and c.relkind = 'r' order by pg_total_relation_size(c.oid) desc limit 6) x)
) as r;
