/* Atualiza a tela quando outra pessoa mexe no mesmo registro (Realtime do
   Supabase, que respeita as mesmas regras de acesso). */
import { useEffect } from 'react';
import { supabase } from './supabase';

export function useAoVivo(nome: string, tabelas: { tabela: string; filtro?: string }[], aoMudar: () => void, ativo = true) {
  useEffect(() => {
    if (!ativo) return;
    let canal = supabase.channel(nome + ':' + Math.random().toString(36).slice(2));
    tabelas.forEach(t => {
      canal = canal.on('postgres_changes' as any, { event: '*', schema: 'public', table: t.tabela, ...(t.filtro ? { filter: t.filtro } : {}) }, () => aoMudar());
    });
    canal.subscribe();
    return () => { supabase.removeChannel(canal); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nome, ativo]);
}
