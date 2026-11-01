/* GRAVAÇÕES — as próximas (agenda) e as que acabaram de acontecer. */
import { useState } from 'react';
import { View } from 'react-native';
import { useSessao } from '@/lib/sessao';
import { lista, useLeitura } from '@/lib/dados';
import { supabase } from '@/lib/supabase';
import { diaCurto, hojeISO, somaDias } from '@/lib/datas';
import { abrirNoSistema } from '@/lib/sistema';
import { Tela } from '@/ui/tela';
import { Segmento } from '@/ui/segmento';
import { Avatar, Cartao, Linha, Secao, Selo, Vazio } from '@/ui/base';

export default function Gravacoes() {
  const { perfil } = useSessao();
  const [aba, setAba] = useState<'proximas' | 'recentes'>('proximas');
  const hoje = hojeISO();
  const { dados, recarregar } = useLeitura(() => lista(supabase.from('gravacoes_resumo')
    .select('id,nome,cliente_nome,data_gravacao,hora_inicio,local,situacao,status,videomaker_id,videomaker_nome,total_itens,itens_gravados')
    .is('deleted_at', null).gte('data_gravacao', somaDias(hoje, -21)).lte('data_gravacao', somaDias(hoje, 60))
    .order('data_gravacao', { ascending: true }).limit(200)), []);
  const l = (dados || []).filter((g: any) => g.status !== 'Cancelada' && (aba === 'proximas' ? g.data_gravacao >= hoje : g.data_gravacao < hoje));
  if (aba === 'recentes') l.reverse();
  /* agrupa por dia */
  const dias: [string, any[]][] = [];
  l.forEach((g: any) => { const ult = dias[dias.length - 1]; if (ult && ult[0] === g.data_gravacao) ult[1].push(g); else dias.push([g.data_gravacao, [g]]); });
  return (
    <Tela titulo="Gravações" sub="Agenda" aoAtualizar={recarregar}>
      <Segmento opcoes={[['proximas', 'Próximas'], ['recentes', 'Recentes']]} valor={aba} aoMudar={setAba} />
      {!dados ? <Vazio titulo="Carregando…" /> : dias.length === 0 ? <Vazio titulo={aba === 'proximas' ? 'Nenhuma gravação marcada' : 'Nenhuma gravação recente'} />
        : dias.map(([dia, gs]) => (
          <View key={dia}>
            <Secao titulo={dia === hoje ? 'Hoje' : dia === somaDias(hoje, 1) ? 'Amanhã' : diaCurto(dia)} />
            <Cartao>
              {gs.map((g: any, i: number) => {
                const minha = g.videomaker_id === perfil?.id;
                const prog = g.total_itens ? g.itens_gravados + '/' + g.total_itens : '';
                return (
                  <Linha key={g.id} ultimo={i === gs.length - 1} titulo={g.nome || 'Gravação'}
                    sub={[g.cliente_nome, g.hora_inicio ? String(g.hora_inicio).slice(0, 5) : '', g.local].filter(Boolean).join(' · ')}
                    esquerda={<Avatar nome={g.videomaker_nome || '?'} tam={36} />}
                    direita={minha ? <Selo texto="Sua" tom="acento" /> : prog ? <Selo texto={prog} /> : undefined}
                    aoTocar={() => abrirNoSistema('#/gravacao/' + g.id)} />
                );
              })}
            </Cartao>
          </View>
        ))}
    </Tela>
  );
}
