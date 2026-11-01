/* CONVERSAS — lista de conversas com a equipe, não lidas em destaque.
   Atualiza sozinha quando chega mensagem. */
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSessao } from '@/lib/sessao';
import { useCores } from '@/lib/tema';
import { rpc, useLeitura } from '@/lib/dados';
import { useAoVivo } from '@/lib/aovivo';
import { pessoas } from '@/lib/pessoas';
import { Topo } from '@/ui/topo';
import { Avatar, Cartao, Linha, Vazio } from '@/ui/base';
import { FolhaOpcoes } from '@/ui/folha';

const hora = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso), h = new Date();
  return d.toDateString() === h.toDateString() ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};
export const previa = (u: any) => !u ? '' : u.apagada ? 'Mensagem apagada' : u.tipo === 'imagem' ? '📷 Foto' : u.tipo === 'audio' ? '🎤 Áudio' : u.tipo === 'arquivo' ? '📎 Arquivo' : (u.texto || '');

export default function Conversas() {
  const { perfil } = useSessao();
  const c = useCores(), ins = useSafeAreaInsets();
  const [nova, setNova] = useState(false);
  const [puxando, setPuxando] = useState(false);
  const { dados, recarregar } = useLeitura(async () => {
    const [l, p] = await Promise.all([rpc<any[]>('chat_lista'), pessoas()]);
    return { lista: (l || []).sort((a, b) => String(b.ultima_em || '').localeCompare(String(a.ultima_em || ''))), pessoas: p };
  }, []);
  useAoVivo('conversas', [{ tabela: 'chat_mensagens' }], recarregar);

  return (
    <View style={{ flex: 1, backgroundColor: c.fundo }}>
      <Topo titulo="Conversas" direita={<Pressable hitSlop={10} onPress={() => setNova(true)}><Text style={{ color: c.acento, fontSize: 16, fontWeight: '700' }}>Nova</Text></Pressable>} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: ins.bottom + 30 }}
        refreshControl={<RefreshControl refreshing={puxando} tintColor={c.acento} colors={[c.acento]}
          onRefresh={async () => { setPuxando(true); await recarregar(); setPuxando(false); }} />}>
        {!dados ? <Vazio titulo="Carregando…" /> : dados.lista.length === 0 ? <Vazio titulo="Nenhuma conversa ainda" texto="Toque em Nova para falar com alguém da equipe." /> : (
          <Cartao>
            {dados.lista.map((cv: any, i: number) => {
              const p = dados.pessoas.get(cv.outro_id);
              const minha = cv.ultima && cv.ultima.autor_id === perfil?.id;
              return (
                <Linha key={cv.conversa_id} ultimo={i === dados.lista.length - 1} titulo={p?.nome || 'Conversa'}
                  sub={(minha ? 'Você: ' : '') + previa(cv.ultima)} esquerda={<Avatar nome={p?.nome} url={p?.avatar_url} tam={46} />}
                  direita={<View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: cv.nao_lidas ? c.acento : c.ink4, fontSize: 12, fontWeight: '700' }}>{hora(cv.ultima_em)}</Text>
                    {cv.nao_lidas ? <View style={{ backgroundColor: c.acento, borderRadius: 99, minWidth: 20, paddingHorizontal: 6, height: 20, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 11.5, fontWeight: '800' }}>{cv.nao_lidas}</Text></View> : null}
                  </View>}
                  aoTocar={() => router.push({ pathname: '/conversas/[id]', params: { id: cv.conversa_id, outro: cv.outro_id } })} />
              );
            })}
          </Cartao>
        )}
      </ScrollView>
      <FolhaOpcoes aberta={nova} titulo="Conversar com…" aoFechar={() => setNova(false)}
        opcoes={dados ? [...dados.pessoas.values()].filter(p => p.id !== perfil?.id).map(p => ({
          rotulo: p.nome, sub: '@' + p.username,
          aoEscolher: async () => {
            try { const cid = await rpc<string>('chat_abrir_direta', { p_outro: p.id }); router.push({ pathname: '/conversas/[id]', params: { id: cid, outro: p.id } }); } catch { /* sem permissão */ }
          },
        })) : []} />
    </View>
  );
}
