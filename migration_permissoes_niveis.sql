-- zzz249: o banco passa a obedecer o nível de cada módulo nas tabelas de conteúdo.
-- pode_nivel(módulo, mínimo): admin sempre; equipe interna precisa do nível
-- (1 ver, 2 editar, 3 total) E de ser equipe de gestão (como antes) OU de uma
-- concessão explícita da administração (exceção da pessoa ou função personalizada).
-- No dia da troca ninguém ganha nem perde: coordenação tem tudo em Total, e
-- designer/videomaker continuam sem escrever nessas tabelas (não são equipe de
-- gestão e não há concessão explícita para elas).
create or replace function public.concessao_explicita(p_modulo text, p_min integer)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.perfil_modulos pm
                  where pm.perfil_id = auth.uid() and pm.modulo = p_modulo and pm.efeito = 'permitir'
                    and public._nivel_num(coalesce(pm.nivel, 'total')) >= p_min)
      or exists (select 1 from public.perfis p join public.funcao_modulos fm on fm.funcao = p.funcao_personalizada and fm.modulo = p_modulo
                  where p.id = auth.uid() and p.funcao_personalizada is not null and public._nivel_num(fm.nivel) >= p_min)
$$;
create or replace function public.pode_nivel(p_modulo text, p_min integer)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select case
    when auth.uid() is null then false
    when public.sou_admin() then true
    when not public.sou_equipe_interna() then false
    else public.nivel_modulo(p_modulo, auth.uid()) >= p_min
         and (public.sou_equipe() or public.concessao_explicita(p_modulo, p_min))
  end
$$;
grant execute on function public.concessao_explicita(text, integer) to authenticated;
grant execute on function public.pode_nivel(text, integer) to authenticated;

alter policy clientes_equipe_escrita on public.clientes with check (public.pode_nivel('clientes', 2));
alter policy clientes_equipe_update on public.clientes using (public.pode_nivel('clientes', 2)) with check (public.pode_nivel('clientes', 2));
alter policy clientes_equipe_delete on public.clientes using (public.pode_nivel('clientes', 3));
alter policy cliente_inteligencia_equipe_escrita on public.cliente_inteligencia with check (public.pode_nivel('clientes', 2));
alter policy cliente_inteligencia_equipe_update on public.cliente_inteligencia using (public.pode_nivel('clientes', 2)) with check (public.pode_nivel('clientes', 2));
alter policy cliente_inteligencia_equipe_delete on public.cliente_inteligencia using (public.pode_nivel('clientes', 3));
alter policy produtos_equipe_escrita on public.produtos with check (public.pode_nivel('clientes', 2));
alter policy produtos_equipe_update on public.produtos using (public.pode_nivel('clientes', 2)) with check (public.pode_nivel('clientes', 2));
alter policy produtos_equipe_delete on public.produtos using (public.pode_nivel('clientes', 3));
alter policy provas_equipe_escrita on public.provas with check (public.pode_nivel('clientes', 2));
alter policy provas_equipe_update on public.provas using (public.pode_nivel('clientes', 2)) with check (public.pode_nivel('clientes', 2));
alter policy provas_equipe_delete on public.provas using (public.pode_nivel('clientes', 3));
alter policy onboardings_equipe_escrita on public.onboardings with check (public.pode_nivel('clientes', 2));
alter policy onboardings_equipe_update on public.onboardings using (public.pode_nivel('clientes', 2)) with check (public.pode_nivel('clientes', 2));
alter policy onboardings_equipe_delete on public.onboardings using (public.pode_nivel('clientes', 3));
alter policy atividades_equipe_update on public.atividades using (public.pode_nivel('clientes', 2)) with check (public.pode_nivel('clientes', 2));
alter policy atividades_equipe_delete on public.atividades using (public.pode_nivel('clientes', 3));
alter policy linhas_editoriais_equipe_escrita on public.linhas_editoriais with check (public.pode_nivel('linhas', 2));
alter policy linhas_editoriais_equipe_update on public.linhas_editoriais using (public.pode_nivel('linhas', 2)) with check (public.pode_nivel('linhas', 2));
alter policy linhas_editoriais_equipe_delete on public.linhas_editoriais using (public.pode_nivel('linhas', 3));
alter policy conteudos_equipe_escrita on public.conteudos with check (public.pode_nivel('linhas', 2));
alter policy conteudos_equipe_update on public.conteudos using (public.pode_nivel('linhas', 2)) with check (public.pode_nivel('linhas', 2));
alter policy conteudos_equipe_delete on public.conteudos using (public.pode_nivel('linhas', 3));
alter policy slides_equipe_escrita on public.slides with check (public.pode_nivel('linhas', 2));
alter policy slides_equipe_update on public.slides using (public.pode_nivel('linhas', 2)) with check (public.pode_nivel('linhas', 2));
alter policy slides_equipe_delete on public.slides using (public.pode_nivel('linhas', 3));
alter policy frames_equipe_escrita on public.frames with check (public.pode_nivel('linhas', 2));
alter policy frames_equipe_update on public.frames using (public.pode_nivel('linhas', 2)) with check (public.pode_nivel('linhas', 2));
alter policy frames_equipe_delete on public.frames using (public.pode_nivel('linhas', 3));
alter policy pilares_equipe_escrita on public.pilares with check (public.pode_nivel('linhas', 2));
alter policy pilares_equipe_update on public.pilares using (public.pode_nivel('linhas', 2)) with check (public.pode_nivel('linhas', 2));
alter policy pilares_equipe_delete on public.pilares using (public.pode_nivel('linhas', 3));
alter policy ideias_equipe_escrita on public.ideias with check (public.pode_nivel('linhas', 2));
alter policy ideias_equipe_update on public.ideias using (public.pode_nivel('linhas', 2)) with check (public.pode_nivel('linhas', 2));
alter policy ideias_equipe_delete on public.ideias using (public.pode_nivel('linhas', 3));
alter policy roteiros_equipe_escrita on public.roteiros with check (public.pode_nivel('roteiros', 2));
alter policy roteiros_equipe_update on public.roteiros using (public.pode_nivel('roteiros', 2)) with check (public.pode_nivel('roteiros', 2));
alter policy roteiros_equipe_delete on public.roteiros using (public.pode_nivel('roteiros', 3));
alter policy cenas_equipe_escrita on public.cenas with check (public.pode_nivel('roteiros', 2));
alter policy cenas_equipe_update on public.cenas using (public.pode_nivel('roteiros', 2)) with check (public.pode_nivel('roteiros', 2));
alter policy cenas_equipe_delete on public.cenas using (public.pode_nivel('roteiros', 3));
alter policy gravacoes_equipe_escrita on public.gravacoes with check (public.pode_nivel('gravacoes', 2));
alter policy gravacoes_equipe_update on public.gravacoes using (public.pode_nivel('gravacoes', 2)) with check (public.pode_nivel('gravacoes', 2));
alter policy gravacoes_equipe_delete on public.gravacoes using (public.pode_nivel('gravacoes', 3));
alter policy status_semanais_equipe_escrita on public.status_semanais with check (public.pode_nivel('semanas', 2));
alter policy status_semanais_equipe_update on public.status_semanais using (public.pode_nivel('semanas', 2)) with check (public.pode_nivel('semanas', 2));
alter policy status_semanais_equipe_delete on public.status_semanais using (public.pode_nivel('semanas', 3));
alter policy status_itens_equipe_escrita on public.status_itens with check (public.pode_nivel('semanas', 2));
alter policy status_itens_equipe_update on public.status_itens using (public.pode_nivel('semanas', 2)) with check (public.pode_nivel('semanas', 2));
alter policy status_itens_equipe_delete on public.status_itens using (public.pode_nivel('semanas', 3));
alter policy status_versoes_equipe_escrita on public.status_versoes with check (public.pode_nivel('semanas', 2));
alter policy status_versoes_equipe_update on public.status_versoes using (public.pode_nivel('semanas', 2)) with check (public.pode_nivel('semanas', 2));
alter policy status_versoes_equipe_delete on public.status_versoes using (public.pode_nivel('semanas', 3));
-- zzz249: quem não pode alterar recebe um ERRO claro em vez de a alteração sumir em silêncio
-- (USING deixa o pedido chegar; o WITH CHECK recusa com 'row-level security', que a tela traduz)
alter policy clientes_equipe_update on public.clientes using (public.sou_equipe_interna()) with check (public.pode_nivel('clientes', 2));
alter policy cliente_inteligencia_equipe_update on public.cliente_inteligencia using (public.sou_equipe_interna()) with check (public.pode_nivel('clientes', 2));
alter policy produtos_equipe_update on public.produtos using (public.sou_equipe_interna()) with check (public.pode_nivel('clientes', 2));
alter policy provas_equipe_update on public.provas using (public.sou_equipe_interna()) with check (public.pode_nivel('clientes', 2));
alter policy onboardings_equipe_update on public.onboardings using (public.sou_equipe_interna()) with check (public.pode_nivel('clientes', 2));
alter policy atividades_equipe_update on public.atividades using (public.sou_equipe_interna()) with check (public.pode_nivel('clientes', 2));
alter policy linhas_editoriais_equipe_update on public.linhas_editoriais using (public.sou_equipe_interna()) with check (public.pode_nivel('linhas', 2));
alter policy conteudos_equipe_update on public.conteudos using (public.sou_equipe_interna()) with check (public.pode_nivel('linhas', 2));
alter policy slides_equipe_update on public.slides using (public.sou_equipe_interna()) with check (public.pode_nivel('linhas', 2));
alter policy frames_equipe_update on public.frames using (public.sou_equipe_interna()) with check (public.pode_nivel('linhas', 2));
alter policy pilares_equipe_update on public.pilares using (public.sou_equipe_interna()) with check (public.pode_nivel('linhas', 2));
alter policy ideias_equipe_update on public.ideias using (public.sou_equipe_interna()) with check (public.pode_nivel('linhas', 2));
alter policy roteiros_equipe_update on public.roteiros using (public.sou_equipe_interna()) with check (public.pode_nivel('roteiros', 2));
alter policy cenas_equipe_update on public.cenas using (public.sou_equipe_interna()) with check (public.pode_nivel('roteiros', 2));
alter policy gravacoes_equipe_update on public.gravacoes using (public.sou_equipe_interna()) with check (public.pode_nivel('gravacoes', 2));
alter policy status_semanais_equipe_update on public.status_semanais using (public.sou_equipe_interna()) with check (public.pode_nivel('semanas', 2));
alter policy status_itens_equipe_update on public.status_itens using (public.sou_equipe_interna()) with check (public.pode_nivel('semanas', 2));
alter policy status_versoes_equipe_update on public.status_versoes using (public.sou_equipe_interna()) with check (public.pode_nivel('semanas', 2));

-- zzz249 (2): módulos novos — WhatsApp, Lixeira, Agenda e recado da equipe
insert into public.modulos (id, rotulo, ordem) values
  ('whatsapp', 'WhatsApp', 130), ('lixeira', 'Lixeira', 140), ('equipe', 'Agenda e recado da equipe', 150)
on conflict (id) do nothing;
insert into public.funcao_modulos (funcao, modulo, nivel) values
  ('coordenador', 'whatsapp', 'total'), ('designer', 'whatsapp', 'total'), ('videomaker', 'whatsapp', 'total')
on conflict do nothing;
alter policy whatsapp_envios_ler on public.whatsapp_envios using (public.sou_equipe_interna() and public.tem_acesso_modulo('whatsapp'));
alter policy whatsapp_grupos_ler on public.whatsapp_grupos using (public.sou_equipe_interna() and public.tem_acesso_modulo('whatsapp'));
-- funções whatsapp_* passam a exigir tem_acesso_modulo('whatsapp') junto de sou_equipe_interna()
alter policy equipe_ausencias_cria on public.equipe_ausencias with check (public.pode_nivel('equipe', 2));
alter policy equipe_ausencias_muda on public.equipe_ausencias using (public.pode_nivel('equipe', 2)) with check (public.pode_nivel('equipe', 2));
alter policy equipe_aniversarios_cria on public.equipe_aniversarios with check (public.pode_nivel('equipe', 2));
alter policy equipe_aniversarios_muda on public.equipe_aniversarios using (public.pode_nivel('equipe', 2)) with check (public.pode_nivel('equipe', 2));
-- equipe_recado_definir: sou_admin() → pode_nivel('equipe', 2)
