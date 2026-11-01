/* Leituras do banco usadas pelas telas (as mesmas tabelas/visões do site;
   o banco filtra pelo que a pessoa pode ver). */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export const VIDEO_ABERTO = ['pendente', 'em_edicao', 'correcao', 'standby', 'aguardando_aprovacao'];
export const DESIGN_ABERTO = ['aguardando_producao', 'em_criacao', 'revisao_interna', 'ajustes', 'aprovado_interno', 'aguardando_cliente', 'ajustes_cliente'];
export const ROT_VIDEO: Record<string, string> = { pendente: 'A fazer', em_edicao: 'Em edição', correcao: 'Em correção', standby: 'Standby',
  aguardando_aprovacao: 'Com o cliente', entregue: 'Entregue' };
export const ROT_DESIGN: Record<string, string> = { aguardando_producao: 'A fazer', em_criacao: 'Em criação', revisao_interna: 'Revisão interna',
  ajustes: 'Ajustes', aprovado_interno: 'Aprovado interno', aguardando_cliente: 'Com o cliente', ajustes_cliente: 'Ajustes do cliente',
  aprovado_cliente: 'Aprovado', finalizado: 'Finalizado' };

/* busca + "puxar para atualizar": devolve { dados, erro, carregando, recarregar } */
export function useLeitura<T>(ler: () => Promise<T>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const recarregar = useCallback(async () => {
    try { setDados(await ler()); setErro(''); }
    catch (e: any) { setErro(e?.message || 'Não foi possível carregar.'); }
    finally { setCarregando(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { dados, erro, carregando, recarregar };
}

export async function rpc<T = any>(nome: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(nome, args);
  if (error) throw new Error(error.message);
  return data as T;
}
export async function lista<T = any>(q: PromiseLike<{ data: T[] | null; error: any }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data || [];
}
