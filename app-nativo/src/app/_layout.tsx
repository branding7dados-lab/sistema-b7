import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ProvedorSessao, useSessao } from '@/lib/sessao';
import { useCores } from '@/lib/tema';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Raiz() {
  const { carregando } = useSessao();
  const c = useCores();
  useEffect(() => { if (!carregando) SplashScreen.hideAsync().catch(() => {}); }, [carregando]);
  if (carregando) return null;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.fundo }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(abas)" />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return <ProvedorSessao><Raiz /></ProvedorSessao>;
}
