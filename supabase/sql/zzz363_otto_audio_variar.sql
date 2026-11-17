-- 4.72.0: alternar áudio e texto — % de chance de uma resposta leve à equipe sair em áudio (0 = nunca).
alter table public.wa_assistente add column if not exists audio_variar int not null default 0;
alter table public.wa_assistente drop constraint if exists wa_assistente_audio_variar_chk;
alter table public.wa_assistente add constraint wa_assistente_audio_variar_chk check (audio_variar between 0 and 60);
