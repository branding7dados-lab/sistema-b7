/* Entrar com o usuário e a senha que a Branding7 forneceu — a mesma
   conta do site, pela mesma função (b7-auth), com a verificação em 2
   etapas quando a conta tem. */
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { chamarAuth, supabase } from '@/lib/supabase';
import { useSessao } from '@/lib/sessao';
import { GRADIENTE } from '@/lib/tema';

export default function Login() {
  const { sessao } = useSessao();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [etapa2, setEtapa2] = useState<{ desafio: string; metodo: string; email?: string } | null>(null);
  const [erro, setErro] = useState('');
  const [indo, setIndo] = useState(false);

  if (sessao) return <Redirect href="/" />;

  async function assumir(r: any) {
    if (!r || !r.access_token) throw new Error((r && r.erro) || 'Não foi possível entrar.');
    const { error } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
    if (error) throw error;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/');
  }

  async function entrar() {
    if (indo) return;
    setErro(''); setIndo(true);
    try {
      if (etapa2) {
        await assumir(await chamarAuth({ acao: 'login_2fa', desafio: etapa2.desafio, codigo: codigo.trim(), lembrar: true, aparelho_nome: 'App B7 (' + Platform.OS + ')' }));
      } else {
        const r = await chamarAuth({ acao: 'login', username: usuario.trim(), senha });
        if (r && r.precisa_2fa) { setEtapa2({ desafio: r.desafio, metodo: r.metodo, email: r.email }); return; }
        await assumir(r);
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErro(e?.message || 'Não foi possível entrar.');
    } finally { setIndo(false); }
  }

  return (
    <LinearGradient colors={GRADIENTE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.centro}>
        <Image source={require('../../assets/splash-icon.png')} style={s.logo} contentFit="contain" />
        <Text style={s.titulo}>{etapa2 ? 'Confirme que é você' : 'Entrar no B7'}</Text>
        <Text style={s.sub}>{etapa2
          ? (etapa2.metodo === 'email' ? 'Enviamos um código para ' + (etapa2.email || 'o seu e-mail') + '.' : 'Digite o código do seu app autenticador.')
          : 'Use o usuário e a senha que a Branding7 forneceu.'}</Text>
        <View style={s.caixa}>
          {etapa2 ? (
            <TextInput style={s.campo} value={codigo} onChangeText={setCodigo} placeholder="Código de 6 números" placeholderTextColor="rgba(255,255,255,0.55)"
              keyboardType="number-pad" maxLength={6} autoFocus onSubmitEditing={entrar} />
          ) : (
            <>
              <TextInput style={s.campo} value={usuario} onChangeText={setUsuario} placeholder="Usuário" placeholderTextColor="rgba(255,255,255,0.55)"
                autoCapitalize="none" autoCorrect={false} textContentType="username" returnKeyType="next" />
              <TextInput style={s.campo} value={senha} onChangeText={setSenha} placeholder="Senha" placeholderTextColor="rgba(255,255,255,0.55)"
                secureTextEntry textContentType="password" returnKeyType="go" onSubmitEditing={entrar} />
            </>
          )}
          {erro ? <Text style={s.erro}>{erro}</Text> : null}
          <Pressable onPress={entrar} style={({ pressed }) => [s.botao, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}>
            {indo ? <ActivityIndicator color="#6B2490" /> : <Text style={s.botaoTx}>{etapa2 ? 'Confirmar' : 'Entrar'}</Text>}
          </Pressable>
          {etapa2 ? <Pressable onPress={() => { setEtapa2(null); setCodigo(''); setErro(''); }}><Text style={s.voltar}>Voltar</Text></Pressable> : null}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: { width: 64, height: 76, marginBottom: 22 },
  titulo: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
  sub: { color: 'rgba(255,255,255,0.78)', fontSize: 15, marginTop: 6, lineHeight: 21 },
  caixa: { marginTop: 28, gap: 12 },
  campo: { height: 54, borderRadius: 16, paddingHorizontal: 18, fontSize: 16, color: '#fff', backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  erro: { color: '#FFD3DD', fontSize: 14, fontWeight: '600' },
  botao: { height: 54, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  botaoTx: { color: '#4A1F86', fontSize: 16.5, fontWeight: '800' },
  voltar: { color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: 14.5, fontWeight: '600', marginTop: 6 },
});
