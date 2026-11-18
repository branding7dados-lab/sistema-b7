-- 4.82.0: "Assuntos e responsáveis" — o que é da Branding7 (o Otto avisa), o que é de outra equipe (Núcleo7: o Otto
-- não cobra a gente), quem responde por cada assunto/cliente (marca a pessoa certa) e instruções livres.
alter table public.wa_assistente add column if not exists avisos_regras jsonb;
update public.wa_assistente set avisos_regras = jsonb_build_object(
  'nossos', 'vídeos, artes, edição, gravação, roteiros, legendas, aprovação de material, publicação de posts',
  'outros', jsonb_build_array(jsonb_build_object('equipe', 'Núcleo7',
     'assuntos', 'comercial, vendas, tráfego pago, anúncios e impulsionamento, links de pagamento, orçamentos, cobrança, contratos, CRM e automações')),
  'responsaveis', jsonb_build_array(jsonb_build_object('cliente_id', '4c6f5645-5d0c-4a72-8ec1-895dc1fd329f', 'assunto', 'artes', 'pessoa_id', 'd2723d4a-13e2-450b-8e16-e280af66b9a7')),
  'instrucoes', ''
) where id = 1 and avisos_regras is null;
