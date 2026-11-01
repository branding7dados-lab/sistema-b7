/* Cabeçalho das telas de detalhe: voltar + título, sobre o fundo. */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCores } from '@/lib/tema';

export function Topo({ titulo, direita }: { titulo?: string; direita?: React.ReactNode }) {
  const c = useCores(), ins = useSafeAreaInsets();
  return (
    <View style={[s.topo, { paddingTop: ins.top + 6, backgroundColor: c.fundo, borderBottomColor: c.borda }]}>
      <Pressable hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={s.voltar}>
        <Text style={[s.seta, { color: c.acento }]}>‹</Text>
        <Text style={[s.voltarTx, { color: c.acento }]}>Voltar</Text>
      </Pressable>
      <Text numberOfLines={1} style={[s.titulo, { color: c.ink }]}>{titulo || ''}</Text>
      <View style={s.direita}>{direita}</View>
    </View>
  );
}
const s = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  voltar: { flexDirection: 'row', alignItems: 'center', width: 86 },
  seta: { fontSize: 30, lineHeight: 30, marginTop: -3, marginRight: 2 },
  voltarTx: { fontSize: 16, fontWeight: '600' },
  titulo: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800' },
  direita: { width: 86, alignItems: 'flex-end' },
});
