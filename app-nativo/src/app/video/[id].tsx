/* DETALHE DO VÍDEO — nativo: etapa, prazo e responsável; ações da etapa
   (começar, mandar versão, enviar ao cliente, entregar, ajuste, standby);
   versões com os comentários; e o histórico. As regras são do banco
   (video_mudar_status, video_criar_versao, …): se a pessoa não pode, o
   aviso de erro aparece aqui. */
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useCores } from '@/lib/tema';
import { ROT_VIDEO, lista, rpc, useLeitura } from '@/lib/dados';
import { useAoVivo } from '@/lib/aovivo';
import { hojeISO, prazoTexto } from '@/lib/datas';
import { Topo } from '@/ui/topo';
import { Avatar, Cartao, Linha, Secao, Selo, Vazio } from '@/ui/base';
import { FolhaOpcoes, FolhaTexto, type Opcao } from '@/ui/folha';

const tempo = (s: number) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const quando = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

export default function VideoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useCores(), ins = useSafeAreaInsets();
  const [folha, setFolha] = useState<null | 'etapa'>(null);
  const [texto, setTexto] = useState<null | { tipo: 'versao' | 'comentario' | 'ajuste'; versaoId?: string }>(null);
  const [fazendo, setFazendo] = useState(false);

  const { dados, recarregar } = useLeitura(async () => {
    const [d, versoes, comentarios, eventos] = await Promise.all([
      supabase.from('demandas_edicao_resumo').select('*').eq('id', id).single().then(r => { if (r.error) throw new Error(r.error.message); return r.data as any; }),
      lista(supabase.from('video_versoes_resumo').select('*').eq('demanda_id', id).order('numero', { ascending: false })),
      lista(supabase.from('video_comentarios_resumo').select('*').eq('demanda_id', id).order('timecode_seg')),
      lista(supabase.from('demandas_edicao_eventos').select('*').eq('demanda_id', id).order('created_at', { ascending: false }).limit(30)),
    ]);
    return { d, versoes, comentarios, eventos };
  }, [id]);
  useAoVivo('video-' + id, [{ tabela: 'demandas_edicao', filtro: 'id=eq.' + id }, { tabela: 'video_versoes', filtro: 'demanda_id=eq.' + id },
    { tabela: 'video_comentarios', filtro: 'demanda_id=eq.' + id }], recarregar, !!id);

  async function fazer(acao: () => Promise<unknown>, ok: string) {
    if (fazendo) return;
    setFazendo(true);
    try { await acao(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); await recarregar(); if (ok) Alert.alert(ok); }
    catch (e: any) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); Alert.alert('Não deu', e?.message || 'Tente de novo.'); }
    finally { setFazendo(false); }
  }
  const mudar = (st: string, msg?: string) => fazer(() => rpc('video_mudar_status', { p_demanda_id: id, p_status: st, p_mensagem: msg || null }), '');

  if (!dados) return <View style={{ flex: 1, backgroundColor: c.fundo }}><Topo titulo="Vídeo" /><Vazio titulo="Carregando…" /></View>;
  const { d, versoes, comentarios, eventos } = dados;
  const st: string = d.editing_status, ultima = versoes[0];
  const hoje = hojeISO();

  /* a ação principal de cada etapa */
  const principal: { rotulo: string; acao: () => void } | null =
    st === 'pendente' ? { rotulo: 'Começar a edição', acao: () => mudar('em_edicao') }
    : (st === 'em_edicao' || st === 'correcao') ? (ultima && !ultima.enviada_aprovacao_em
      ? { rotulo: 'Enviar a versão ' + ultima.numero + ' ao cliente', acao: () => fazer(() => rpc('video_enviar_para_aprovacao', { p_demanda_id: id, p_versao_id: ultima.id }), 'Enviado para o cliente aprovar.') }
      : { rotulo: 'Mandar uma versão', acao: () => setTexto({ tipo: 'versao' }) })
    : st === 'aguardando_aprovacao' && ultima ? { rotulo: 'Cliente aprovou — entregar', acao: () => fazer(() => rpc('video_registrar_entrega', { p_demanda_id: id, p_versao_id: ultima.id }), 'Vídeo entregue! 🎉') }
    : st === 'standby' ? { rotulo: 'Voltar para a fila', acao: () => mudar('pendente') } : null;

  const opcoesEtapa: Opcao[] = [
    { rotulo: 'A fazer', aoEscolher: () => mudar('pendente') },
    { rotulo: 'Em edição', aoEscolher: () => mudar('em_edicao') },
    { rotulo: 'Com o cliente (aguardando aprovação)', aoEscolher: () => mudar('aguardando_aprovacao') },
    { rotulo: 'Cliente pediu ajuste', sub: 'volta para correção', aoEscolher: () => setTexto({ tipo: 'ajuste' }) },
    { rotulo: 'Standby', sub: 'parado por um motivo de fora', aoEscolher: () => mudar('standby') },
    { rotulo: 'Entregue', aoEscolher: () => mudar('entregue') },
  ].filter(o => !o.rotulo.startsWith(ROT_VIDEO[st] || '§'));

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <Topo titulo={d.codigo || 'Vídeo'} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: ins.bottom + 40 }}>
        <Text style={[s.cliente, { color: c.acento }]}>{(d.cliente_nome || '').toUpperCase()}</Text>
        <Text style={[s.titulo, { color: c.ink }]}>{d.titulo || d.codigo || 'Vídeo'}</Text>
        <View style={s.chips}>
          <Selo texto={ROT_VIDEO[st] || st} tom={st === 'entregue' ? 'ok' : st === 'correcao' ? 'ambar' : 'acento'} />
          <Selo texto={prazoTexto(d.prazo)} tom={d.prazo && d.prazo < hoje && st !== 'entregue' ? 'erro' : 'neutro'} />
          {d.formato_video ? <Selo texto={d.formato_video} /> : null}
        </View>

        {principal ? (
          <Pressable disabled={fazendo} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); principal.acao(); }}
            style={({ pressed }) => [s.principal, { backgroundColor: c.acento, opacity: fazendo ? 0.6 : pressed ? 0.85 : 1 }]}>
            <Text style={s.principalTx}>{fazendo ? 'Salvando…' : principal.rotulo}</Text>
          </Pressable>
        ) : null}
        <View style={s.linhaBotoes}>
          <Pressable onPress={() => setFolha('etapa')} style={[s.sec, { backgroundColor: c.card, borderColor: c.borda }]}><Text style={[s.secTx, { color: c.ink }]}>Mudar etapa</Text></Pressable>
          <Pressable onPress={() => setTexto({ tipo: 'versao' })} style={[s.sec, { backgroundColor: c.card, borderColor: c.borda }]}><Text style={[s.secTx, { color: c.ink }]}>Nova versão</Text></Pressable>
        </View>

        <Secao titulo="Quem e onde" />
        <Cartao>
          <Linha titulo={d.videomaker_nome || 'Sem responsável'} sub="Responsável" esquerda={<Avatar nome={d.videomaker_nome || '?'} tam={36} />} />
          {d.gravacao_nome ? <Linha titulo={d.gravacao_nome} sub="Gravação" /> : null}
          {d.link_material ? <Linha titulo="Material bruto" sub={d.link_material} aoTocar={() => Linking.openURL(d.link_material)} /> : null}
          {d.observacoes ? <Linha titulo="Observações" sub={d.observacoes} ultimo /> : <Linha titulo={'Pacote: ' + (d.pacote || '—')} ultimo />}
        </Cartao>

        <Secao titulo="Versões" extra={String(versoes.length)} />
        {versoes.length === 0 ? <Cartao><Vazio titulo="Nenhuma versão ainda" texto="Toque em Nova versão e cole o link do vídeo (Drive, Frame.io…)." /></Cartao>
          : versoes.map((v: any) => {
            const coms = comentarios.filter((x: any) => x.versao_id === v.id);
            const estado = v.entregue_em ? ['Entregue', 'ok'] : v.decisao_cliente === 'aprovado' ? ['Aprovada', 'ok'] : v.decisao_cliente ? ['Ajuste pedido', 'ambar']
              : v.enviada_aprovacao_em ? ['Com o cliente', 'acento'] : ['Rascunho', 'neutro'];
            return (
              <Cartao key={v.id} style={{ marginBottom: 12 }}>
                <Linha titulo={'Versão ' + v.numero} sub={[v.criado_por_nome, quando(v.created_at)].filter(Boolean).join(' · ')}
                  direita={<Selo texto={estado[0]} tom={estado[1] as any} />} aoTocar={v.arquivo_url ? () => Linking.openURL(v.arquivo_url) : undefined} />
                {v.observacao ? <Text style={[s.obs, { color: c.ink2 }]}>{v.observacao}</Text> : null}
                {coms.map((m: any) => (
                  <View key={m.id} style={[s.com, { borderTopColor: c.borda }]}>
                    <Text style={[s.comTempo, { color: c.acento }]}>{tempo(m.timecode_seg || 0)}</Text>
                    <View style={{ flex: 1 }}><Text style={[s.comTx, { color: c.ink }]}>{m.texto}</Text><Text style={[s.comQuem, { color: c.ink4 }]}>{m.autor_nome}</Text></View>
                  </View>
                ))}
                <Pressable onPress={() => setTexto({ tipo: 'comentario', versaoId: v.id })} style={[s.comentar, { borderTopColor: c.borda }]}>
                  <Text style={{ color: c.acento, fontWeight: '700' }}>+ Comentar</Text>
                </Pressable>
              </Cartao>
            );
          })}

        <Secao titulo="Histórico" />
        <Cartao>
          {eventos.length === 0 ? <Vazio titulo="Sem movimentos" /> : eventos.map((e: any, i: number) => (
            <Linha key={e.id} ultimo={i === eventos.length - 1}
              titulo={e.para_status ? (ROT_VIDEO[e.de_status] || e.de_status || '—') + ' → ' + (ROT_VIDEO[e.para_status] || e.para_status) : (e.mensagem || e.tipo)}
              sub={[e.ator_nome, quando(e.created_at), e.para_status && e.mensagem ? e.mensagem : ''].filter(Boolean).join(' · ')} />
          ))}
        </Cartao>
      </ScrollView>

      <FolhaOpcoes aberta={folha === 'etapa'} titulo="Mudar a etapa" opcoes={opcoesEtapa} aoFechar={() => setFolha(null)} />
      <FolhaTexto aberta={!!texto}
        titulo={texto?.tipo === 'versao' ? 'Nova versão' : texto?.tipo === 'ajuste' ? 'O que o cliente pediu?' : 'Comentário'}
        ajuda={texto?.tipo === 'versao' ? 'Cole o link do vídeo (Google Drive, Frame.io, YouTube não listado…).' : texto?.tipo === 'comentario' ? 'Comece com o minuto se quiser: 1:23 cortar a pausa' : undefined}
        placeholder={texto?.tipo === 'versao' ? 'https://…' : 'Escreva aqui'} teclado={texto?.tipo === 'versao' ? 'url' : 'default'}
        botao={texto?.tipo === 'versao' ? 'Salvar versão' : 'Enviar'} aoFechar={() => setTexto(null)}
        aoEnviar={async t => {
          if (texto?.tipo === 'versao') await fazer(() => rpc('video_criar_versao', { p_demanda_id: id, p_arquivo_url: t, p_arquivo_nome: '', p_observacao: '' }), 'Versão salva. Agora é só enviar ao cliente.');
          else if (texto?.tipo === 'ajuste') await mudar('correcao', t);
          else if (texto?.versaoId) {
            const m = t.match(/^(\d{1,2}):(\d{2})\s*(.*)$/);
            await fazer(() => rpc('video_criar_comentario', { p_versao_id: texto.versaoId, p_timecode_seg: m ? +m[1] * 60 + +m[2] : 0, p_texto: m ? m[3] || t : t }), '');
          }
        }} />
    </View>
  );
}

const s = StyleSheet.create({
  cliente: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  titulo: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  principal: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  principalTx: { color: '#fff', fontSize: 16.5, fontWeight: '800' },
  linhaBotoes: { flexDirection: 'row', gap: 10, marginTop: 10 },
  sec: { flex: 1, height: 46, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  secTx: { fontSize: 14.5, fontWeight: '700' },
  obs: { paddingHorizontal: 16, paddingBottom: 12, fontSize: 14, lineHeight: 20 },
  com: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  comTempo: { fontWeight: '800', fontVariant: ['tabular-nums'], width: 42 },
  comTx: { fontSize: 14.5, lineHeight: 20 },
  comQuem: { fontSize: 12, marginTop: 2 },
  comentar: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
