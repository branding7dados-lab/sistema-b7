# v3.4.0: telas abrindo na hora (memória de verdade) e puxar para atualizar sem piscar

Itens 5 e 2 da lista de melhorias aprovada pelo Kevin.

## 5. Telas abrindo na hora (`js/memoria.js`)
A memória de dados (zzz2) já existia: a tela abre com a última resposta e confere por trás. Mas quase nunca dava tempo de usar, porque tudo apagava a validade da memória inteira:
1. **Qualquer `B7.DB.rpc` cujo nome não começasse com listar/painel/…** contava como escrita. Isso incluía leituras (Panorama do mês, Gestão, relatórios, `projetos_avulsos_listar`) e registros que não aparecem nas telas (o `perfil_heartbeat` de cada minuto, notificação lida, mensagem lida). Agora há uma lista do que **não muda** dado de tela (`RPC_NAO_MUDA`).
2. **Sair do Design, do Kanban ou do Calendário** chamava `fecharCanal`, e o "fechar" no nome contava como escrita. Corrigido: `fechar(?!Canal)`.
3. **Abrir o Vídeo** roda `verificarAlertasPrazoVideo`, que só cria avisos e contava como escrita. Saiu da lista.
4. **Aviso do tempo real** de notificação, conversa, suporte ou presença não apaga mais a memória (`TABELA_NAO_MUDA`).
5. **Defeito escondido:** o embrulho do `B7.DB.canal` perdia o 4º argumento (o aviso de "a ligação caiu"). Por isso a reconexão do tempo real (zzz169) nunca era avisada. Agora o argumento passa.

Medido (processador 4× mais lento, rede de 120 ms): a 2ª visita ao Vídeo, depois de passar por Design, Kanban e Calendário, mostra os dados em **295 ms (era 558 ms)**. As visitas que não cruzam com escrita abrem direto da memória.

## 2. Puxar para atualizar (`js/movimento.js`, `js/tempo-real.js`, `styles/global.css`)
- O puxar agora usa a mesma proteção da atualização do tempo real (v3.0.8): `blindar` (o painel recusa o esqueleto enquanto atualiza), `vigiarPartes` (partes que carregam sozinhas guardam o conteúdo) e as rolagens internas voltam.
- Durante a atualização a tela só esmaece. Antes tinha `blur(1.5px)`, que pesava no celular.
- Medido com toque simulado (puxar 260 px na tela de Clientes, rede de 700 ms): **quadros com esqueleto durante a atualização: 44 antes → 0 agora**.

`npm test` passou.
