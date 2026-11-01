/* As cores da B7 (as mesmas do site, em styles/global.css) */
import { useColorScheme } from 'react-native';

const claro = {
  fundo: '#F5F3FA', card: '#FFFFFF', borda: 'rgba(30,18,70,0.08)', ink: '#17112E', ink2: '#3D3557', ink3: '#6E6788', ink4: '#9A94AF',
  acento: '#C2187A', acentoSuave: 'rgba(194,24,122,0.10)', ok: '#13804B', okSuave: 'rgba(19,128,75,0.10)',
  erro: '#D02B4C', erroSuave: 'rgba(208,43,76,0.10)', ambar: '#B26A00', ambarSuave: 'rgba(214,138,0,0.12)', suave: '#EFECF6',
};
const escuro: typeof claro = {
  fundo: '#0F0B1D', card: '#1A1430', borda: 'rgba(255,255,255,0.08)', ink: '#F4F1FB', ink2: '#D6D0E8', ink3: '#A49DBD', ink4: '#7A7394',
  acento: '#F05BAE', acentoSuave: 'rgba(240,91,174,0.16)', ok: '#3DD68C', okSuave: 'rgba(61,214,140,0.14)',
  erro: '#FF6B87', erroSuave: 'rgba(255,107,135,0.14)', ambar: '#FFB547', ambarSuave: 'rgba(255,181,71,0.14)', suave: '#231B3D',
};
export type Cores = typeof claro;
export const GRADIENTE = ['#29236E', '#6B2490', '#B01E82'] as const;
export function useCores(): Cores { return useColorScheme() === 'dark' ? escuro : claro; }
