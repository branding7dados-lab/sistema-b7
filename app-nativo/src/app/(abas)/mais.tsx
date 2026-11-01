/* MAIS — a conta e os atalhos para o resto do sistema. */
import { Alert, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useSessao } from '@/lib/sessao';
import { useCores } from '@/lib/tema';
import { abrirNoSistema } from '@/lib/sistema';
import { Tela } from '@/ui/tela';
import { Avatar, Cartao, Linha, Secao } from '@/ui/base';

const ATALHOS: [string, string][] = [
  ['Conversas', '#/conversas'], ['Clientes', '#/clientes'], ['Linhas editoriais', '#/linhas'], ['Aprovações', '#/aprovacoes'],
  ['Calendário', '#/calendario'], ['Gestão', '#/gestao'], ['Configurações', '#/config'],
];

export default function Mais() {
  const { perfil, sair } = useSessao();
  const c = useCores();
  return (
    <Tela titulo="Mais">
      <Cartao style={{ marginTop: 14 }}>
        <Linha titulo={perfil?.nome || ''} sub={'@' + (perfil?.username || '')} esquerda={<Avatar nome={perfil?.nome} url={perfil?.avatar_url} tam={48} />} ultimo />
      </Cartao>
      <Secao titulo="No sistema completo" />
      <Cartao>
        {ATALHOS.map(([r, rota], i) => (
          <Linha key={rota} titulo={r} ultimo={i === ATALHOS.length - 1} direita={<Text style={{ color: c.ink4, fontSize: 18 }}>›</Text>}
            aoTocar={() => abrirNoSistema(rota)} />
        ))}
      </Cartao>
      <Secao titulo="Conta" />
      <Cartao>
        <Linha titulo="Sair" ultimo aoTocar={() => Alert.alert('Sair da conta?', 'Você vai precisar entrar de novo.', [
          { text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: () => sair() }])} />
      </Cartao>
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Text style={{ color: c.ink4, fontSize: 12 }}>App B7 nativo · prévia {Constants.expoConfig?.version}</Text>
      </View>
    </Tela>
  );
}
