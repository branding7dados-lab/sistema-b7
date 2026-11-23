# WhatsApp do B7 com vários números — desenho (4.84.0)

## Por quê
A B7 quer **centralizar no sistema todos os números de WhatsApp da agência**: o dos
videomakers (o único conectado hoje), o dos designers, o do coordenador e outros que
vierem. O administrador precisa **alternar entre os números ou ver todos juntos**;
cada equipe atende pelo número dela, sem abrir o celular.

## Metas
- Cadastrar, conectar (QR Code), renomear e desativar números, dentro do B7.
- Uma Central só. O admin tem uma barra "Todos · Vídeo · Design · Coord…" com contadores
  de não lidas; as demais pessoas veem só os números da sua equipe.
- Toda conversa e toda mensagem sabem por qual número da B7 passaram. Responder sai
  **sempre** pelo número da conversa.
- O número atual vira "Videomakers" e é o **número padrão**. Nada do histórico se perde.

## Fora desta entrega
- Otto e relógio de avisos em outros números. Continuam **só no padrão (Videomakers)**.
  Foi decisão do Yury: "depois dou um jeito nele".
- Dados do grupo (membros) e perfil do contato. Ficam para a próxima entrega.

## Anti-metas (seria fracasso mesmo funcionando)
- Mensagem de um número sair por outro.
- Designer ou coordenador ver conversa de número que não é da equipe dele.
- Otto mudar de comportamento no número dos videomakers.
- A Central de quem só tem um número ficar mais complicada que hoje.

## Jeitos considerados
| | Como | Escolha |
|---|---|---|
| **A** | Cadastro `wa_numeros` + coluna `numero_id` em conversas e mensagens | ✅ escolhida pelo Yury |
| B | Um conjunto de tabelas por número | ❌ cada número novo mexe no banco; "Todos" fica difícil |
| C | Uma Central separada por número | ❌ não junta; cada recurso feito N vezes |

## Banco (migração `zzz383_wa_varios_numeros.sql`)
- **`wa_numeros`** (`id uuid`, `nome`, `instancia text unique` (nome no Evolution), `cor`,
  `equipes text[]` ⊂ {`videomaker`,`designer`,`coordenador`}, `padrao bool` (um só true),
  `numero` (telefone conectado), `estado`, `ativo bool`, `ordem`, `criado_em`).
  Semente: a instância de hoje (`b7-piloto`, ou o valor de `EVOLUTION_INSTANCE`), com
  nome "Videomakers", padrão e equipe `{videomaker}`.
- `wa_numero_padrao()`: devolve o id do padrão.
- **`wa_conversas`**: `+ numero_id uuid not null default wa_numero_padrao()`, com
  chave primária **(numero_id, jid)**.
- **`wa_mensagens`**: `+ numero_id … default wa_numero_padrao()`, com chave **(numero_id, id)**
  e FK (numero_id, jid) → wa_conversas. Isso é necessário porque a mesma mensagem de um
  grupo chega pelos dois números com o mesmo `id`.
- `wa_contatos` continua global: nome e foto da pessoa são os mesmos em qualquer número.
- **Acesso**: `wa_pode_ver_numero(numero_id)` = admin, ou perfil ativo cujo papel ou
  função extra está em `equipes`. O RLS de conversas e mensagens passa a usar essa
  função. `pode_ver_wa()` = "vê ao menos um número" (segue valendo para as outras tabelas).
- RPCs `wa_conversa_marcar`, `wa_nota_interna`, `wa_painel_equipe`: ganham
  `p_numero uuid default null` (null = padrão) e conferem `wa_pode_ver_numero`. A versão
  antiga é removida para não haver ambiguidade.
- Aviso de espera e push (`wa_avisar_espera`, `wa_quem_ve_whatsapp`): mandam para quem vê
  aquele número. A chave do evento inclui o número.

## Servidor (Edge Functions)
- `_shared/wa.ts`: `numeroPorId`, `numeroPorInstancia`, `numeroPadrao`, com cache curto.
  `gravar` e `garantirConversa` recebem o número e gravam `numero_id`.
- `wa-evolution`: toda ação recebe `numero` (id; vazio = padrão), resolve a instância e
  confere a permissão **daquele** número. Ações de admin novas: `numeros` (lista com estado),
  `numero_salvar` (criar/editar), `numero_desativar`. `estado`, `conectar` e `desconectar`
  passam a valer por número. Ao conectar, o webhook é ligado na instância daquele número.
- `wa-entrada`: identifica o número pelo campo `instance` do evento do Evolution. Instância
  desconhecida → ignora. O Otto (`aoReceber`) só roda se o número for o padrão.
- Otto (`assistente.ts`, `otto-*.ts`, `print-conversa.ts`): toda leitura e escrita em
  conversas e mensagens filtra `numero_id = padrão`. O comportamento não muda.

## Telas
- **Central**: barra de números no topo da lista, só se a pessoa vê mais de um número:
  "Todos" e um botão por número, com cor e contador de não lidas. Em "Todos", cada conversa
  mostra a bolinha da cor do número. Escolher um número filtra a lista; a escolha fica
  guardada no aparelho. Abrir uma conversa leva o número junto em todas as ações.
- **Configurações do WhatsApp → Números** (admin): lista com estado. Ações: "+ Adicionar
  número" (nome, cor, equipes, QR), conectar/desconectar, editar, desativar. Desativar
  esconde o número e guarda o histórico.
- A janela de conexão (QR, `wa-central.js`) recebe o número.
- **Enviar no WhatsApp**: lista as conversas dos números que a pessoa vê. Começa no número
  da equipe de quem envia (designer → Designers); o admin pode trocar.
- Designers e coordenadores passam a ver o item WhatsApp se tiverem algum número.

## Ordem de publicação
1. Aplicar `zzz383` no banco (Actions → sql). A migração é compatível com as funções
   antigas: o default põe tudo no padrão.
2. Merge na main: as Edge Functions publicam sozinhas e o site atualiza.
3. Adicionar os números novos pelas Configurações.

## Decisões deixadas para quem constrói
- Cores sugeridas, textos e o desenho fino da barra, seguindo o estilo `wz-` atual.
- Nomes internos das ações e funções auxiliares.

Versão: **4.84.0** (novidade), com registro em `js/novidades.js`.
