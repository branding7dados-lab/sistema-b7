-- 4.79.2: RELÓGIO do Otto. Bom dia, resumo do dia, avisos, vigia e "esperando o cliente" só rodavam quando chegava
-- mensagem no WhatsApp — de manhã cedo, sem ninguém escrever, o bom dia não saía. Agora o banco chama a função
-- wa-entrada a cada 5 minutos. O segredo nasce aqui (aleatório) e nunca sai do banco.
create table if not exists public.wa_relogio (id int primary key check (id = 1), segredo text not null);
alter table public.wa_relogio enable row level security;
revoke all on public.wa_relogio from anon, authenticated;
insert into public.wa_relogio (id, segredo) values (1, encode(extensions.gen_random_bytes(24), 'hex')) on conflict (id) do nothing;

select cron.unschedule('otto-relogio') where exists (select 1 from cron.job where jobname = 'otto-relogio');
select cron.schedule('otto-relogio', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://rartcafydsaocdzshqcx.supabase.co/functions/v1/wa-entrada',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-b7-relogio', (select segredo from public.wa_relogio where id = 1)),
    body := '{"relogio": true}'::jsonb,
    timeout_milliseconds := 150000);
$$);
