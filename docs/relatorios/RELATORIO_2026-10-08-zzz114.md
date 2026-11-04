# Relatório — Som de notificação: saiu o "vidro", entrou a escolha pelo ouvido

**Versão:** `2026-10-08-zzz114` · **Cache:** `roteiros-b7-v319`
**Relato:** "odiei o som da notificação".

## O que mudou
O som de "vidro" da zzz110 foi retirado. Como eu não ouço o que faço, em vez de chutar outro, o sistema agora tem **sete sons** e você escolhe ouvindo:

| Nome | Como é |
|---|---|
| **Toque** (novo padrão) | duas notas curtas e arredondadas, de madeira |
| Gota | um "ploc" que escorrega para cima |
| Três notas | três notas subindo, no jeito dos celulares |
| Sininho | uma nota só, com cauda |
| Suave | grave e macio |
| Pop | um estalo curto e seco |
| Clássico (antigo) | os dois bipes de antes da zzz110 |

**Onde:** Configurações → Aparência → Abertura (só administrador).
- **"Som de notificação"**: a lista. Escolher já toca o som.
- **"Testar som de notificação"**: toca de novo o escolhido.

## Importante: a escolha vale só no seu aparelho
A lista guarda a escolha **no navegador de quem escolheu**. Para o resto da equipe continua valendo o padrão do sistema, que nesta versão é o "Toque".

Fiz assim de propósito: para a escolha valer para todos de uma vez, eu teria que abrir uma leitura nova no banco para a equipe inteira, e isso é mexer em regra de acesso — não faço sem você pedir. **Quando você achar o som de que gosta, me diga qual é que eu o torno o padrão de todos** (é uma linha).

## Arquivos alterados
`js/notificacoes.js`, `js/dashboard.js`, `js/auth.js` (versão e manter a escolha ao sair da conta), `sw.js` (cache).

## Banco de dados
Nenhuma mudança.

## Testes executados
No app local:
- a lista aparece com os sete nomes e o padrão é "Toque";
- **renderizei os sete sons sem alto-falante** e medi cada um: todos tocam, têm volume parecido (pico entre 0,16 e 0,27) e são curtos (de 0,06 a 0,39 segundo de som audível).

## Não testado
- **Não ouvi nenhum.** Medi que tocam e que o volume é parecido; se são bonitos, só você sabe. É por isso que a escolha ficou na sua mão.
- O som chegando com uma notificação de verdade (testei só o disparo direto).
