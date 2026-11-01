/* Quem está usando o app: a sessão do Supabase + o perfil (minha_sessao),
   o mesmo que o site lê. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Perfil = { id: string; username: string; nome: string; papel: string; avatar_url: string | null;
  eh_admin: boolean; funcao: string | null; funcoes_extra: string[] | null };

type Ctx = { carregando: boolean; sessao: Session | null; perfil: Perfil | null; sair: () => Promise<void>; recarregar: () => Promise<void> };
const Contexto = createContext<Ctx>({ carregando: true, sessao: null, perfil: null, sair: async () => {}, recarregar: async () => {} });

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregando, setCarregando] = useState(true);

  async function lerPerfil(s: Session | null) {
    if (!s) { setPerfil(null); return; }
    const { data } = await supabase.from('minha_sessao').select('id,username,nome,papel,avatar_url,eh_admin,funcao,funcoes_extra').maybeSingle();
    setPerfil((data as Perfil) || null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSessao(data.session); await lerPerfil(data.session); setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSessao(s); lerPerfil(s); });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Contexto.Provider value={{
      carregando, sessao, perfil,
      sair: async () => { await supabase.auth.signOut(); setPerfil(null); },
      recarregar: () => lerPerfil(sessao),
    }}>{children}</Contexto.Provider>
  );
}
export const useSessao = () => useContext(Contexto);
