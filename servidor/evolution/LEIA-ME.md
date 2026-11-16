# Evolution API (WhatsApp) — piloto do Sistema B7

Servidor do WhatsApp para a futura **Central de Conversas B7** (lista, conversa e envio
dentro do sistema, no padrão B7, no PC, navegador e Android).

> Aviso: o Evolution não é oficial do WhatsApp. Há risco de bloqueio do número.
> O piloto usa um número secundário; o principal só entra se o piloto for bem.

## Onde roda
Na máquina (node) do Pterodactyl, **ao lado** dele, em Docker:
- API em `127.0.0.1:8095` (não usa 8080/2022 do Wings, nem 80/443 do painel);
- Postgres e Redis próprios numa rede interna;
- publicada com HTTPS pelo Nginx que já existe, num subdomínio novo.

## Instalação (uma vez)
1. No DNS, crie um subdomínio apontando para o IP da máquina — ex.: `wa.branding7.com.br`.
2. Na máquina, como root:
   ```bash
   git clone --depth 1 https://github.com/branding7dados-lab/sistema-b7.git /opt/b7-repo
   mkdir -p /opt/b7-evolution && cp /opt/b7-repo/servidor/evolution/* /opt/b7-evolution/
   cd /opt/b7-evolution && bash instalar.sh wa.branding7.com.br
   ```
   (Se o repositório for privado e o clone pedir senha, copie a pasta `servidor/evolution`
   para a máquina pelo SFTP/WinSCP e rode só a última linha.)
3. O script mostra **EVOLUTION_URL** e **EVOLUTION_API_KEY**. Cole os dois no Supabase:
   *Project → Edge Functions → Secrets*. Não mande a chave no chat.

## Comandos úteis (em /opt/b7-evolution)
- ver se está de pé: `docker compose ps`
- ver o registro: `docker compose logs api --tail 80`
- reiniciar: `docker compose restart api`
- atualizar a versão: trocar a tag em `docker-compose.yml` e `docker compose up -d`
- parar tudo: `docker compose down` (os dados ficam nos volumes)

## Backup
Os dados ficam nos volumes `b7-evolution_postgres` e `b7-evolution_instances`
(a sessão do WhatsApp). Perder `instances` = ler o QR Code de novo.
