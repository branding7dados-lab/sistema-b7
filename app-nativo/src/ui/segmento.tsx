import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useCores } from '@/lib/tema';

export function Segmento<T extends string>({ opcoes, valor, aoMudar }: { opcoes: [T, string][]; valor: T; aoMudar: (v: T) => void }) {
  const c = useCores();
  return (
    <View style={[s.caixa, { backgroundColor: c.suave }]}>
      {opcoes.map(([v, r]) => (
        <Pressable key={v} onPress={() => { if (v !== valor) { Haptics.selectionAsync(); aoMudar(v); } }}
          style={[s.op, v === valor && { backgroundColor: c.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 }]}>
          <Text style={[s.tx, { color: v === valor ? c.ink : c.ink3 }]}>{r}</Text>
        </Pressable>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  caixa: { flexDirection: 'row', borderRadius: 14, padding: 4, marginTop: 14 },
  op: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center' },
  tx: { fontSize: 14, fontWeight: '700' },
});
