-- 4.67.7: velocidade do Otto.
--   velocidade     : 'rapido' (digitando ~0,5 s) | 'natural' (proporcional ao tamanho, 0,7–2,5 s) | 'humano' (espera_min_s..espera_max_s)
--   audio_humano   : completa o "gravando áudio…" proporcional à duração do áudio (mais lento, mais "gente")
--   audio_roteiro  : reescrever a resposta como fala antes da voz — 'auto' (só quando precisa) | 'sempre' | 'nunca'
--   audio_max_s    : duração máxima do áudio (segundos)
alter table public.wa_assistente add column if not exists velocidade text not null default 'natural';
alter table public.wa_assistente add column if not exists audio_humano boolean not null default false;
alter table public.wa_assistente add column if not exists audio_roteiro text not null default 'auto';
alter table public.wa_assistente add column if not exists audio_max_s int not null default 40;
alter table public.wa_assistente drop constraint if exists wa_assistente_velocidade_chk;
alter table public.wa_assistente add constraint wa_assistente_velocidade_chk check (velocidade in ('rapido', 'natural', 'humano'));
alter table public.wa_assistente drop constraint if exists wa_assistente_audio_roteiro_chk;
alter table public.wa_assistente add constraint wa_assistente_audio_roteiro_chk check (audio_roteiro in ('auto', 'sempre', 'nunca'));
alter table public.wa_assistente drop constraint if exists wa_assistente_audio_max_chk;
alter table public.wa_assistente add constraint wa_assistente_audio_max_chk check (audio_max_s between 15 and 120);
