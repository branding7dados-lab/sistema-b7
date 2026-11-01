/* CONVERSA — bolhas no estilo dos apps de mensagem: as suas à direita, na
   cor da B7; as da outra pessoa à esquerda. Mensagem nova chega ao vivo,
   abrir marca como lida, e a sua aparece na hora (antes de o servidor
   confirmar). Foto aparece; áudio e arquivo abrem no sistema. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { useSessao } from '@/lib/sessao';
import { useCores } from '@/lib/tema';
import { rpc } from '@/lib/dados';
import { pessoas, type Pessoa } from '@/lib/pessoas';
import { abrirNoSistema } from '@/lib/sistema';
import { Topo } from '@/ui/topo';
import { Avatar } from '@/ui/base';

type Msg = { id: string; autor_id: string; tipo: string; texto: string | null; arquivo_path: string | null; created_at: string; apagada_em: string | null; _enviando?: boolean };
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function Conversa() {
  const { id, outro } = useLocalSearchParams<{ id: string; outro?: string }>();
  const { perfil } = useSessao();
  const c = useCores(), ins = useSafeAreaInsets();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [texto, setTexto] = useState('');
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const lista = useRef<FlatList<Msg>>(null);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('chat_mensagens').select('id,autor_id,tipo,texto,arquivo_path,created_at,apagada_em')
      .eq('conversa_id', id).order('created_at', { ascending: false }).limit(80);
    setMsgs(data as Msg[] || []);
    rpc('chat_marcar_lida', { p_conversa: id }).catch(() => {});
  }, [id]);

  useEffect(() => { carregar(); if (outro) pessoas().then(m => setPessoa(m.get(String(outro)) || null)); }, [carregar, outro]);

  /* chega mensagem nova (dela ou minha em outro aparelho) */
  useEffect(() => {
    const canal = supabase.channel('conversa-' + id)
      .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'chat_mensagens', filter: 'conversa_id=eq.' + id }, (p: any) => {
        const m = p.new as Msg;
        setMsgs(l => l.some(x => x.id === m.id) ? l : [m, ...l.filter(x => !(x._enviando && x.texto === m.texto && m.autor_id === perfil?.id))]);
        if (m.autor_id !== perfil?.id) { Haptics.selectionAsync(); rpc('chat_marcar_lida', { p_conversa: id }).catch(() => {}); }
      })
      .on('postgres_changes' as any, { event: 'UPDATE', schema: 'public', table: 'chat_mensagens', filter: 'conversa_id=eq.' + id }, (p: any) => {
        setMsgs(l => l.map(x => x.id === p.new.id ? { ...x, ...p.new } : x));
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [id, perfil?.id]);

  /* fotos num bucket privado: link assinado */
  useEffect(() => {
    const faltam = msgs.filter(m => m.tipo === 'imagem' && m.arquivo_path && !fotos[m.arquivo_path]).map(m => m.arquivo_path as string);
    if (!faltam.length) return;
    supabase.storage.from('chat-arquivos').createSignedUrls(faltam, 3600).then(({ data }) => {
      const n: Record<string, string> = {};
      (data || []).forEach((x: any) => { if (x.signedUrl && x.path) n[x.path] = x.signedUrl; });
      setFotos(f => ({ ...f, ...n }));
    });
  }, [msgs]); // eslint-disable-line react-hooks/exhaustive-deps

  async function enviar() {
    const t = texto.trim();
    if (!t || !perfil) return;
    setTexto('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const temp: Msg = { id: 'tmp-' + Date.now(), autor_id: perfil.id, tipo: 'texto', texto: t, arquivo_path: null, created_at: new Date().toISOString(), apagada_em: null, _enviando: true };
    setMsgs(l => [temp, ...l]);
    try {
      const real: any = await rpc('chat_enviar', { p_conversa: id, p_tipo: 'texto', p_texto: t });
      setMsgs(l => l.some(x => x.id === real.id) ? l.filter(x => x.id !== temp.id) : l.map(x => x.id === temp.id ? real : x));
    } catch {
      setMsgs(l => l.filter(x => x.id !== temp.id));
      setTexto(t);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }

  const bolha = ({ item: m, index }: { item: Msg; index: number }) => {
    const minha = m.autor_id === perfil?.id;
    const anterior = msgs[index + 1];
    const junta = anterior && anterior.autor_id === m.autor_id && new Date(m.created_at).getTime() - new Date(anterior.created_at).getTime() < 5 * 60000;
    const cor = minha ? c.acento : c.card;
    return (
      <View style={[s.linha, { justifyContent: minha ? 'flex-end' : 'flex-start', marginTop: junta ? 2 : 10 }]}>
        <Pressable onLongPress={m.tipo !== 'texto' && m.tipo !== 'imagem' ? undefined : undefined}
          onPress={m.tipo === 'audio' || m.tipo === 'arquivo' ? () => abrirNoSistema('#/conversas') : undefined}
          style={[s.bolha, { backgroundColor: cor, borderColor: c.borda, borderWidth: minha ? 0 : StyleSheet.hairlineWidth },
            minha ? { borderBottomRightRadius: junta ? 18 : 6 } : { borderBottomLeftRadius: junta ? 18 : 6 }, m._enviando && { opacity: 0.6 }]}>
          {m.apagada_em ? <Text style={[s.tx, { color: minha ? '#fff' : c.ink3, fontStyle: 'italic' }]}>Mensagem apagada</Text>
            : m.tipo === 'imagem' && m.arquivo_path ? <Image source={fotos[m.arquivo_path]} style={s.foto} contentFit="cover" transition={150} />
            : m.tipo === 'audio' ? <Text style={[s.tx, { color: minha ? '#fff' : c.ink }]}>🎤 Áudio — toque para ouvir no sistema</Text>
            : m.tipo === 'arquivo' ? <Text style={[s.tx, { color: minha ? '#fff' : c.ink }]}>📎 Arquivo — toque para abrir no sistema</Text>
            : null}
          {m.texto && !m.apagada_em ? <Text style={[s.tx, { color: minha ? '#fff' : c.ink }]}>{m.texto}</Text> : null}
          <Text style={[s.hora, { color: minha ? 'rgba(255,255,255,0.75)' : c.ink4 }]}>{m._enviando ? 'enviando…' : hora(m.created_at)}</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <Topo titulo={pessoa?.nome || 'Conversa'} direita={pessoa ? <Avatar nome={pessoa.nome} url={pessoa.avatar_url} tam={32} /> : undefined} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList ref={lista} data={msgs} inverted keyExtractor={m => m.id} renderItem={bolha}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }} keyboardDismissMode="interactive" />
        <View style={[s.barra, { paddingBottom: ins.bottom + 8, backgroundColor: c.fundo, borderTopColor: c.borda }]}>
          <TextInput value={texto} onChangeText={setTexto} placeholder="Mensagem" placeholderTextColor={c.ink4} multiline
            style={[s.campo, { backgroundColor: c.card, color: c.ink, borderColor: c.borda }]} />
          <Pressable onPress={enviar} disabled={!texto.trim()} style={[s.enviar, { backgroundColor: c.acento, opacity: texto.trim() ? 1 : 0.4 }]}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', marginLeft: 2 }}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row' },
  bolha: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 13, paddingTop: 8, paddingBottom: 6 },
  tx: { fontSize: 15.5, lineHeight: 21 },
  hora: { fontSize: 10.5, alignSelf: 'flex-end', marginTop: 2 },
  foto: { width: 220, height: 220, borderRadius: 12, marginBottom: 4 },
  barra: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 10, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  campo: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, borderWidth: StyleSheet.hairlineWidth },
  enviar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
