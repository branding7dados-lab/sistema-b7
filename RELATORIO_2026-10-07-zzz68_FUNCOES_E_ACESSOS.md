# Relatório — Funções e Acessos B7

**Versão:** `2026-10-07-zzz68` · **Cache:** `roteiros-b7-v273`
**Escopo combinado com Kevin:** etapas 1 a 4 (fundação, migração, motor de permissões das telas, tela de Usuários e acessos). A trava por módulo no banco e a limpeza do legado ficam para pacotes próprios. Usuário interno sem função só é permitido para administrador.

## Resumo
O acesso da equipe interna deixou de ser "papel + funções extras" e passou a ser:

**conta → administrador (sim/não) → função principal → módulos padrão da função → exceções por usuário → acesso efetivo**

Função e acesso a módulo são coisas separadas: a função diz o que a pessoa **faz** (Painel, quem pode ser responsável); o módulo diz o que ela **abre**. Dar o módulo de Roteiros a um Designer não o transforma em Coordenador nem em Videomaker.

## Como era antes
- `perfis.papel` com cinco valores (admin, coordenador, designer, videomaker, cliente).
- `perfis_funcoes_extra`: funções somadas ao papel (ex.: admin + videomaker).
- Rotas e menu: listas fixas por papel em `js/permissoes.js`; o Vídeo tinha uma regra à parte (papel ou função extra).
- Painel: uma visão para cada função que a pessoa acumulasse.
- Elegibilidade de vídeo: papel videomaker OU função extra videomaker.
- Para alguém abrir uma área a mais, a única saída era dar uma função extra "de mentira".

## Novo modelo
- **Administrador** (`perfis.eh_admin`): privilégio. Abre tudo e gerencia contas. Não faz ninguém ser videomaker, designer ou coordenador.
- **Função principal** (`perfis.funcao`): coordenador, designer, videomaker ou nenhuma (nenhuma só para administrador).
- **Padrão da função** (`funcao_modulos`): os módulos que a função abre.
- **Exceção por usuário** (`perfil_modulos`): "permitir" um módulo a mais ou "negar" um que a função tem.
- **Acesso efetivo** (`modulos_efetivos`): resolvido no banco e entregue pronto na sessão.
- **Cliente**: fica fora disso tudo; continua com o Portal, as empresas vinculadas e a permissão de aprovar.

## Funções
Padrões iniciais = exatamente o que cada papel já abria (ninguém perdeu acesso):

| Função | Módulos padrão |
|---|---|
| Coordenador | Clientes, Linhas editoriais, Roteiros, Gravações, Vídeo, Design, Publicações do Dia, Aprovações, Status semanal, Produção (quadro), Calendário, Oportunidades |
| Designer | Design, Linhas editoriais, Calendário |
| Videomaker | Vídeo, Gravações, Roteiros, Calendário |

O detalhe de um cliente e o detalhe de uma gravação são rotas de **contexto**: toda a equipe interna abre, com ou sem o módulo (o Designer já abria os dois sem ter Clientes nem Gravações). Arquivados continua de administrador e coordenador. Usuários, Lixeira, Importar e Atalhos continuam só de administrador.

## Herança
Herança de verdade, não cópia: o padrão não é gravado na conta. Ao salvar o padrão de uma função em "Funções e acessos", todo mundo que tem a função passa a ter o módulo no próximo carregamento — menos quem tem exceção para aquele módulo.

## Personalizações por usuário
Na edição da conta, cada módulo é uma chave com a origem escrita embaixo: "Padrão de Videomaker" ou "Personalizado". Ligar um módulo que a função não tem cria uma exceção "permitir"; desligar um que ela tem cria "negar". Exceção que fica igual ao padrão é descartada sozinha. **Restaurar padrão da função** apaga as exceções da pessoa (a mudança só vale ao salvar).

Ao trocar a função, o padrão muda na hora e as exceções continuam valendo; a tela avisa isso antes de salvar.

## Migração dos usuários atuais
Cinco contas, nenhuma de cliente, nenhuma ambígua:

| Antes | Depois |
|---|---|
| admin + função extra videomaker (1) | Administrador · função Videomaker |
| coordenador (1) | função Coordenador |
| designer (2) | função Designer |
| videomaker (1) | função Videomaker |

Conferido no banco depois da migração. Regra para o futuro, caso existisse admin com mais de uma função extra: coordenador > videomaker > designer.

## Painel
Uma função, um Painel: Coordenador, Designer ou Videomaker. Ganhar o módulo de Vídeo ou de Design não cria um segundo Painel. Administrador sem função não tem Painel (a casa é a Central). Administrador + Videomaker continua com o Painel do Videomaker — é o caso do Kevin, igual a antes.

## Elegibilidade operacional
Quem pode ser responsável por vídeo: função Videomaker e conta ativa. Ter o módulo de Vídeo não torna ninguém elegível. Isso funciona sem eu ter alterado as funções de elegibilidade: o banco mantém o espelho legado (ver "Legado"), então `eh_videomaker_elegivel`, `sou_videomaker()` e a lista `videomakers_elegiveis` respondem pela função principal.

**Design:** a elegibilidade para receber peças não foi alterada neste pacote (continua como estava). Não auditei a fundo o seletor de responsável do Design.

## Sidebar e rotas
`js/permissoes.js` ganhou um registro canônico de módulos (id, rótulo, rotas) e uma única decisão, `B7.Perm.podeRota`: administrador abre tudo; cliente segue a lista do Portal; o resto da equipe abre as rotas de contexto e as rotas dos módulos do seu acesso efetivo. Rota sem dono é só de administrador. O menu fixo, a barra lateral nova, a barra inferior do celular e o "Criar" já decidiam por `podeRota`, então passaram a seguir os módulos.

## Busca / notificações / deep links
- **Busca global:** já filtrava os resultados pela guarda de rota (Design e Vídeo só são consultados se a pessoa abre esses módulos). Não mudei. Limite: resultados de clientes, gravações e roteiros seguem as rotas de contexto, que toda a equipe interna abre.
- **Notificações:** não alterei regra nenhuma. Continuam seguindo papel/função (pelo espelho) e responsabilidade, não módulo.
- **Links diretos:** passam pela mesma guarda de rota.

## Prévia de usuário
A simulação passou a carregar a função e os módulos efetivos da pessoa. Observação: desde a zzz63 o "Visualizar como…" entra direto na conta de quem é da equipe, então a simulação só é usada hoje pelo caminho antigo de "só visualizar", que não é mais oferecido na tela.

## Banco de dados
`migration_funcoes_e_acessos.sql` (aplicada).

- **Colunas novas em `perfis`:** `eh_admin`, `funcao` (com validação).
- **Tabelas novas:** `modulos` (registro, 12 módulos), `funcao_modulos` (padrões), `perfil_modulos` (exceções).
- **Funções novas:** `modulos_efetivos(perfil)`, `tem_acesso_modulo(modulo)`, `minha_funcao()`.
- **Gatilhos novos em `perfis`:** `perfis_b_modelo` (mantém papel coerente com administrador/função, e aceita escrita legada só no papel) e `perfis_y_espelho_extra` (mantém `perfis_funcoes_extra`).
- **View alterada:** `minha_sessao` ganhou `eh_admin`, `funcao` e `modulos` (só acréscimo de colunas).
- **Restrições:** conta interna não administradora precisa ter função; cliente não tem função nem é administrador.

**Servidor (`b7-auth`, publicado):** criar e alterar conta aceitam o modelo novo (`tipo`, `eh_admin`, `funcao`, exceções de módulo); ação nova `salvar_preset`; a listagem devolve módulos, padrões e exceções. Tudo validado no servidor e só para administrador. O formato antigo (papel + funções extras) continua aceito.

## RLS / segurança
- **Nenhuma das 137 políticas existentes foi alterada.**
- As três tabelas novas têm RLS: leitura para a equipe interna (exceções: só a própria pessoa ou administrador); **sem política de escrita** — só o servidor grava, depois de conferir que quem chamou é administrador.
- Funções novas com `search_path` fixo e sem acesso anônimo.
- **Acesso direto à API sem o módulo: NÃO é negado ainda.** Hoje, tirar um módulo de alguém esconde a tela e bloqueia a rota, mas o banco continua deixando a equipe interna ler os dados daquele domínio por fora do sistema. Fechar isso exige reescrever as políticas de leitura por domínio — é a etapa 5, combinada para um pacote próprio.

## Legado
- `perfis.papel` e `perfis_funcoes_extra` continuam existindo, mantidos pelo banco como **espelho** do modelo novo (administrador → `admin`; administrador + função → `admin` + função extra; não administrador → papel = função). É por isso que todas as políticas, `sou_equipe()`, `sou_videomaker()`, as notificações e a lista de videomakers seguem funcionando sem alteração.
- Nada foi apagado. Remover o legado só faz sentido depois da etapa 5.

## Arquivos alterados
`migration_funcoes_e_acessos.sql` (novo), `supabase/functions/b7-auth/index.ts`, `js/auth.js`, `js/permissoes.js`, `js/usuarios.js`, `js/previa-usuario.js`, `styles/auth.css`.

## Testes executados
**Banco** (transação desfeita ao final; nada ficou gravado):
- as cinco contas com administrador/função/espelho corretos;
- trocar função, tornar administrador, administrador sem função, escrita legada só no papel, virar cliente e voltar: papel e espelho acompanharam em todos;
- tirar a função de quem não é administrador: barrado;
- exceções: videomaker com Linhas permitido e Calendário negado → sessão devolveu Linhas, Roteiros, Gravações, Vídeo;
- videomaker tentando gravar exceção para si e tentando virar administrador direto no banco: barrado / 0 linhas alteradas;
- videomaker pedindo os módulos de outra pessoa: vazio; administrador pedindo os de outra pessoa: funcionou;
- Kevin continua elegível para vídeo e equipe.

**Telas** (app local, arquivos novos, sessão simulada, servidor substituído por dados de exemplo):
- videomaker + Linhas: abre Linhas; Painel continua só o de Vídeo; função continua videomaker;
- designer + Vídeo: abre Vídeo; Painel continua só o de Design; não é elegível para vídeo;
- videomaker sem Calendário: Calendário negado;
- administrador sem função: abre tudo, sem Painel; administrador + videomaker: Painel de Vídeo e acesso a Usuários;
- sessão antiga (sem o campo novo): cai no padrão da função;
- cliente: só as rotas do Portal;
- tela de Usuários: lista com "Admin" separado da função e resumo dos módulos; editar mostrou herdado × personalizado, o aviso de troca de função e mandou ao servidor o pedido certo;
- modal sem estouro horizontal em 1400 px e em 375 px.

## Regressões verificadas
Coordenador, Designer, Videomaker, Administrador, Administrador + função e Cliente: pela guarda de rota, em sessão simulada. Painel: idem. **Não verificado com contas reais:** Vídeo, Design, Busca, Notificações, celular físico.

## Bugs encontrados e corrigidos
- A grade de botões de função saía em 2 colunas no lugar de 4 (regra de estilo mais fraca que a existente). Corrigido.
- Texto "As 1 personalização". Corrigido.

## Limitações / pendências
1. **Trava por módulo no banco** (etapa 5): não feita. Ver "RLS / segurança".
2. **Editor de padrões ("Funções e acessos") e criação de usuário pela tela nova:** escritos e carregam sem erro, mas não cliquei neles no teste. Só a edição de conta foi exercitada.
3. **`salvar_preset` e criar/alterar conta no servidor publicado:** não chamei com sessão real de administrador.
4. **Aparência:** não consegui capturar a tela (o navegador de teste não repinta); conferi só medidas.
5. **Efeito imediato:** a mudança de acesso vale no próximo carregamento da página da pessoa afetada. Não há atualização em tempo real.
6. **Design:** elegibilidade para receber peças não foi revista.
7. **Tela "Novo usuário":** o seletor de cinco perfis virou "Equipe B7 / Cliente" + administrador + função. As funções extras saíram da tela.

## Resultado final
Cada pessoa da equipe tem uma função principal, administrador é um privilégio separado, e o que cada um abre vem do padrão da função com exceções individuais — resolvido num lugar só, no banco, e respeitado por menu, rotas, Painel e "Criar". O modelo antigo continua por baixo como espelho, o que manteve intactas todas as regras do banco. Falta a trava por módulo no próprio banco para o controle deixar de ser só de tela.
