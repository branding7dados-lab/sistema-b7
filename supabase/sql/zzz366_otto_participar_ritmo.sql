-- 4.76.0: o Otto entra na conversa do grupo da equipe sem ser chamado (nunca/pouco/normal)
-- e alterna áudio e texto por ritmo ("1 a cada N respostas") no lugar do sorteio.
alter table public.wa_assistente add column if not exists participar text not null default 'pouco';
alter table public.wa_assistente add column if not exists audio_cada int not null default 0;
alter table public.wa_assistente drop constraint if exists wa_assistente_participar_chk;
alter table public.wa_assistente add constraint wa_assistente_participar_chk check (participar in ('nunca', 'pouco', 'normal'));
alter table public.wa_assistente drop constraint if exists wa_assistente_audio_cada_chk;
alter table public.wa_assistente add constraint wa_assistente_audio_cada_chk check (audio_cada between 0 and 10);
-- quem já usava o sorteio passa para o ritmo equivalente (15% ≈ 1 a cada 5; 30% ≈ 1 a cada 3)
update public.wa_assistente set audio_cada = case when audio_variar >= 30 then 3 when audio_variar > 0 then 5 else audio_cada end, audio_variar = 0 where audio_variar > 0;
