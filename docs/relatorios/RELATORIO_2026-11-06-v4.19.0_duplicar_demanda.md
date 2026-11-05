# v4.19.0 — Duplicar demanda de vídeo

- Onde: menu do botão direito (Kanban/Lista, uma demanda selecionada, quem pode operar) e botão "Duplicar" no topo da demanda.
- Janela: título (padrão "<título> (cópia)"), código (opcional), quantas cópias (1–10; com mais de uma, título e código ganham 2, 3…), e escolhas: manter responsável, manter prazo, vincular os mesmos roteiros, copiar "Sobre o vídeo".
- Sempre copia: cliente, competência, gravação, pacote e prioridade. Nunca copia: situação (nasce Pendente), versões, comentários, conclusão (grupo/Drive), link do material e histórico.
- Usa as mesmas RPCs de criar (`video_criar_demanda`) e vincular roteiros (`video_definir_roteiros`), então as regras e o histórico do banco valem igual.
- Testado com dados simulados: 3 cópias com títulos numerados, responsável e prazo mantidos.
