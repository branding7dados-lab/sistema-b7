/* DETALHE DA PEÇA DE DESIGN — nativo: a arte da última versão em tela
   cheia (deslize entre as partes de um carrossel), a etapa e as ações
   (aprovar internamente, pedir ajuste, enviar ao cliente, finalizar) e as
   versões. Enviar arquivo novo continua no sistema completo (upload). */
import { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useCores } from '@/lib/tema';
import { ROT_DESIGN, lista, rpc, useLeitura } from '@/lib/dados';
import { useAoVivo } from '@/lib/aovivo';
import { prazoTexto } from '@/lib/datas';
import { abrirNoSistema } from '@/lib/sistema';
import { Topo } from '@/ui/topo';
import { Avatar, Cartao, Linha, Secao, Selo, Vazio } from '@/ui/base';
import { FolhaTexto } from '@/ui/folha';

const ESTADO: Record<string, [string, 'neutro' | 'acento' | 'ok' | 'ambar' | 'erro']> = {
  rascunho: ['Rascunho', 'neutro'], enviada: ['Em revisão', 'acento'], aprovada_interna: ['Aprovada internamente', 'ok'],
  ajuste_solicitado: ['Ajuste pedido', 'ambar'], aprovada_cliente: ['Aprovada pelo cliente', 'ok'], enviada_cliente: ['Com o cliente', 'acento'],
};
const L = Dimensions.get('window').width;

export default function DesignDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useCores(), ins = useSafeAreaInsets();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [cheia, setCheia] = useState<number | null>(null);
  const [ajuste, setAjuste] = useState(false);
  const [fazendo, setFazendo] = useState(false);

  const { dados, recarregar } = useLeitura(async () => {
    const [d, versoes] = await Promise.all([
      supabase.from('design_resumo').select('*').eq('id', id).single().then(r => { if (r.error) throw new Error(r.error.message); return r.data as any; }),
      lista(supabase.from('design_versoes').select('*').eq('deliverable_id', id).order('numero', { ascending: false })),
    ]);
    const ult = versoes[0];
    const arquivos = ult ? await lista(supabase.from('design_arquivos').select('id,caminho,caminho_thumb,mime,nome_original,papel,posicao,revisao,revisao_mensagem')
      .eq('versao_id', ult.id).order('papel').order('posicao')) : [];
    return { d, versoes, arquivos: arquivos.filter((a: any) => String(a.mime || '').startsWith('image/')) };
  }, [id]);
  useAoVivo('design-' + id, [{ tabela: 'design_deliverables', filtro: 'id=eq.' + id }, { tabela: 'design_versoes', filtro: 'deliverable_id=eq.' + id }], recarregar, !!id);

  /* as artes ficam num bucket privado: links assinados por 1 hora */
  useEffect(() => {
    const caminhos = (dados?.arquivos || []).map((a: any) => a.caminho).filter(Boolean);
    if (!caminhos.length) return;
    supabase.storage.from('design-files').createSignedUrls(caminhos, 3600).then(({ data }) => {
      const m: Record<string, string> = {};
      (data || []).forEach((x: any) => { if (x.signedUrl && x.path) m[x.path] = x.signedUrl; });
      setUrls(m);
    });
  }, [dados?.arquivos]);

  async function fazer(acao: () => Promise<unknown>, ok: string) {
    if (fazendo) return;
    setFazendo(true);
    try { await acao(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); await recarregar(); if (ok) Alert.alert(ok); }
    catch (e: any) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); Alert.alert('Não deu', e?.message || 'Tente de novo.'); }
    finally { setFazendo(false); }
  }

  if (!dados) return <View style={{ flex: 1, backgroundColor: c.fundo }}><Topo titulo="Design" /><Vazio titulo="Carregando…" /></View>;
  const { d, versoes, arquivos } = dados;
  const ult = versoes[0];
  const est = ult ? (ESTADO[ult.estado] || [ult.estado, 'neutro']) : null;

  /* o que dá para fazer agora, pelo estado da última versão e da peça */
  const acoes: { rotulo: string; tom?: 'perigo'; acao: () => void }[] = [];
  if (ult && ult.estado === 'enviada') {
    acoes.push({ rotulo: 'Aprovar internamente', acao: () => fazer(() => rpc('design_aprovar_interno', { p_versao_id: ult.id }), 'Aprovada internamente.') });
    acoes.push({ rotulo: 'Pedir ajuste', tom: 'perigo', acao: () => setAjuste(true) });
  }
  if (ult && ult.estado === 'aprovada_interna') acoes.push({ rotulo: 'Enviar ao cliente', acao: () => fazer(() => rpc('design_enviar_cliente', { p_versao_id: ult.id, p_observacao: '' }), 'Enviada para o cliente aprovar.') });
  if (ult && ult.estado === 'aprovada_cliente' && d.status !== 'finalizado') acoes.push({ rotulo: 'Finalizar a peça', acao: () => fazer(() => rpc('design_finalizar', { p_deliverable_id: id }), 'Peça finalizada! 🎉') });
  if (!ult || ult.estado === 'rascunho' || ult.estado === 'ajuste_solicitado') acoes.push({ rotulo: 'Enviar arte nova (no sistema)', acao: () => abrirNoSistema('#/design/' + id) });

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <Topo titulo={d.tipo ? d.tipo.charAt(0).toUpperCase() + d.tipo.slice(1) : 'Design'} />
      <ScrollView contentContainerStyle={{ paddingBottom: ins.bottom + 40 }}>
        {arquivos.length ? (
          <FlatList data={arquivos} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={(a: any) => a.id}
            renderItem={({ item, index }: any) => (
              <Pressable onPress={() => setCheia(index)}>
                <Image source={urls[item.caminho]} style={{ width: L, height: L }} contentFit="contain" transition={200} placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }} />
              </Pressable>
            )} style={{ backgroundColor: c.suave }} />
        ) : <View style={[s.semArte, { backgroundColor: c.suave }]}><Text style={{ color: c.ink3 }}>Sem arte enviada ainda</Text></View>}
        {arquivos.length > 1 ? <Text style={[s.dica, { color: c.ink4 }]}>{arquivos.length} partes · deslize para o lado · toque para ampliar</Text> : null}

        <View style={{ paddingHorizontal: 18 }}>
          <Text style={[s.cliente, { color: c.acento }]}>{(d.cliente_nome || '').toUpperCase()}</Text>
          <Text style={[s.titulo, { color: c.ink }]}>{d.titulo || d.conteudo_titulo || 'Peça'}</Text>
          <View style={s.chips}>
            <Selo texto={ROT_DESIGN[d.status] || d.status} tom={d.status === 'finalizado' ? 'ok' : 'acento'} />
            {est ? <Selo texto={'v' + ult.numero + ' · ' + est[0]} tom={est[1]} /> : null}
            {d.prazo ? <Selo texto={prazoTexto(d.prazo)} /> : null}
          </View>

          {acoes.map((a, i) => (
            <Pressable key={a.rotulo} disabled={fazendo} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); a.acao(); }}
              style={({ pressed }) => [i === 0 ? [s.principal, { backgroundColor: a.tom ? c.erro : c.acento }] : [s.sec, { backgroundColor: c.card, borderColor: c.borda }],
                { opacity: fazendo ? 0.6 : pressed ? 0.85 : 1 }]}>
              <Text style={i === 0 ? s.principalTx : [s.secTx, { color: a.tom ? c.erro : c.ink }]}>{fazendo && i === 0 ? 'Salvando…' : a.rotulo}</Text>
            </Pressable>
          ))}

          <Secao titulo="Sobre a peça" />
          <Cartao>
            <Linha titulo={d.designer_nome || 'Sem designer'} sub="Designer" esquerda={<Avatar nome={d.designer_nome || '?'} url={d.designer_avatar} tam={36} />} />
            {d.linha_nome ? <Linha titulo={d.linha_nome} sub="Linha editorial" /> : null}
            {d.briefing_desatualizado ? <Linha titulo="O conteúdo mudou depois da arte" sub="Confira o texto na linha editorial antes de enviar" /> : null}
            <Linha titulo="Abrir no sistema completo" sub="briefing, arquivos e envio de arte" ultimo aoTocar={() => abrirNoSistema('#/design/' + id)} />
          </Cartao>

          {ult && ult.observacao ? (<><Secao titulo="Observação da versão" /><Cartao><Text style={[s.obs, { color: c.ink2 }]}>{ult.observacao}</Text></Cartao></>) : null}
          {arquivos.some((a: any) => a.revisao_mensagem) ? (
            <><Secao titulo="Ajustes pedidos" /><Cartao>{arquivos.filter((a: any) => a.revisao_mensagem).map((a: any, i: number, l: any[]) =>
              <Linha key={a.id} titulo={a.revisao_mensagem} sub={a.nome_original} ultimo={i === l.length - 1} />)}</Cartao></>
          ) : null}

          <Secao titulo="Versões" extra={String(versoes.length)} />
          <Cartao>
            {versoes.length === 0 ? <Vazio titulo="Nenhuma versão ainda" /> : versoes.map((v: any, i: number) => {
              const e = ESTADO[v.estado] || [v.estado, 'neutro'];
              return <Linha key={v.id} ultimo={i === versoes.length - 1} titulo={'Versão ' + v.numero} sub={v.observacao || ''} direita={<Selo texto={e[0]} tom={e[1]} />} />;
            })}
          </Cartao>
        </View>
      </ScrollView>

      <Modal visible={cheia !== null} transparent animationType="fade" onRequestClose={() => setCheia(null)} statusBarTranslucent>
        <View style={s.cheia}>
          <FlatList data={arquivos} horizontal pagingEnabled initialScrollIndex={cheia || 0} getItemLayout={(_, i) => ({ length: L, offset: L * i, index: i })}
            keyExtractor={(a: any) => a.id} renderItem={({ item }: any) => (
              <ScrollView style={{ width: L }} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} maximumZoomScale={4} minimumZoomScale={1} centerContent>
                <Image source={urls[item.caminho]} style={{ width: L, height: L * 1.4 }} contentFit="contain" />
              </ScrollView>
            )} />
          <Pressable onPress={() => setCheia(null)} style={[s.fechar, { top: ins.top + 12 }]}><Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>Fechar</Text></Pressable>
        </View>
      </Modal>
      <FolhaTexto aberta={ajuste} titulo="O que precisa ajustar?" placeholder="Ex.: trocar a foto do slide 2" botao="Pedir ajuste" aoFechar={() => setAjuste(false)}
        aoEnviar={async t => { if (ult) await fazer(() => rpc('design_solicitar_ajuste', { p_versao_id: ult.id, p_mensagem: t }), 'Ajuste pedido ao designer.'); }} />
    </View>
  );
}

const s = StyleSheet.create({
  semArte: { height: 220, alignItems: 'center', justifyContent: 'center' },
  dica: { fontSize: 12, textAlign: 'center', marginTop: 8 },
  cliente: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1, marginTop: 18 },
  titulo: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 6 },
  principal: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  principalTx: { color: '#fff', fontSize: 16.5, fontWeight: '800' },
  sec: { height: 48, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  secTx: { fontSize: 15, fontWeight: '700' },
  obs: { padding: 16, fontSize: 14.5, lineHeight: 21 },
  cheia: { flex: 1, backgroundColor: '#000' },
  fechar: { position: 'absolute', right: 16, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 99 },
});
