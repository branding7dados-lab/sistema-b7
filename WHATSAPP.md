# Avisos por WhatsApp — como ligar

O B7 já sabe enviar. Falta só dizer ao servidor **qual serviço usar**, colando as chaves dele nos segredos do Supabase. Enquanto isso não for feito, nada é enviado e nada quebra.

> As chaves nunca entram no código, no GitHub, no navegador nem em conversa. Só nos **Secrets** das Edge Functions do Supabase.

## Antes de começar
- **Use um número só para isso** (um chip separado). Serviços não oficiais contrariam os termos do WhatsApp e o número conectado pode ser bloqueado. Não conecte o seu número pessoal nem o principal da agência.
- O texto de cada aviso passa pelo serviço escolhido.

## Opção A — Z-API (pago, mais simples)
1. Crie a conta em z-api.io e uma **instância**.
2. Conecte o WhatsApp do número separado lendo o QR code no painel da Z-API.
3. No painel, copie: **ID da instância**, **Token da instância** e o **Client-Token** (Segurança → Token de segurança da conta).
4. No Supabase: **Project Settings → Edge Functions → Secrets → Add new secret**, crie os três:
   - `ZAPI_INSTANCE_ID`
   - `ZAPI_TOKEN`
   - `ZAPI_CLIENT_TOKEN`

## Opção B — Evolution API (servidor próprio)
1. Tenha a Evolution API (v2) rodando num endereço **https**.
2. Crie uma instância e conecte o WhatsApp do número separado pelo QR code.
3. No Supabase, crie os três segredos:
   - `EVOLUTION_URL` — o endereço, ex.: `https://evo.suaempresa.com.br` (sem barra no final)
   - `EVOLUTION_API_KEY` — a chave da API
   - `EVOLUTION_INSTANCE` — o nome da instância

Se os dois conjuntos existirem, vale a Z-API.

## Depois de colar os segredos
1. No B7: **Configurações → Admin → Integrações → Avisos por WhatsApp** deve mostrar **Ligado**.
2. Em **Usuários e acessos → Editar acesso**, preencha o **WhatsApp** de cada pessoa da equipe (DDD + número).
3. Volte em Configurações e toque em **Avisos por WhatsApp** para enviar um teste para o seu próprio número.

## O que é enviado
Só os avisos importantes, só para a equipe (cliente do Portal não recebe):
- trabalho atribuído a você (vídeo, design, gravação);
- prazo para amanhã, atrasado, atrasado crítico;
- correção ou ajuste pedido;
- decisão do cliente (aprovou, recusou, pediu ajustes);
- gravação remarcada ou cancelada, e os lembretes de 24 h e 1 h da gravação.

O resto continua só no sino e no push. Se a pessoa desligou um tipo de aviso em Perfil → Avisos, ele também não vai para o WhatsApp.

## Para desligar
- **Uma pessoa:** apague o WhatsApp dela em Editar acesso.
- **Tudo:** apague os segredos no Supabase.

## Endereço do link (opcional)
O aviso termina com um link para a tela certa do B7. Se o app mudar de endereço, crie o segredo `B7_SITE_URL` com o novo endereço.
