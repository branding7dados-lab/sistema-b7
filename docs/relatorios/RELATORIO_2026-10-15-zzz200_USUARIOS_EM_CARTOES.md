# Relatório — Usuários em cartões e fora da barra lateral

**Versão:** `2026-10-15-zzz200` · **Cache:** `roteiros-b7-v403`
**Pedido:** "166, 175, tira os usuarios e acessos da sidebar". Este pacote traz o **175** e a **saída da barra lateral**. O **166** (permissão dentro do módulo) mexe nas travas do banco: o desenho foi enviado para aprovação antes de qualquer mudança.

## Usuários e acessos repaginado (175)
- **Números no alto**, cada um filtra a lista ao tocar: na equipe, online agora, administradores, com acesso personalizado, contas que pedem atenção, no Portal.
- **Filtros** por pílula: Todas, Online, Administradores, Coordenação, Design, Vídeo, Clientes, Acesso personalizado, Pedem atenção, Desativadas (só aparecem as que têm alguém). Busca por nome ou usuário continua.
- **Um cartão por conta**: foto com ponto verde quando online, nome, @usuário, etiquetas de **Administrador**, função principal e **funções extras** (ex.: "+ Designer").
- **Mapa dos módulos**: uma barrinha por módulo — cheia quando abre, **verde** quando foi liberado a mais que o padrão da função, **tracejada vermelha** quando foi tirado do padrão; passando o mouse aparece o nome. Ao lado, "3 de 12 módulos" ou "abre tudo".
- **Alertas no próprio cartão**: "Nunca acessou", "Sem acesso há N dias" (a partir de 30), "Sem função", "Sem empresa vinculada" (cliente), "Acesso personalizado", "Conta desativada".
- Clientes mostram as empresas que acompanham e se aprovam.
- O cartão inteiro abre **Editar acesso**; o ⋯ continua com foto, senha, desativar e excluir. Nada mudou nas ações nem em quem pode fazê-las.

## Fora da barra lateral
"Usuários e acessos" saiu da lateral (Mais ferramentas) e da folha "Mais" do celular. Continua em **Configurações → Admin → Pessoas** e no **menu da conta** (foto no topo). O endereço `#/usuarios` segue funcionando.

## Banco de dados
Nenhuma mudança.

## Arquivos alterados
`js/usuarios.js` (lista nova em cartões), `styles/auth.css` (bloco `.lu4`), `js/nav.js` (item fora da lateral), `index.html` (o link antigo do molde da lateral), `sw.js`, `js/auth.js`.

## Novidades
Nenhuma entrada: a tela e o item da lateral são só do administrador.

## Testes executados
Aba local sem login, com 7 contas fictícias (admin com duas funções extras, coordenador, dois designers — um com acesso personalizado —, videomaker, conta desativada e um cliente), em 1366×900:
- números: 5 na equipe, 1 online, 1 administrador, 1 personalizado, 2 pedem atenção, 1 no Portal;
- filtro "pedem atenção" mostrou o designer sem acesso há 41 dias e o cliente que nunca acessou; "acesso personalizado" mostrou só a designer com exceções;
- mapa dos módulos: a mais em verde e tirado em tracejado (captura);
- tocar no cartão abriu Editar acesso;
- em 375 px de largura, sem rolagem lateral.

## Não testado
- Com as contas reais e a sua sessão.
- Visual completo no celular (o teste sem login não monta o layout de celular inteiro).
