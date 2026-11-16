-- 4.56.2: o assistente se chama Otto
alter table public.wa_assistente alter column nome set default 'Otto';
update public.wa_assistente set nome = 'Otto' where id = 1;
