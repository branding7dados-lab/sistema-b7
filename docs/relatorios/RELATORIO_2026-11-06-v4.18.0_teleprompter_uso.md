# v4.18.0 — Teleprompter: ler na tela, aparelho (Ulanzi RT02) ou gravar

- Tela inicial: "Como vai usar" com 3 opções (`data-uso`): tela (sem espelho), aparelho (`P.aparelho` + espelho, câmera desligada) e gravar (câmera). Substitui o interruptor "Gravar com a câmera".
- Modo aparelho libera o celular em pé (não pede para girar). O aviso de girar oferece "Usar no aparelho de teleprompter" e "Gravar em pé com a câmera".
- Controle remoto: Enter/MediaPlayPause = tocar/pausar; MediaTrackNext/Previous = próxima/anterior cena (somam-se a espaço, setas e PageUp/PageDown que já existiam).
- Testado em tela de celular (390×844): aviso em pé → modo aparelho → leitura espelhada rolando, sem erros.
- Proteção contra senhas vazadas (Supabase Auth): não dá para ligar por aqui; fica com o Kevin no painel.
