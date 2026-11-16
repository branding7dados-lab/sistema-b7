# Evolution API pelo painel do Pterodactyl (sem SSH)

Tudo pelo navegador, no painel (admin). Leva uns 15 minutos.
Arquivo do egg: `egg-evolution-b7.json` (nesta pasta).

Testado aqui com o mesmo comando de início do painel e um banco MySQL/MariaDB:
instala, cria as tabelas, sobe ("Welcome to the Evolution API, it is working!",
v2.3.7), gera QR Code e recusa chave errada.

## 1. Importar o egg (uma vez)
1. **Admin → Nests → Create New**: nome `Sistema B7` → Save.
2. **Admin → Nests → Import Egg** (botão verde no topo):
   escolha o arquivo `egg-evolution-b7.json` e, em *Associated Nest*, `Sistema B7` → Import.

## 2. Criar o servidor
**Admin → Servers → Create New**
- **Server Name:** `B7 WhatsApp (Evolution)` · **Server Owner:** você
- **Node / Default Allocation:** qualquer porta livre (anote o IP:porta)
- **Database Limit:** `1` · **Allocation Limit:** `0` · **Backup Limit:** `1`
- **Memory:** `2048` MB · **Disk:** `5120` MB · **CPU:** `200` %
- **Nest:** `Sistema B7` · **Egg:** `Evolution API (Sistema B7)` · **Docker Image:** `Node 22`
- Deixe os campos *Banco* e *Endereço público* vazios por enquanto → **Create Server**.

A instalação roda sozinha (2 a 5 min): baixa o Evolution e compila.

## 3. Criar o banco
Abra o servidor (visão normal, não admin) → aba **Databases → New Database**
- nome `evolution`, *Connections from* `%` → Create.
- Clique no olho para ver a senha. Anote **Endpoint**, **Username**, **Password** e o nome
  completo do banco (algo como `s12_evolution`).

> Se a aba Databases não deixar criar banco, o painel não tem um "Database Host"
> cadastrado (Admin → Databases). Me avise: dá para usar o banco do próprio Supabase.

## 4. Preencher a aba Startup
- **Banco: host** → só o host do Endpoint (sem `:3306`)
- **Banco: porta** → `3306` (ou a do Endpoint)
- **Banco: nome / usuário / senha** → os do passo 3
- **Endereço público** → `http://IP:PORTA` do servidor (aba Network)

## 5. Ligar
Aba **Console → Start**. Quando aparecer `HTTP - ON`, abra `http://IP:PORTA` no navegador:
deve mostrar *"Welcome to the Evolution API, it is working!"*.

## 6. Chave para o Supabase
Aba **Files → `.b7-chave`** → copie o conteúdo (é a chave da API, gerada sozinha).
No Supabase (projeto do B7) → **Edge Functions → Secrets** → crie:
- `EVOLUTION_URL` = `http://IP:PORTA`
- `EVOLUTION_API_KEY` = o conteúdo de `.b7-chave`

**Não mande a chave no chat.** Depois avise o Claude: ele liga o B7 no Evolution
(QR Code dentro do sistema, mensagens chegando, Central de Conversas).

## Observações
- Sem HTTPS nesta etapa: a chave viaja sem criptografia entre o Supabase e a VPS.
  Serve para o piloto; para o número principal, colocar HTTPS (Cloudflare ou Nginx).
- Sem `ffmpeg` no container: alguns envios de áudio podem não converter. Resolve depois.
- Reiniciar o servidor não troca a chave (fica em `.b7-chave`). Apagar esse arquivo gera outra.
