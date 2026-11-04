# Relatório zzz221 — Confirmar pelo botão do e-mail (o código continua)

## O que mudou
- O e-mail da verificação em 2 etapas ganhou um botão: **"Sou eu — confirmar entrada"** (login) ou **"Confirmar meu e-mail"** (cadastro do e-mail). O código de 6 números continua logo abaixo e continua valendo.
- O botão abre `confirmar.html`, que mostra "Entrada confirmada" / "E-mail confirmado" (ou link usado / expirado / inválido).
- **Login:** o link só *aprova*; quem entra é a tela onde a pessoa digitou a senha — ela pergunta a cada 3 s (`login_2fa_status`) e entra sozinha. Assim, abrir o link no celular libera a entrada no computador, e quem só tem o e-mail não ganha uma sessão em outro aparelho.
- **Cadastro do e-mail:** o link confirma e liga a verificação; a janela "Código por e-mail" percebe sozinha (consulta `seg_status`) e fecha.
- Segurança: o segredo do link é aleatório (32 bytes), guardado só como hash (`seguranca_codigos.link_hash`), vale 10 minutos e uma vez; vai depois do `#` (não chega a servidor nenhum na abertura da página) e a página apaga da barra assim que lê. Reenviar gera link novo.

## Banco
- Migração `seguranca_codigos_link`: colunas `link_hash` e `aprovado_em` em `seguranca_codigos`.

## Testes feitos
- `b7-auth` publicada; `email_link` com link falso → "Link inválido."; `login_2fa_status` com desafio inexistente → "expirou".
- `confirmar.html` aberta localmente com link falso: conversa com o servidor e mostra "Não deu para confirmar / Link inválido".
- Sintaxe de `js/seguranca.js` conferida.

## Não testado
- O fluxo real com e-mail de verdade (login e cadastro) depois desta publicação; abrir o link no celular com a tela no computador.
