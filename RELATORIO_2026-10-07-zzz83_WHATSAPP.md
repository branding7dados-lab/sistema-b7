# Relatório — Avisos por WhatsApp

**Versão:** `2026-10-07-zzz83` · **Cache:** `roteiros-b7-v288`
**Pedido:** "queria por esses avisos no whatsapp".
**Escolhas do Kevin:** serviço não oficial (Z-API ou Evolution) · cada pessoa no privado · só os avisos importantes.

## Situação
**O B7 está pronto para enviar, mas ainda não envia nada**: falta o Kevin contratar/instalar o serviço e colar as chaves nos segredos do Supabase. O passo a passo está em `WHATSAPP.md`. Enquanto isso, nada muda no sistema.

## Como funciona
O WhatsApp entrou como mais um canal dos avisos que já existem (o mesmo caminho do push): quando o banco cria um aviso para alguém, o servidor confere e manda a mensagem.

Vai para o WhatsApp quando **tudo** isto é verdade:
- o aviso é de um tipo importante (lista abaixo);
- quem recebe é da equipe e está com a conta ativa (cliente do Portal não recebe);
- a pessoa tem WhatsApp cadastrado;
- a pessoa não desligou aquele tipo de aviso em Perfil → Avisos.

Não depende de o push estar ligado nem de ter aparelho inscrito.

**Avisos importantes:** trabalho atribuído (vídeo, design, gravação) · prazo para amanhã, atrasado e atrasado crítico · correção ou ajuste pedido · decisão do cliente (aprovou, recusou, pediu ajustes) · gravação remarcada ou cancelada · lembretes de 24 h e 1 h da gravação.

**Formato da mensagem:** título em negrito, cliente e texto do aviso, e um link que abre a tela certa do B7.

## O que mudou nas telas
- **Usuários e acessos → Editar acesso:** campo **WhatsApp** (só para a equipe). Na lista, quem tem número ganha a etiqueta "WhatsApp".
- **Configurações → Admin → Integrações:** linha **Avisos por WhatsApp** com Ligado/Desligado, quantas pessoas têm número e, quando ligado, um toque envia um teste para o número do próprio administrador.

## Banco de dados
`migration_whatsapp.sql` (aplicada). Só acréscimo:
- tabela `perfil_contatos` (o número de cada pessoa). **Sem nenhuma política para o navegador**: só o servidor lê e grava. O número não fica em `perfis`, que a equipe consegue ler;
- duas colunas em `notificacoes` (`whatsapp_status`, `whatsapp_em`) para registrar o envio.

## Servidor
- `b7-push` (publicada): entrega também por WhatsApp, em paralelo ao push; ações novas de situação e teste, só para administrador.
- `b7-auth` (publicada): grava o número ao editar a conta (só administrador) e devolve os números na listagem do administrador.
- `_shared/whatsapp.ts` (novo): os dois serviços e a lista de avisos importantes.

Segredos (nomes): `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` **ou** `EVOLUTION_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`. Opcional: `B7_SITE_URL`. Nenhuma chave está no código, no banco ou no navegador. O registro do servidor não guarda número nem texto.

## Riscos que o Kevin precisa conhecer
- **Bloqueio do número:** serviço não oficial contraria os termos do WhatsApp. Usar um número só para isso, nunca o pessoal nem o principal da agência.
- **Privacidade:** o texto de cada aviso (título, nome do cliente, mensagem) passa pelo serviço escolhido.
- **Custo:** Z-API é mensalidade; Evolution exige servidor próprio.

## Arquivos
Novos: `supabase/functions/_shared/whatsapp.ts`, `migration_whatsapp.sql`, `WHATSAPP.md`.
Alterados: `supabase/functions/b7-push/index.ts`, `supabase/functions/b7-auth/index.ts`, `js/database.js`, `js/usuarios.js`, `js/dashboard.js`, `styles/auth.css`, `styles/dashboard.css`, `js/auth.js`, `sw.js`.

## Testes executados
**Banco** (transação desfeita ao final): número inválido é recusado; pela API ninguém lê nem grava a tabela de contatos — nem administrador, nem o dono, nem anônimo.

**Telas** (app local, sessão simulada, servidor substituído por exemplos):
- lista mostra a etiqueta "WhatsApp" em quem tem número;
- Editar acesso mostra o número com máscara, envia o que foi digitado, e esconde o campo para conta de cliente;
- Configurações mostra "Desligado" sem serviço e "Ligado · 3 pessoas com número" com serviço; o teste mostra o motivo quando não envia.

**Servidor** (funções publicadas): `b7-push` continua recusando webhook sem segredo e responde 401 ao pedido de situação sem sessão; `b7-auth` responde 401 sem sessão. As duas carregaram o código novo.

## NÃO testado (importante)
- **Nenhuma mensagem de WhatsApp foi enviada.** Não há serviço configurado, então o envio pela Z-API e pela Evolution está escrito conforme a documentação de cada uma, sem prova real. O primeiro teste é o botão em Configurações depois de colar os segredos.
- Gravar o número de verdade pela tela (servidor real) e um aviso real disparando o WhatsApp.
- Que o push continua chegando depois desta publicação (a mudança foi feita para não interferir, mas não disparei um aviso real).

## Limitações
- O número só é cadastrado pelo administrador, em Editar acesso (não há campo em "Novo usuário" nem no Perfil da pessoa).
- Não há chave "receber no WhatsApp" por pessoa: para parar, apaga-se o número.
- Sem grupo e sem cliente do Portal nesta versão.
- Sem reenvio: se o serviço falhar, aquele aviso fica só no sino e no push.
