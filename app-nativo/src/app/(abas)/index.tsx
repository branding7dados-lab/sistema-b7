/* PAINEL — o dia da pessoa: números do dia, o que está na mão dela e as
   próximas gravações. */
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSessao } from '@/lib/sessao';
import { GRADIENTE, useCores } from '@/lib/tema';
import { DESIGN_ABERTO, ROT_DESIGN, ROT_VIDEO, lista, rpc, useLeitura } from '@/lib/dados';
import { supabase } from '@/lib/supabase';
import { dataExtenso, diaCurto, hojeISO, prazoTexto, saudacao, somaDias } from '@/lib/datas';
import { abrirNoSistema } from '@/lib/sistema';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { useAoVivo } from '@/lib/aovivo';
import { Tela } from '@/ui/tela';
import { Avatar, Cartao, Linha, Secao, Selo, Vazio } from '@/ui/base';

type Item = { id: string; tipo: 'video' | 'design'; titulo: string; cliente: string; prazo: string | null; status: string };

export default function Painel() {
  const { perfil } = useSessao();
  const c = useCores();
  const eu = perfil?.id;
  const { dados, recarregar } = useLeitura(async () => {
    if (!eu) return null;
    const hoje = hojeISO();
    const [dia, vids, des, gravs, chat] = await Promise.all([
      rpc('meu_dia').catch(() => ({})),
      lista(supabase.from('demandas_edicao_resumo').select('id,titulo,codigo,cliente_nome,prazo,editing_status')
        .eq('videomaker_id', eu).is('deleted_at', null).in('editing_status', ['pendente', 'em_edicao', 'correcao']).order('prazo', { ascending: true, nullsFirst: false }).limit(12)),
      lista(supabase.from('design_resumo').select('id,titulo,conteudo_titulo,cliente_nome,prazo,status')
        .eq('designer_id', eu).in('status', ['aguardando_producao', 'em_criacao', 'ajustes', 'ajustes_cliente']).order('prazo', { ascending: true, nullsFirst: false }).limit(12)),
      lista(supabase.from('gravacoes_resumo').select('id,nome,cliente_nome,data_gravacao,hora_inicio,videomaker_id,videomaker_nome')
        .is('deleted_at', null).gte('data_gravacao', hoje).lte('data_gravacao', somaDias(hoje, 14)).order('data_gravacao').limit(20)),
      rpc<any[]>('chat_lista').catch(() => []),
    ]);
    const naoLidas = (chat || []).reduce((n: number, cv: any) => n + (cv.nao_lidas || 0), 0);
    const itens: Item[] = [
      ...vids.map((v: any) => ({ id: v.id, tipo: 'video' as const, titulo: v.titulo || v.codigo || 'Vídeo', cliente: v.cliente_nome, prazo: v.prazo, status: v.editing_status })),
      ...des.map((d: any) => ({ id: d.id, tipo: 'design' as const, titulo: d.titulo || d.conteudo_titulo || 'Peça', cliente: d.cliente_nome, prazo: d.prazo, status: d.status })),
    ].sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
    const minhas = gravs.filter((g: any) => !g.videomaker_id || g.videomaker_id === eu || perfil?.eh_admin).slice(0, 5);
    return { dia: dia as any, itens, gravs: minhas, naoLidas };
  }, [eu]);
  useAoVivo('painel', [{ tabela: 'chat_mensagens' }, { tabela: 'demandas_edicao' }, { tabela: 'design_deliverables' }], recarregar, !!eu);

  const d = dados?.dia || {};
  const hoje = hojeISO();
  const atrasadas = (dados?.itens || []).filter(i => i.prazo && i.prazo < hoje).length;

  return (
    <Tela titulo={saudacao() + ', ' + (perfil?.nome || '').split(' ')[0]} sub={dataExtenso()} aoAtualizar={recarregar}
      topo={<View style={s.avatar}>
        <Pressable hitSlop={8} onPress={() => router.push('/conversas')} style={[s.chat, { backgroundColor: c.card, borderColor: c.borda }]}>
          <Text style={{ fontSize: 18 }}>💬</Text>
          {dados?.naoLidas ? <View style={[s.badge, { backgroundColor: c.acento }]}><Text style={s.badgeTx}>{dados.naoLidas > 99 ? '99+' : dados.naoLidas}</Text></View> : null}
        </Pressable>
        <Avatar nome={perfil?.nome} url={perfil?.avatar_url} tam={44} /></View>}>
      <LinearGradient colors={GRADIENTE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.heroi}>
        <Text style={s.heroiRot}>NA SUA MÃO</Text>
        <Text style={s.heroiNum}>{d.abertas ?? (dados ? dados.itens.length : '—')}</Text>
        <View style={s.heroiLinha}>
          <View style={s.pilula}><Text style={s.pilulaTx}>{(d.hoje ?? 0) + ' vence' + ((d.hoje ?? 0) === 1 ? '' : 'm') + ' hoje'}</Text></View>
          <View style={[s.pilula, (d.atrasadas ?? atrasadas) ? s.pilulaAlerta : null]}><Text style={s.pilulaTx}>{(d.atrasadas ?? atrasadas) + ' atrasada' + ((d.atrasadas ?? atrasadas) === 1 ? '' : 's')}</Text></View>
          <View style={s.pilula}><Text style={s.pilulaTx}>{(d.gravacoes ?? 0) + ' gravaç' + ((d.gravacoes ?? 0) === 1 ? 'ão' : 'ões') + ' hoje'}</Text></View>
        </View>
      </LinearGradient>

      <Secao titulo="O que está com você" extra={dados ? String(dados.itens.length) : ''} />
      <Cartao>
        {!dados ? <Vazio titulo="Carregando…" />
          : dados.itens.length === 0 ? <Vazio titulo="Nada na sua fila agora" texto="Quando chegar um vídeo ou uma peça para você, aparece aqui." />
          : dados.itens.map((it, i) => {
            const atrasado = !!it.prazo && it.prazo < hoje;
            return (
              <Linha key={it.tipo + it.id} ultimo={i === dados.itens.length - 1}
                titulo={it.titulo} sub={[it.cliente, it.tipo === 'video' ? ROT_VIDEO[it.status] : ROT_DESIGN[it.status]].filter(Boolean).join(' · ')}
                esquerda={<View style={[s.ic, { backgroundColor: it.tipo === 'video' ? 'rgba(249,115,22,0.14)' : 'rgba(139,92,246,0.14)' }]}>
                  <Text style={{ color: it.tipo === 'video' ? '#EA580C' : '#7C3AED', fontWeight: '900' }}>{it.tipo === 'video' ? '▶' : '◆'}</Text></View>}
                direita={<Selo texto={prazoTexto(it.prazo)} tom={atrasado ? 'erro' : it.prazo === hoje ? 'ambar' : 'neutro'} />}
                aoTocar={() => router.push({ pathname: it.tipo === 'video' ? '/video/[id]' : '/design/[id]', params: { id: it.id } })} />
            );
          })}
      </Cartao>

      <Secao titulo="Próximas gravações" />
      <Cartao>
        {!dados ? <Vazio titulo="Carregando…" />
          : dados.gravs.length === 0 ? <Vazio titulo="Nenhuma gravação nos próximos 14 dias" />
          : dados.gravs.map((g: any, i: number) => (
            <Linha key={g.id} ultimo={i === dados.gravs.length - 1} titulo={g.nome || 'Gravação'}
              sub={[g.cliente_nome, diaCurto(g.data_gravacao) + (g.hora_inicio ? ' · ' + String(g.hora_inicio).slice(0, 5) : '')].filter(Boolean).join(' · ')}
              esquerda={<Avatar nome={g.videomaker_nome || '?'} tam={36} />}
              aoTocar={() => abrirNoSistema('#/gravacao/' + g.id)} />
          ))}
      </Cartao>
      <Text style={[s.rodape, { color: c.ink4 }]}>Toque num item para abrir.</Text>
    </Tela>
  );
}

const s = StyleSheet.create({
  avatar: { position: 'absolute', right: 0, top: 4, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chat: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  badgeTx: { color: '#fff', fontSize: 11, fontWeight: '800' },
  heroi: { borderRadius: 24, padding: 20, marginTop: 14 },
  heroiRot: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  heroiNum: { color: '#fff', fontSize: 56, fontWeight: '900', letterSpacing: -2, marginTop: 2 },
  heroiLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pilula: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6 },
  pilulaAlerta: { backgroundColor: 'rgba(255,90,120,0.45)' },
  pilulaTx: { color: '#fff', fontSize: 12.5, fontWeight: '700' },
  ic: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rodape: { fontSize: 12.5, textAlign: 'center', marginTop: 18 },
});
