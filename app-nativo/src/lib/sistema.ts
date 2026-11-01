/* Telas que ainda não viraram nativas abrem no sistema completo, numa aba
   do navegador por cima do app (some ao fechar). */
import * as WebBrowser from 'expo-web-browser';
export const SITE = 'https://branding7dados-lab.github.io/sistema-b7/';
export function abrirNoSistema(rota: string) {
  return WebBrowser.openBrowserAsync(SITE + rota, { toolbarColor: '#2A1D6E', controlsColor: '#ffffff', showTitle: false, enableBarCollapsing: true });
}
