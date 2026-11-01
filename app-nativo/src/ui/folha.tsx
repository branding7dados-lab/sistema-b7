/* Folhas que sobem de baixo (nativas): escolher uma opção ou escrever um
   texto curto — no lugar do prompt() do navegador. */
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCores } from '@/lib/tema';

export type Opcao = { rotulo: string; sub?: string; perigo?: boolean; aoEscolher: () => void };

export function FolhaOpcoes({ aberta, titulo, opcoes, aoFechar }: { aberta: boolean; titulo: string; opcoes: Opcao[]; aoFechar: () => void }) {
  const c = useCores(), ins = useSafeAreaInsets();
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <Pressable style={s.veu} onPress={aoFechar} />
      <View style={[s.folha, { backgroundColor: c.card, paddingBottom: ins.bottom + 12 }]}>
        <View style={[s.alca, { backgroundColor: c.ink4 }]} />
        <Text style={[s.titulo, { color: c.ink }]}>{titulo}</Text>
        <ScrollView style={{ maxHeight: 460 }}>
        {opcoes.map((o, i) => (
          <Pressable key={i} android_ripple={{ color: c.suave }} onPress={() => { Haptics.selectionAsync(); aoFechar(); o.aoEscolher(); }}
            style={({ pressed }) => [s.op, { borderTopColor: c.borda }, pressed && { opacity: 0.7 }]}>
            <Text style={[s.opTx, { color: o.perigo ? c.erro : c.ink }]}>{o.rotulo}</Text>
            {o.sub ? <Text style={[s.opSub, { color: c.ink3 }]}>{o.sub}</Text> : null}
          </Pressable>
        ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function FolhaTexto({ aberta, titulo, ajuda, placeholder, botao, teclado, aoFechar, aoEnviar }: {
  aberta: boolean; titulo: string; ajuda?: string; placeholder?: string; botao: string; teclado?: 'default' | 'url';
  aoFechar: () => void; aoEnviar: (texto: string) => Promise<void> | void;
}) {
  const c = useCores(), ins = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [indo, setIndo] = useState(false);
  const fechar = () => { setTexto(''); aoFechar(); };
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={fechar} statusBarTranslucent>
      <Pressable style={s.veu} onPress={fechar} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.folha, { backgroundColor: c.card, paddingBottom: ins.bottom + 16 }]}>
          <View style={[s.alca, { backgroundColor: c.ink4 }]} />
          <Text style={[s.titulo, { color: c.ink }]}>{titulo}</Text>
          {ajuda ? <Text style={[s.ajuda, { color: c.ink3 }]}>{ajuda}</Text> : null}
          <TextInput value={texto} onChangeText={setTexto} placeholder={placeholder} placeholderTextColor={c.ink4} autoFocus multiline={teclado !== 'url'}
            keyboardType={teclado === 'url' ? 'url' : 'default'} autoCapitalize={teclado === 'url' ? 'none' : 'sentences'}
            style={[s.campo, { color: c.ink, backgroundColor: c.suave }]} />
          <Pressable disabled={indo || !texto.trim()} onPress={async () => {
            setIndo(true);
            try { await aoEnviar(texto.trim()); setTexto(''); aoFechar(); } finally { setIndo(false); }
          }} style={[s.botao, { backgroundColor: c.acento, opacity: indo || !texto.trim() ? 0.5 : 1 }]}>
            <Text style={s.botaoTx}>{indo ? 'Enviando…' : botao}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  veu: { flex: 1, backgroundColor: 'rgba(8,4,20,0.45)' },
  folha: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 8 },
  alca: { width: 38, height: 5, borderRadius: 3, alignSelf: 'center', opacity: 0.5, marginBottom: 12 },
  titulo: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  ajuda: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  op: { paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth },
  opTx: { fontSize: 16, fontWeight: '700' },
  opSub: { fontSize: 13, marginTop: 2 },
  campo: { minHeight: 52, maxHeight: 160, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginTop: 6 },
  botao: { height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  botaoTx: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
