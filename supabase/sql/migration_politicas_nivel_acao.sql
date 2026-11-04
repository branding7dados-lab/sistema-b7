-- zzz279: as regras de escrita de conteúdo conferiam só a AÇÃO (pode_acao);
-- agora conferem também o NÍVEL do módulo (Editar ou Total). A conferência de
-- segurança (Configurações → Funções) apontava 12 regras sem nível.
-- Aplicada como: politicas_nivel_acao. Ninguém perdeu acesso que tinha
-- (conferido: Kaique/videomaker continua criando e editando gravação).
create or replace function public.pode_nivel_acao(p_acao text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    when public.sou_admin() then true
    else public.pode_acao(p_acao)
         and public.nivel_modulo((select modulo from public.acoes where id = p_acao), auth.uid()) >= 2
  end
$$;
revoke execute on function public.pode_nivel_acao(text) from public, anon;
grant execute on function public.pode_nivel_acao(text) to authenticated;

alter policy cenas_equipe_escrita on public.cenas with check ((select public.pode_nivel_acao('roteiro.editar')));
alter policy cenas_equipe_update on public.cenas using ((select public.pode_nivel_acao('roteiro.editar'))) with check ((select public.pode_nivel_acao('roteiro.editar')));
alter policy roteiros_equipe_escrita on public.roteiros with check ((select public.pode_nivel_acao('roteiro.editar')));
alter policy roteiros_equipe_update on public.roteiros using ((select public.pode_nivel_acao('roteiro.editar'))) with check ((select public.pode_nivel_acao('roteiro.editar')));
alter policy clientes_equipe_escrita on public.clientes with check ((select public.pode_nivel_acao('cliente.criar')));
alter policy clientes_equipe_update on public.clientes using ((select public.pode_nivel_acao('cliente.editar'))) with check ((select public.pode_nivel_acao('cliente.editar')));
alter policy conteudos_equipe_escrita on public.conteudos with check ((select public.pode_nivel_acao('linha.editar')));
alter policy conteudos_equipe_update on public.conteudos using ((select public.pode_nivel_acao('linha.editar'))) with check ((select public.pode_nivel_acao('linha.editar')));
alter policy linhas_editoriais_equipe_escrita on public.linhas_editoriais with check ((select public.pode_nivel_acao('linha.editar')));
alter policy linhas_editoriais_equipe_update on public.linhas_editoriais using ((select public.pode_nivel_acao('linha.editar'))) with check ((select public.pode_nivel_acao('linha.editar')));
alter policy gravacoes_equipe_escrita on public.gravacoes with check ((select public.pode_nivel_acao('gravacao.criar')));
alter policy gravacoes_equipe_update on public.gravacoes using ((select public.pode_nivel_acao('gravacao.editar'))) with check ((select public.pode_nivel_acao('gravacao.editar')));
