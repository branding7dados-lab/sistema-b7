# Assinatura do Sistema B7 para Windows (certificado próprio da Branding7)

Grátis. Faz os computadores **da empresa** reconhecerem o app como "Branding7".
Fora deles, o Windows continua sem reconhecer (só certificado pago resolve).

## 1. Gerar o certificado (uma vez, no seu PC)
1. Baixe `gerar-certificado.ps1` (esta pasta) para o seu PC.
2. Botão direito no arquivo → **Executar com o PowerShell**. Crie e anote uma senha.
3. Aparecem na Área de Trabalho: `branding7-assinatura.pfx` (a chave — guarde num lugar seguro) e `branding7-pfx-base64.txt`.

## 2. Colocar no GitHub (uma vez)
GitHub → repositório **sistema-b7** → **Settings → Secrets and variables → Actions → New repository secret**:
- Nome `B7_CERT_PFX_BASE64` → valor: todo o conteúdo de `branding7-pfx-base64.txt`.
- Nome `B7_CERT_SENHA` → valor: a senha do passo 1.

Depois apague o `branding7-pfx-base64.txt` (o `.pfx` fica guardado com você).
A partir da próxima versão do app de PC, o instalador sai assinado.

## 3. Em cada computador da empresa (uma vez)
Na página de downloads do app (release **app-desktop** no GitHub) aparecem `branding7.cer` e `instalar-certificado-branding7.cmd`.
1. Baixe os dois para a mesma pasta.
2. Botão direito no `.cmd` → **Executar como administrador**.

Pronto: o Windows desse computador passa a mostrar "Branding7" como editor do Sistema B7.

Observações:
- As atualizações automáticas não dependem do certificado (a verificação de assinatura do atualizador fica desligada), então nenhum PC fica sem atualizar.
- O certificado vale 5 anos.
