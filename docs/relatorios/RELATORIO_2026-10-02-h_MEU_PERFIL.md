# Relatório 2026-10-02-h — Meu perfil em abas

Só front-end (`js/perfil.js`, `styles/auth.css`). Sem migration. As ações, as validações e as chamadas ao servidor são as mesmas; mudou a organização e a apresentação.

## Resumo da atualização

- O Meu perfil deixou de ser uma coluna única e longa e passou a ter **três abas: Conta, Segurança e Notificações**.
- Topo (quem é você), abas e rodapé ficam fixos; só o miolo rola.
- Senha com **mostrar/ocultar** e **requisitos conferidos enquanto digita**.
- Notificações com **uma frase de estado** ("Este aparelho recebe avisos") no lugar da tabela técnica, que ficou recolhida em "Detalhes deste aparelho".

## O que estava ruim

- Tudo na mesma rolagem: foto, nome, três campos de senha, tabela do aparelho, três interruptores, teste e os grupos de avisos. Para ajustar um aviso era preciso passar por tudo.
- Os campos de senha, de uso raro, ocupavam o meio da tela o tempo todo.
- A tabela "Neste aparelho" (aparelho, permissão, push, som, último teste) vinha antes dos interruptores e respondia de forma técnica a uma pergunta simples.
- "Preferência salva" aparecia num ponto fixo que, na rolagem, ficava fora da vista.
- Havia um erro de marcação: o bloco da foto estava dentro do bloco do nome.

## O que mudou

### Estrutura

- **Topo:** avatar maior, nome, usuário, papel e um × para fechar.
- **Abas:** Conta · Segurança · Notificações. O atalho do sino ("preferências") abre direto em Notificações.
- **Rodapé fixo:** "Sair da conta" à esquerda, "Fechar" à direita.
- Altura estável: trocar de aba não faz a janela pular de tamanho.

### Conta

- **Foto:** mesma área de escolher/arrastar, com "Salvar foto" e "Remover foto".
- **Nome:** campo e botão na mesma linha. O botão só acende quando o nome muda; Enter salva.
- **Definido pela Branding7:** usuário e perfil (e, para cliente, empresas e aprovação), só leitura.

### Segurança

- Três campos, cada um com o botão de olho para conferir o que foi digitado.
- Lista de requisitos que vai marcando: 10 caracteres ou mais, pelo menos uma letra, pelo menos um número, as duas senhas novas iguais.
- As regras de validação e a exigência da senha atual não mudaram.

### Notificações

- **Estado em uma frase**, com cor: recebe avisos (verde), push desativado (âmbar), bloqueado no navegador (vermelho) ou push indisponível (neutro).
- Os três interruptores (push, som, aviso do navegador) e o teste, como antes.
- **Detalhes deste aparelho** recolhido: a tabela técnica e a versão do service worker.
- **O que te avisa:** os grupos por função, como antes.
- "Preferência salva" aparece numa pílula que acompanha a rolagem.

## Arquivos

- `js/perfil.js`: marcação em abas, `irPara`, botão do nome, olho e requisitos da senha, resumo do aparelho.
- `styles/auth.css`: bloco "Meu perfil em abas" (classe `.pf-modal`).
- `js/auth.js` versão `2026-10-02-h`; `sw.js` cache `v135`.

## Testes realizados

Página de teste local, com servidor e notificações simulados (apagada depois), no navegador embutido:

- Abre na aba Conta; com o atalho de notificações, abre em Notificações.
- Nome: botão apagado sem mudança, acende ao mudar, salva, atualiza o nome no topo e volta a apagar.
- Senha: requisitos marcam conforme digita; olho mostra e oculta; sem senha atual, avisa; com tudo certo, chama a troca, limpa os campos e zera os requisitos.
- Notificações: frase de estado certa; desligar um aviso atualiza a contagem do grupo e mostra "Preferência salva"; desligar e religar o push muda a frase; teste de notificação responde.
- Capturas conferidas em 800 px (as três abas) e 390 px (Conta): sem corte, sem rolagem lateral, rodapé fixo.
- Sem erro no console.

Depois das capturas, renomeei a classe de escopo do CSS novo (`.modal-perfil` → `.pf-modal`) para não afetar um outro modal antigo que usa `.modal-perfil`. É uma troca mecânica, mas **não refiz as capturas depois dela**.

## O que NÃO foi testado

- Dentro do B7 logado: salvar nome, foto e senha de verdade.
- Envio e remoção de foto (nem na simulação).
- Push real neste perfil (ativar, desativar, teste chegando no aparelho).
- Perfil de cliente (linhas de empresas e aprovação) e de coordenador.
- Modo escuro.
- Celular de verdade.
