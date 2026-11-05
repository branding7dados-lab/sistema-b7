# =====================================================================
#  Gera o certificado de assinatura do Sistema B7 (Branding7) — RODE UMA VEZ
#  no seu PC (PowerShell normal, não precisa de administrador).
#  Ele cria 2 arquivos na Área de Trabalho:
#    - branding7-assinatura.pfx  → a CHAVE (guarde bem; não envie para ninguém)
#    - branding7-pfx-base64.txt  → o mesmo .pfx em texto, para colar no GitHub
#  Depois siga o LEIA-ME.md (passo 2).
# =====================================================================
$ErrorActionPreference = 'Stop'
$senha = Read-Host -AsSecureString "Crie uma senha para o certificado (anote, vai para o GitHub)"
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
  -Subject "CN=Branding7, O=Branding7, C=BR" -FriendlyName "Branding7 - Sistema B7" `
  -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(5) -CertStoreLocation "Cert:\CurrentUser\My"
$mesa = [Environment]::GetFolderPath('Desktop')
$pfx = Join-Path $mesa 'branding7-assinatura.pfx'
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $senha | Out-Null
[Convert]::ToBase64String([IO.File]::ReadAllBytes($pfx)) | Set-Content -NoNewline -Path (Join-Path $mesa 'branding7-pfx-base64.txt')
Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)"
Write-Host ""
Write-Host "Pronto! Na Area de Trabalho: branding7-assinatura.pfx e branding7-pfx-base64.txt" -ForegroundColor Green
Write-Host "Agora siga o passo 2 do LEIA-ME (colar no GitHub)."
