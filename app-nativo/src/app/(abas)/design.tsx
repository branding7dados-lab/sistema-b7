/* DESIGN — as peças, agrupadas por etapa. "Minha fila" mostra só o
   que é da pessoa. */
import { useState } from 'react';
import { View } from 'react-native';
import { useSessao } from '@/lib/sessao';
import { ROT_DESIGN, DESIGN_ABERTO, lista, useLeitura } from '@/lib/dados';
import { supabase } from '@/lib/supabase';
import { hojeISO, prazoTexto } from '@/lib/datas';
import { abrirNoSistema } from '@/lib/sistema';
import { Tela } from '@/ui/tela';
import { Segmento } from '@/ui/segmento';
import { Avatar, Cartao, Linha, Secao, Selo, Vazio } from '@/ui/base';

export default function Design() {
  const { perfil } = useSessao();
  const [filtro, setFiltro] = useState<'minha' | 'todos'>('minha');
  const { dados, recarregar } = useLeitura(() => lista(supabase.from('design_resumo')
    .select('id,titulo,conteudo_titulo,cliente_nome,prazo,status,designer_id,designer_nome')
    .in('status', DESIGN_ABERTO).order('prazo', { ascending: true, nullsFirst: false }).limit(300)), []);
  const hoje = hojeISO();
  const itens = (dados || []).filter((d: any) => filtro === 'todos' || d.designer_id === perfil?.id);
  const grupos = DESIGN_ABERTO.map(st => [st, itens.filter((d: any) => d.status === st)] as const).filter(([, l]) => l.length);
  return (
    <Tela titulo="Design" sub={dados ? itens.length + ' em aberto' : 'Produção'} aoAtualizar={recarregar}>
      <Segmento opcoes={[['minha', 'Minha fila'], ['todos', 'Todos']]} valor={filtro} aoMudar={setFiltro} />
      {!dados ? <Vazio titulo="Carregando…" /> : grupos.length === 0
        ? <Vazio titulo={filtro === 'minha' ? 'Sua fila está vazia' : 'Nenhuma peça em aberto'} texto="Puxe para baixo para atualizar." />
        : grupos.map(([st, l]) => (
          <View key={st}>
            <Secao titulo={ROT_DESIGN[st] || st} extra={String(l.length)} />
            <Cartao>
              {l.map((d: any, i: number) => (
                <Linha key={d.id} ultimo={i === l.length - 1} titulo={d.titulo || d.conteudo_titulo || "Peça"}
                  sub={[d.cliente_nome].filter(Boolean).join(' · ')}
                  esquerda={<Avatar nome={d.designer_nome || 'Sem dono'} tam={36} />}
                  direita={<Selo texto={prazoTexto(d.prazo)} tom={d.prazo && d.prazo < hoje && st !== "aguardando_cliente" ? 'erro' : d.prazo === hoje ? 'ambar' : 'neutro'} />}
                  aoTocar={() => abrirNoSistema('#/design/' + d.id)} />
              ))}
            </Cartao>
          </View>
        ))}
    </Tela>
  );
}
