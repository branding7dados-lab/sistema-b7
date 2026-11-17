-- 4.59.5: quem é quem, escrito pela agência. Vale por cima do que o Otto
-- deduz das funções no sistema. Chave = id do usuário (perfis.id).
alter table public.wa_assistente add column if not exists quem_e_quem jsonb not null default '{}'::jsonb;
update public.wa_assistente set quem_e_quem = quem_e_quem || jsonb_build_object(
  'a43ad726-1a29-49a7-98ac-2c27287ceee1', 'programador do sistema B7, videomaker e administrador do sistema',
  'ab2c3a65-eb9b-46fc-98f8-88638892d901', 'dono da Branding7 e da Núcleo7'
) where id = 1;
