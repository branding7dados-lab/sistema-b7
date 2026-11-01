/* Conexão com o mesmo banco do Sistema B7 (Supabase). A chave é a
   "publicável" do site (js/config.js): não é segredo — quem decide o que
   cada um vê são as regras do banco (RLS), igual no site. */
import 'expo-sqlite/localStorage/install';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://rartcafydsaocdzshqcx.supabase.co';
const CHAVE_PUBLICA = 'sb_publishable_N9Ha9Gwmh-jJsXaI5oY7Lw_dY4XAb8e';

export const supabase = createClient(SUPABASE_URL, CHAVE_PUBLICA, {
  auth: { storage: localStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

/* renova a sessão só com o app aberto na frente */
AppState.addEventListener('change', estado => {
  if (estado === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

/* chama a função b7-auth (login, 2 etapas…) e devolve o corpo, inclusive
   quando ela responde com erro (ex.: 401 "Usuário ou senha incorretos") */
export async function chamarAuth(corpo: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('b7-auth', { body: corpo });
  if (!error) return data;
  let msg = 'Não foi possível falar com o servidor. Confira a internet.';
  try {
    const ctx: any = (error as any).context;
    const j = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
    if (j && j.erro) msg = j.erro;
  } catch { /* corpo sem JSON */ }
  throw new Error(msg);
}
