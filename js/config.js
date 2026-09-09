/* =====================================================================
   CONFIGURAÇÃO DO SUPABASE — já preenchida com o projeto da B7.

   Onde esses valores foram tirados: Supabase → projeto → Project
   Settings → API (Project URL e a chave publishable/anon).

   A chave abaixo é pública por natureza: ela vai para o navegador de
   qualquer pessoa que abrir o site, e é assim que tem que ser. O que
   nunca pode entrar aqui é a service_role ou qualquer chave marcada
   como secreta.

   Atenção à URL: sem barra no final, sem /rest/v1, sem nada depois do
   .co. Barra sobrando faz o Supabase responder "Invalid path specified
   in request URL". (O sistema já limpa isso sozinho, mas o certo é
   deixar limpo aqui.)
   ===================================================================== */

window.B7_CONFIG = {
  SUPABASE_URL: 'https://sfdjstnrwoaaaayydahw.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_rIPIwtTl4A3jgtztG4mWSQ_jwVv-Wuu'
};
