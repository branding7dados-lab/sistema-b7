/* A barra de abas NATIVA do sistema (Material no Android; no iPhone, a
   barra de vidro do próprio iOS). */
import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useSessao } from '@/lib/sessao';
import { useCores } from '@/lib/tema';

export default function Abas() {
  const { sessao } = useSessao();
  const c = useCores();
  if (!sessao) return <Redirect href="/login" />;
  return (
    <NativeTabs tintColor={c.acento} labelStyle={{ color: c.ink3 }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' }} md="space_dashboard" />
        <NativeTabs.Trigger.Label>Painel</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="video">
        <NativeTabs.Trigger.Icon sf={{ default: 'film', selected: 'film.fill' }} md="movie" />
        <NativeTabs.Trigger.Label>Vídeo</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="design">
        <NativeTabs.Trigger.Icon sf={{ default: 'paintpalette', selected: 'paintpalette.fill' }} md="palette" />
        <NativeTabs.Trigger.Label>Design</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="gravacoes">
        <NativeTabs.Trigger.Icon sf={{ default: 'video', selected: 'video.fill' }} md="videocam" />
        <NativeTabs.Trigger.Label>Gravações</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mais">
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
        <NativeTabs.Trigger.Label>Mais</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
