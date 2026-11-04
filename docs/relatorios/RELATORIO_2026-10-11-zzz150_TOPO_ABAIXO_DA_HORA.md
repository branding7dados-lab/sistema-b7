# Relatório — app Android: topo abaixo da hora (zzz150, 11/10)

Print do Kevin (zzz148): o topo do sistema ficava por baixo da hora e da bateria.

**Causa:** a zzz147 dava o espaço das barras na janela do Android (`decorView`).
No S25 FE a janela ignorou esse espaço, e o sistema continuou desenhado por baixo
das barras. Como a página tinha sido avisada de que não havia barra, também não
se afastava dela.

**Correção:** o espaço vai na moldura em volta do WebView. É o mesmo ponto que o
próprio Capacitor usa quando afasta o conteúdo das barras. As faixas atrás das
barras continuam pintadas com a cor da tela.

**Testes:**
- APK montado. `testes/` ok.
- Não foi possível conferir num Android simulado a tempo: aqui ele roda sem
  aceleração e leva quase uma hora para ligar.
- A conferência é no S25 FE do Kevin.

Versão `2026-10-11-zzz150`, cache `v355`.
