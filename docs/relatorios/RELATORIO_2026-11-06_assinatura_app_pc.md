# App de PC — assinatura com certificado próprio da Branding7

- `desktop.yml`: assina com `CSC_LINK`/`CSC_KEY_PASSWORD` vindos dos segredos `B7_CERT_PFX_BASE64` e `B7_CERT_SENHA`; sem segredo, sai sem assinatura (aviso no log). Exporta `branding7.cer` e o `instalar-certificado-branding7.cmd` para a release app-desktop.
- `verifyUpdateCodeSignature: false`: o atualizador não exige assinatura confiável (senão PCs sem o certificado instalado parariam de atualizar).
- `app-desktop/certificado/`: `gerar-certificado.ps1` (Kevin roda uma vez; a chave nunca passa pelo chat), `instalar-certificado.cmd` (cada PC, como administrador) e `LEIA-ME.md`.
