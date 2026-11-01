/* A equipe (para nomes e fotos no chat) — lida uma vez por sessão. */
import { supabase } from './supabase';
export type Pessoa = { id: string; nome: string; username: string; avatar_url: string | null; last_seen_at: string | null };
let cache: Map<string, Pessoa> | null = null;
export async function pessoas(): Promise<Map<string, Pessoa>> {
  if (cache) return cache;
  const { data } = await supabase.from('perfis').select('id,nome,username,avatar_url,last_seen_at').neq('papel', 'cliente').eq('estado', 'ativa').order('nome');
  cache = new Map((data || []).map((p: any) => [p.id, p]));
  return cache;
}
