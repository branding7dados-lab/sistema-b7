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
# Abertura do Android 12+: tela de 288dp, só o círculo central de 192dp aparece.
# O símbolo cabe nesse círculo (diagonal ≈ 2976 px): viewport 4800, escala 1.
gravar('drawable/b7_abertura_simbolo.xml', vetor(288, 4800, 1.0, inicial=True))
anim = []
def alvo(nome, props):
    anim.append('<target android:name="%s"><aapt:attr name="android:animation"><set>%s</set></aapt:attr></target>' % (nome, props))
def obj(prop, de, ate, dur, atraso=0, interp='@android:interpolator/fast_out_slow_in'):
    return ('<objectAnimator android:propertyName="%s" android:valueFrom="%s" android:valueTo="%s" android:duration="%d" android:startOffset="%d" android:valueType="floatType" android:interpolator="%s"/>' %
            (prop, de, ate, dur, atraso, interp))
OVER = '@android:interpolator/overshoot'
alvo('g_bulbo', obj('scaleX', 0.82, 1, 520) + obj('scaleY', 0.82, 1, 520))
alvo('bulbo', obj('fillAlpha', 0, 1, 380))
for i in range(len(base)):
    alvo('g_base%d' % i, obj('translateY', 160, 0, 360, 120 + i * 70))
    alvo('base%d' % i, obj('fillAlpha', 0, 1, 300, 120 + i * 70))
for i in range(len(bolhas)):
    # as bolhas "sobem" da maior (junto do bulbo) para a menor, uma atrás da outra
    atraso = 340 + (len(bolhas) - 1 - i) * 75
    alvo('g_bolha%d' % i, obj('scaleX', 0, 1, 340, atraso, OVER) + obj('scaleY', 0, 1, 340, atraso, OVER))
gravar('drawable/b7_abertura_animada.xml',
       '<animated-vector %s android:drawable="@drawable/b7_abertura_simbolo">%s</animated-vector>' % (NS, ''.join(anim)))

# Ícone temático (Android 13+): uma cor só, o sistema pinta. Área segura de 66dp em 108dp.
gravar('drawable/ic_launcher_monocromatico.xml', vetor(108, 4800, 1.0, cor='#FFFFFFFF'))

# Marca "Branding7" no rodapé da abertura (até 200×80dp)
tw, th = txt['w'], txt['h']
paths = ''.join('<path android:fillType="evenOdd" android:fillColor="#B3FFFFFF" android:pathData="%s"/>' % p['d'] for p in txt['partes'])
gravar('drawable/b7_abertura_marca.xml',
       '<vector %s android:width="200dp" android:height="80dp" android:viewportWidth="%d" android:viewportHeight="%d">'
       '<group android:translateX="%.1f" android:translateY="%.1f" android:scaleX="0.62" android:scaleY="0.62">%s</group></vector>' % (
           NS, tw, int(tw * 0.4), tw * 0.19, (tw * 0.4 - th * 0.62) / 2, paths))
print('bolhas', len(bolhas), 'base', len(base))
# Android 11 e anteriores mostram o desenho parado: a versão final, sem animação
gravar('drawable/b7_abertura_estatica.xml', vetor(288, 4800, 1.0))
