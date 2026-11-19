-- 4.83.3: o relógio do Otto guarda a situação da conexão do WhatsApp (open / close / connecting / erro)
alter table public.wa_assistente add column if not exists conexao_estado text, add column if not exists conexao_conferida_em timestamptz;
