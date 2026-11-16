-- 4.55.0: atividade do assistente (tela: Visão geral) + horário de atendimento + ouvir áudios
create table if not exists public.wa_assistente_registro (
  id uuid primary key default gen_random_uuid(),
  em timestamptz not null default now(),
  tipo text not null,              -- resposta | duvida | repasse | instrucao | fora_horario | teste | erro
  jid text, grupo text, autor text,
  pergunta text, resposta text,
  provedor text, modelo text, tokens_entrada int, tokens_saida int, ms int
);
create index if not exists wa_assistente_registro_em on public.wa_assistente_registro (em desc);
alter table public.wa_assistente_registro enable row level security;
drop policy if exists wa_assistente_reg_ver on public.wa_assistente_registro;
create policy wa_assistente_reg_ver on public.wa_assistente_registro for select to authenticated using (public.sou_admin());
grant select on public.wa_assistente_registro to authenticated;
alter table public.wa_assistente add column if not exists horario jsonb not null default '{"ativo":false,"ini":"08:00","fim":"18:00","dias":[1,2,3,4,5],"mensagem":"Oi! Nosso time está fora agora, mas já anotei aqui. Amanhã cedinho a gente te responde 😉"}';
alter table public.wa_assistente add column if not exists ouvir_audio boolean not null default true;
