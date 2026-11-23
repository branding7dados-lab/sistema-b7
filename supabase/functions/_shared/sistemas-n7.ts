// =====================================================================
// QUAIS SISTEMAS DA CASA A PESSOA TEM (4.91.0) — peça pura.
// Espelha a regra da Central do Núcleo 7 (src/lib/sistemasCasa.ts de lá):
//   • super admin abre todos;
//   • a N7 Gestão vem liberada para toda a equipe (só sai se marcar false);
//   • os outros só com liberação explícita em Usuários
//     (app_users.screen_permissions.sistemas = { b7: true, ... }).
// Se a regra de lá mudar, mude aqui também.
// =====================================================================

export const SISTEMAS_N7 = ['gestao', 'disparos', 'connectsev', 'turbic', 'b7'] as const;
export type SistemaN7 = typeof SISTEMAS_N7[number];
const LIBERADO_DE_INICIO: SistemaN7[] = ['gestao'];

export function sistemasDe(u: { is_active?: boolean | null; is_super_admin?: boolean | null; screen_permissions?: unknown } | null): SistemaN7[] {
  if (!u || u.is_active === false) return [];
  if (u.is_super_admin === true) return [...SISTEMAS_N7];
  const sp = u.screen_permissions && typeof u.screen_permissions === 'object' ? u.screen_permissions as Record<string, unknown> : {};
  const s = sp.sistemas && typeof sp.sistemas === 'object' ? sp.sistemas as Record<string, unknown> : {};
  return SISTEMAS_N7.filter(id => typeof s[id] === 'boolean' ? s[id] === true : LIBERADO_DE_INICIO.includes(id));
}
