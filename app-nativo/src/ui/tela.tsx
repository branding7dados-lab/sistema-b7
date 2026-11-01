/* Uma tela rolável com título grande (como nos apps do sistema) e o
   "puxar para atualizar" nativo do Android/iOS. */
import { type ReactNode, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCores } from '@/lib/tema';

export function Tela({ titulo, sub, aoAtualizar, children, topo }: {
  titulo: string; sub?: string; aoAtualizar?: () => Promise<unknown>; children: ReactNode; topo?: ReactNode;
}) {
  const c = useCores(), ins = useSafeAreaInsets();
  const [atualizando, setAtualizando] = useState(false);
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.fundo }}
      contentContainerStyle={{ paddingTop: ins.top + 14, paddingBottom: ins.bottom + 110, paddingHorizontal: 18 }}
      refreshControl={aoAtualizar ? (
        <RefreshControl refreshing={atualizando} tintColor={c.acento} colors={[c.acento]} progressBackgroundColor={c.card}
          onRefresh={async () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAtualizando(true); try { await aoAtualizar(); } finally { setAtualizando(false); } }} />
      ) : undefined}>
      {topo}
      <View style={{ marginBottom: 6 }}>
        {sub ? <Text style={[s.sub, { color: c.acento }]}>{sub.toUpperCase()}</Text> : null}
        <Text style={[s.titulo, { color: c.ink }]}>{titulo}</Text>
      </View>
      {children}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  sub: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  titulo: { fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
});
