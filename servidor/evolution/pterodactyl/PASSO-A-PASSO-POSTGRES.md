# Trocar o banco do Evolution para Postgres (✓✓, lida, apagada, editada)

Por quê: com MySQL, o Evolution não consegue avisar o B7 quando a mensagem é entregue/lida,
apagada ou editada (as consultas internas dele são de Postgres). Leva uns 15 minutos.

> Depois da troca é preciso **conectar o número de novo pelo QR Code** (a "sessão" do
> WhatsApp fica guardada no banco do Evolution). As conversas que já estão no B7 continuam lá.

## 1. Importar os dois eggs (Admin)
1. Painel → **Admin → Nests** → abra o nest onde está o "Evolution API (B7)".
2. **Import Egg** → arquivo `egg-postgres-b7.json` → escolha o mesmo nest → Import.
3. Abra o egg **Evolution API (B7)** → botão **Update Egg** (canto de cima) → arquivo
   `egg-evolution-b7.json` → Update.

## 2. Criar o servidor do Postgres (Admin → Servers → Create New)
- Nome: `B7 Postgres` · Dono: você
- Node: o mesmo do Evolution · **Allocation: uma porta nova livre** (ex.: 25571)
- Memória: **1024 MB** · Disco: **5120 MB** · CPU: 100%
- Nest/Egg: **Postgres 16 (B7 · Evolution)** · Docker image: a que vier
- Create Server → espera a instalação terminar → **Start**.
- No Console deve aparecer: `database system is ready to accept connections`.
- Aba **Files** → abra `.b7-senha` → copie a senha (não mande no chat).
- Aba **Network** → anote o **IP e a porta** do servidor.

## 3. Apontar o Evolution para o Postgres
1. **Admin → Servers → (servidor do Evolution) → Startup**:
   - **Startup Command**: apague o que está lá e cole o novo (Admin → Nests → Evolution API (B7)
     → aba Configuration → "Startup Command" — copie de lá).
   - Variáveis:
     - `Banco: tipo` (DATABASE_PROVIDER) = `postgresql`
     - `Banco: host` = o IP do passo 2
     - `Banco: porta` = a porta do passo 2
     - `Banco: nome` = `postgres`
     - `Banco: usuário` = `b7`
     - `Banco: senha` = a senha do `.b7-senha`
   - Save Modifications.
2. Vá no servidor do Evolution → **Restart**. A primeira partida demora ~1–2 min
   (prepara o Postgres). Pronto quando aparecer `HTTP - ON`.

## 4. Conectar o número de novo
B7 → WhatsApp → ⋮ → **Conexão do número** → Mostrar QR Code → no celular:
WhatsApp → Aparelhos conectados → Conectar aparelho.

Depois avise: eu confiro se os ✓✓ estão chegando.

## Se der errado
- Console do Evolution com `P1001` / `Can't reach database`: IP/porta errados ou o
  Postgres desligado.
- `password authentication failed`: senha copiada errada (sem espaços no fim).
- Para voltar ao MySQL: `Banco: tipo` = `mysql` e os dados do banco antigo; Restart.
