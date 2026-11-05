@echo off
:: Instala o certificado da Branding7 neste computador, para o Windows
:: reconhecer o Sistema B7 como programa da empresa. Rode como administrador
:: (botão direito > Executar como administrador), com o branding7.cer na
:: mesma pasta deste arquivo.
cd /d "%~dp0"
if not exist branding7.cer (
  echo Nao achei o arquivo branding7.cer nesta pasta.
  pause & exit /b 1
)
certutil -addstore -f Root branding7.cer && certutil -addstore -f TrustedPublisher branding7.cer
if errorlevel 1 (
  echo.
  echo Nao deu certo. Rode de novo com o botao direito ^> "Executar como administrador".
) else (
  echo.
  echo Pronto! Este computador agora reconhece o Sistema B7 como programa da Branding7.
)
pause
