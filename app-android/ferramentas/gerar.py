# Gera os desenhos da abertura e do ícone temático (res/drawable) a partir
# de simbolo.json e texto.json (saída do tracar.py). Rodar de novo só se a marca mudar.
import json, os
S = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(S, '..', 'android', 'app', 'src', 'main', 'res') + '/'
sim = json.load(open(S + '/simbolo.json')); txt = json.load(open(S + '/texto.json'))
W, H = sim['w'], sim['h']
partes = sorted(sim['partes'], key=lambda p: -p['area'])
bulbo = partes[0]
base = sorted([p for p in partes if p['y0'] > 1900], key=lambda p: p['y0'])
bolhas = sorted([p for p in partes[1:] if p['y0'] < 1900], key=lambda p: p['area'])  # da menor para a maior
NS = 'xmlns:android="http://schemas.android.com/apk/res/android" xmlns:aapt="http://schemas.android.com/aapt"'

def grad(x0, y0, x1, y1):
    return ('<aapt:attr name="android:fillColor"><gradient android:type="linear" android:startX="%d" android:startY="%d" android:endX="%d" android:endY="%d">'
            '<item android:offset="0" android:color="#FF3341D6"/><item android:offset="0.5" android:color="#FF8A2DC2"/>'
            '<item android:offset="1" android:color="#FFE0338F"/></gradient></aapt:attr>') % (x0, y0, x1, y1)

def caminho(nome, d, cor=None, alpha=None):
    fill = (' android:fillColor="%s"' % cor) if cor else ''
    a = (' android:fillAlpha="%s"' % alpha) if alpha is not None else ''
    corpo = '' if cor else grad(0, 0, W, H)
    return '<path android:name="%s" android:fillType="evenOdd" android:pathData="%s"%s%s>%s</path>' % (nome, d, fill, a, corpo)

def grupos(cor=None, inicial=False):
    """o símbolo em grupos com pivô no centro de cada peça (para a animação)"""
    out = []
    cx = lambda p: (p['x0'] + p['x1']) / 2; cy = lambda p: (p['y0'] + p['y1']) / 2
    out.append('<group android:name="g_bulbo" android:pivotX="%d" android:pivotY="%d"%s>%s</group>' % (
        cx(bulbo), bulbo['y1'], ' android:scaleX="0.82" android:scaleY="0.82"' if inicial else '', caminho('bulbo', bulbo['d'], cor, 0 if inicial else None)))
    for i, p in enumerate(bolhas):
        out.append('<group android:name="g_bolha%d" android:pivotX="%d" android:pivotY="%d"%s>%s</group>' % (
            i, cx(p), cy(p), ' android:scaleX="0" android:scaleY="0"' if inicial else '', caminho('bolha%d' % i, p['d'], cor)))
    for i, p in enumerate(base):
        out.append('<group android:name="g_base%d"%s>%s</group>' % (
            i, ' android:translateY="160"' if inicial else '', caminho('base%d' % i, p['d'], cor, 0 if inicial else None)))
    return ''.join(out)

def vetor(lado_dp, viewport, escala, cor=None, inicial=False, nome=None):
    tx = (viewport - W * escala) / 2; ty = (viewport - H * escala) / 2
    return ('<vector %s android:width="%ddp" android:height="%ddp" android:viewportWidth="%d" android:viewportHeight="%d"%s>'
            '<group android:translateX="%.1f" android:translateY="%.1f" android:scaleX="%.4f" android:scaleY="%.4f">%s</group></vector>') % (
        NS, lado_dp, lado_dp, viewport, viewport, (' android:name="%s"' % nome) if nome else '', tx, ty, escala, escala, grupos(cor, inicial))

def gravar(caminho_rel, xml):
    open(RES + caminho_rel, 'w').write('<?xml version="1.0" encoding="utf-8"?>\n' + xml + '\n')

os.makedirs(RES + 'drawable', exist_ok=True)

# Ícone temático (Android 13+): uma cor só, o sistema pinta. Área segura de 66dp em 108dp.
gravar('drawable/ic_launcher_monocromatico.xml', vetor(108, 4800, 1.0, cor='#FFFFFFFF'))

print('bolhas', len(bolhas), 'base', len(base))
