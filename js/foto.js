/* =====================================================================
   FOTO DE PERFIL — escolha, corte e envio

   A pessoa escolhe um arquivo (ou arrasta). O navegador recorta ao
   quadrado central e reduz para 512×512 em JPEG: uma foto de celular de
   4 MB vira uns 60 KB, que é o que uma foto de perfil precisa. O envio
   vai pelo b7-auth, que grava no Storage com a chave de serviço — assim
   funciona antes e depois do corte do RLS, sem política de storage no
   navegador, e fica na auditoria como as demais ações de conta.
   ===================================================================== */

window.B7 = window.B7 || {};

B7.Foto = (function () {
  const esc = B7.UI.esc;
  const LADO = 512;
  const MAX_ENTRADA = 12 * 1024 * 1024;   // arquivo original
  const TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

  function lerArquivo(arquivo) {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = URL.createObjectURL(arquivo);
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Não consegui abrir essa imagem.')); };
      img.src = url;
    });
  }

  /* recorte central quadrado + redução; devolve data URL JPEG */
  async function preparar(arquivo) {
    if (!arquivo) throw new Error('Escolha uma imagem.');
    if (!TIPOS.includes(arquivo.type)) throw new Error('Use PNG, JPG, WEBP ou GIF.');
    if (arquivo.size > MAX_ENTRADA) throw new Error('A imagem passa de 12 MB. Escolha uma menor.');
    const img = await lerArquivo(arquivo);
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    if (lado < 64) throw new Error('A imagem é pequena demais (mínimo 64 px).');
    const sx = (img.naturalWidth - lado) / 2, sy = (img.naturalHeight - lado) / 2;
    const c = document.createElement('canvas');
    c.width = c.height = Math.min(LADO, lado);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';                       // PNG transparente não vira preto
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, lado, lado, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  }

  /* Monta a área de escolha dentro de um container já existente.
     Devolve { dataUrl() } — null enquanto nada foi escolhido. */
  function montar(container, opcoes) {
    opcoes = opcoes || {};
    let dataUrl = null;
    container.innerHTML =
      '<div class="foto-zona" tabindex="0">' +
        '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden>' +
        '<div class="foto-zona-tx"><b>Escolher imagem</b>' +
        '<span>ou arraste aqui · PNG, JPG ou WEBP · será recortada ao quadrado</span></div>' +
      '</div>' +
      '<div class="ajuda erro-txt"></div>';
    const zona = container.querySelector('.foto-zona');
    const input = container.querySelector('input[type=file]');
    const erro = container.querySelector('.erro-txt');

    async function receber(arquivo) {
      erro.textContent = '';
      zona.classList.add('lendo');
      try {
        dataUrl = await preparar(arquivo);
        zona.classList.add('ok');
        zona.querySelector('b').textContent = 'Imagem pronta — trocar';
        if (opcoes.aoEscolher) opcoes.aoEscolher(dataUrl);
      } catch (e) {
        dataUrl = null;
        zona.classList.remove('ok');
        erro.textContent = e.message || 'Não foi possível usar essa imagem.';
      } finally { zona.classList.remove('lendo'); }
    }

    zona.onclick = () => input.click();
    zona.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } };
    input.onchange = () => { if (input.files[0]) receber(input.files[0]); input.value = ''; };
    zona.ondragover = e => { e.preventDefault(); zona.classList.add('arrastando'); };
    zona.ondragleave = () => zona.classList.remove('arrastando');
    zona.ondrop = e => {
      e.preventDefault(); zona.classList.remove('arrastando');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) receber(f);
    };
    return { dataUrl: () => dataUrl };
  }

  return { montar, preparar };
})();
