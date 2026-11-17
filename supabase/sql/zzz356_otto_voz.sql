-- 4.62.0: voz do Otto — estilo de fala e voz da ElevenLabs (opcional)
alter table public.wa_assistente add column if not exists voz_estilo text not null default 'animado, simpático e natural, como um colega de trabalho brasileiro mandando áudio no WhatsApp';
alter table public.wa_assistente add column if not exists voz_provedor text not null default 'gemini';   -- 'gemini' | 'elevenlabs'
alter table public.wa_assistente add column if not exists voz_eleven_id text;                          -- id da voz (inclusive clonada) na ElevenLabs
