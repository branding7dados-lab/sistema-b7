-- zzz296: Equipe ao vivo em canais PRIVADOS (Realtime Authorization).
-- Antes o canal "b7-aovivo" era público: qualquer um com a chave pública
-- do site podia entrar nele. Agora:
--   b7-aovivo        (quem está online e em que tela) → só a equipe interna
--   b7-aovivo:<id>   (o espelho da tela da pessoa)     → só a própria pessoa
--                                                        e os super admins
-- Canais públicos de outras telas não são afetados (estas regras só valem
-- para canais abertos com private: true).

create policy "b7 aovivo: ler" on realtime.messages
  for select to authenticated
  using (
    (realtime.topic() = 'b7-aovivo' and public.sou_equipe_interna())
    or (realtime.topic() = 'b7-aovivo:' || auth.uid()::text and public.sou_equipe_interna())
    or (realtime.topic() like 'b7-aovivo:%' and public.sou_superadmin())
  );

create policy "b7 aovivo: enviar" on realtime.messages
  for insert to authenticated
  with check (
    (realtime.topic() = 'b7-aovivo' and public.sou_equipe_interna())
    or (realtime.topic() = 'b7-aovivo:' || auth.uid()::text and public.sou_equipe_interna())
    or (realtime.topic() like 'b7-aovivo:%' and public.sou_superadmin())
  );
