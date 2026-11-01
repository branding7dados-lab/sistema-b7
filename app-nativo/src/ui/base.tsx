/* Peças de tela nativas do app B7: cartão, linha tocável, selo, avatar,
   título de seção e estado vazio. Tudo nativo (View/Text/Pressable), com
   toque que vibra de leve e responde na hora. */
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCores } from '@/lib/tema';

export function Cartao({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useCores();
  return <View style={[s.cartao, { backgroundColor: c.card, borderColor: c.borda }, style]}>{children}</View>;
}

export function Secao({ titulo, extra }: { titulo: string; extra?: string }) {
  const c = useCores();
  return (
    <View style={s.secao}>
      <Text style={[s.secaoTx, { color: c.ink3 }]}>{titulo.toUpperCase()}</Text>
      {extra ? <Text style={[s.secaoExtra, { color: c.ink4 }]}>{extra}</Text> : null}
    </View>
  );
}

export function Selo({ texto, tom = 'neutro' }: { texto: string; tom?: 'neutro' | 'erro' | 'ambar' | 'ok' | 'acento' }) {
  const c = useCores();
  const cor = { neutro: [c.suave, c.ink3], erro: [c.erroSuave, c.erro], ambar: [c.ambarSuave, c.ambar], ok: [c.okSuave, c.ok], acento: [c.acentoSuave, c.acento] }[tom];
  return <View style={[s.selo, { backgroundColor: cor[0] }]}><Text style={[s.seloTx, { color: cor[1] }]}>{texto}</Text></View>;
}

export function Avatar({ nome, url, tam = 40 }: { nome?: string | null; url?: string | null; tam?: number }) {
  const c = useCores();
  const ini = String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  if (url) return <Image source={url} style={{ width: tam, height: tam, borderRadius: tam / 2 }} contentFit="cover" transition={150} />;
  return (
    <View style={{ width: tam, height: tam, borderRadius: tam / 2, backgroundColor: c.acentoSuave, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c.acento, fontWeight: '800', fontSize: tam * 0.36 }}>{ini}</Text>
    </View>
  );
}

export function Linha({ titulo, sub, esquerda, direita, aoTocar, ultimo }: {
  titulo: string; sub?: string; esquerda?: ReactNode; direita?: ReactNode; aoTocar?: () => void; ultimo?: boolean;
}) {
  const c = useCores();
  return (
    <Pressable
      onPress={aoTocar ? () => { Haptics.selectionAsync(); aoTocar(); } : undefined}
      android_ripple={{ color: c.suave }}
      style={({ pressed }) => [s.linha, !ultimo && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borda }, pressed && { opacity: 0.7 }]}>
      {esquerda}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[s.linhaTit, { color: c.ink }]}>{titulo}</Text>
        {sub ? <Text numberOfLines={1} style={[s.linhaSub, { color: c.ink3 }]}>{sub}</Text> : null}
      </View>
      {direita}
    </Pressable>
  );
}

export function Vazio({ titulo, texto }: { titulo: string; texto?: string }) {
  const c = useCores();
  return (
    <View style={s.vazio}>
      <Text style={[s.vazioTit, { color: c.ink2 }]}>{titulo}</Text>
      {texto ? <Text style={[s.vazioTx, { color: c.ink3 }]}>{texto}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  cartao: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  secao: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 26, marginBottom: 10, paddingHorizontal: 4 },
  secaoTx: { fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  secaoExtra: { fontSize: 12, fontWeight: '600' },
  selo: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 },
  seloTx: { fontSize: 11.5, fontWeight: '800' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  linhaTit: { fontSize: 15.5, fontWeight: '700' },
  linhaSub: { fontSize: 13, marginTop: 2 },
  vazio: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  vazioTit: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  vazioTx: { fontSize: 14, marginTop: 6, textAlign: 'center', lineHeight: 20 },
});
