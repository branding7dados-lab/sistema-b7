# zzz272 — Política de Privacidade e Termos de Serviço

## Pedido
Política de privacidade e termos de serviço do app, com link para colocar no Google Cloud (tela de permissão OAuth do "Entrar com Google").

## O que foi feito
- `privacidade.html` e `termos.html` (+ `legal.css`): páginas públicas, sem login, no mesmo site do Sistema. Tema claro/escuro, celular.
  - Privacidade: controlador (Branding7), dados tratados (conta, segurança, Google opcional, Google Agenda, trabalho, auditoria, notificações), finalidades e bases legais da LGPD, operadores (Supabase, GitHub Pages, Google — login, Agenda, FCM, Gemini —, Brevo), seção de **Uso Limitado** dos dados do Google (exigida pelo Google), retenção, segurança, direitos do titular (art. 18), cookies, menores, mudanças.
  - Termos: quem pode usar, conta, uso permitido, conteúdo, aprovações, IA, terceiros, disponibilidade, responsabilidade, encerramento, foro, contato.
- Links no pé da tela de login.
- `sw.js`: as duas páginas e o CSS vão direto à rede (a navegação não cai no app).

## Links
- https://branding7dados-lab.github.io/sistema-b7/privacidade.html
- https://branding7dados-lab.github.io/sistema-b7/termos.html

## Observações
- Contato: "Suporte dentro do Sistema ou canais do contrato" — não foi publicado e-mail pessoal. Se o Kevin quiser um e-mail de contato (o Google costuma pedir um no cadastro), é só informar.
- Texto-modelo: vale uma revisão por advogado (razão social e CNPJ da Branding7 também podem ser incluídos).
