-- 4.77.0: áudio e texto na mesma resposta (nunca / quando tiver dados / sempre)
alter table public.wa_assistente add column if not exists audio_misto text not null default 'dados';
alter table public.wa_assistente drop constraint if exists wa_assistente_audio_misto_chk;
alter table public.wa_assistente add constraint wa_assistente_audio_misto_chk check (audio_misto in ('nunca', 'dados', 'sempre'));
