# Contorna uma imagem (PNG com transparência) em vetores, peça por peça.
# Uso: python3 tracar.py ../../assets/brand/originais/symbol-color.png simbolo.json
# (pip install potracer scipy pillow)
import sys, json
import numpy as np, potrace
from PIL import Image
from scipy import ndimage
im = Image.open(sys.argv[1]).convert('RGBA')
a = np.array(im)[:,:,3] > 128
H, W = a.shape
lab, n = ndimage.label(a)
partes = []
for i in range(1, n+1):
    m = lab == i
    ys, xs = np.where(m)
    if len(xs) < 200: continue
    bmp = potrace.Bitmap(~m)
    path = bmp.trace(turdsize=10, alphamax=1.0, opticurve=True, opttolerance=0.2)
    d = []
    for c in path:
        s = c.start_point; d.append('M%.1f,%.1f' % (s.x, s.y))
        for seg in c:
            if seg.is_corner:
                d.append('L%.1f,%.1f L%.1f,%.1f' % (seg.c.x, seg.c.y, seg.end_point.x, seg.end_point.y))
            else:
                d.append('C%.1f,%.1f %.1f,%.1f %.1f,%.1f' % (seg.c1.x, seg.c1.y, seg.c2.x, seg.c2.y, seg.end_point.x, seg.end_point.y))
        d.append('Z')
    partes.append({'area': int(m.sum()), 'x0': int(xs.min()), 'x1': int(xs.max()), 'y0': int(ys.min()), 'y1': int(ys.max()), 'd': ' '.join(d)})
json.dump({'w': W, 'h': H, 'partes': partes}, open(sys.argv[2], 'w'))
for p in partes: print(p['area'], p['x0'], p['y0'], p['x1'], p['y1'], len(p['d']))
