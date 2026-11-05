-- 4.11.0: ranking aceita o jogo 'memoria' (aplicada via MCP)
CREATE OR REPLACE FUNCTION public.jogo_registrar_v2(p_pontos integer, p_jogo text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare j text := case when p_jogo in ('corta', 'corrida', 'memoria') then p_jogo else 'corta' end;
begin
  if auth.uid() is null or p_pontos is null or p_pontos <= 0 then return; end if;
  if exists (select 1 from public.jogo_pontos where perfil_id = auth.uid() and created_at > now() - interval '5 seconds') then return; end if;
  insert into public.jogo_pontos (perfil_id, pontos, jogo) values (auth.uid(), least(p_pontos, 1000000), j);
end $function$;
