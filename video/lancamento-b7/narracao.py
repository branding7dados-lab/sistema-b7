"""Narração do vídeo: voz sintetizada (Piper, voz pt-BR "faber", licença CC0),
cada frase posicionada no tempo exato da cena.

    pip install piper-tts
    python3 narracao.py          → saida/narracao.wav (48 kHz, mono, 64 s)

Na primeira execução a voz é baixada para saida/voz/ (~65 MB, GitHub).
Para gravar com locutor de verdade, use o mesmo roteiro e tempos de FALAS.
"""
import json, os, subprocess, sys, tarfile, urllib.request, wave
from array import array

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.join(AQUI, 'saida')
VOZ_DIR = os.path.join(SAIDA, 'voz')
MODELO = os.path.join(VOZ_DIR, 'vits-piper-pt_BR-faber-medium', 'pt_BR-faber-medium.onnx')
URL = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-pt_BR-faber-medium.tar.bz2'
DURACAO, SR = 64.0, 48000

# (início em s, texto falado, velocidade — menor = mais rápido)
# "B7" vai escrito "Bê Sete" para a voz pronunciar como se fala.
FALAS = [
    (1.00, 'Produzir conteúdo não deveria ser um caos.', .95),
    (4.40, 'Pauta aqui, calendário ali, aprovações perdidas.', .95),
    (10.45, 'Conheça o Bê Sete. Uma nova forma de operar conteúdo.', .95),
    (13.85, 'Projetos, conteúdos e etapas. Tudo conectado, em um só lugar.', .93),
    (17.95, 'Planeje a linha editorial, organize o calendário e execute.', .93),
    (21.35, 'Da ideia à gravação: roteiro, teleprompter e tudo organizado na produção.', .93),
    (26.70, 'No vídeo, cada conteúdo tem seu lugar, da ideia até a publicação.', .95),
    (32.80, 'A criação também faz parte da operação: artes, carrosséis e identidade visual.', .93),
    (38.55, 'O cliente comenta, você ajusta, e a aprovação acontece sem perder o controle.', .93),
    (44.75, 'A inteligência do Bê Sete acelera tudo: ideias, roteiros, análises e linha editorial.', .93),
    (50.65, 'E o seu cliente acompanha cada etapa, em tempo real.', .95),
    (53.80, 'Todos os módulos conectados. Uma operação completa.', .92),
    (57.00, 'Menos caos.', .8),
    (57.75, 'Mais operação.', .8),
    (58.50, 'Mais controle.', .8),
    (60.15, 'Bê Sete.', 1.0),
    (60.95, 'O sistema operacional da sua operação de conteúdo.', .97),
]


def baixar_voz():
    if os.path.exists(MODELO):
        return
    os.makedirs(VOZ_DIR, exist_ok=True)
    arq = os.path.join(VOZ_DIR, 'faber.tar.bz2')
    print('baixando voz…')
    urllib.request.urlretrieve(URL, arq)
    with tarfile.open(arq) as t:
        t.extractall(VOZ_DIR)
    os.remove(arq)


def sintetizar(texto, escala, destino):
    subprocess.run([sys.executable, '-m', 'piper', '-m', MODELO, '--length-scale', str(escala),
                    '--sentence-silence', '0.12', '-f', destino], input=texto.encode(), check=True,
                   stderr=subprocess.DEVNULL)
    # reamostra para 48 kHz
    saida = destino.replace('.wav', '-48k.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', destino, '-ar', str(SR), '-ac', '1', saida], check=True)
    with wave.open(saida) as w:
        dados = array('h', w.readframes(w.getnframes()))
    os.remove(destino); os.remove(saida)
    return dados


def main():
    baixar_voz()
    os.makedirs(SAIDA, exist_ok=True)
    trilha = array('h', bytes(int(DURACAO * SR) * 2))
    fim_anterior = 0
    relatorio = []
    for i, (inicio, texto, escala) in enumerate(FALAS):
        clip = sintetizar(texto, escala, os.path.join(SAIDA, f'_fala{i}.wav'))
        # corta o silêncio do começo para a fala cair exatamente no tempo marcado
        k = 0
        while k < len(clip) and abs(clip[k]) < 300:
            k += 1
        clip = clip[max(0, k - int(.01 * SR)):]
        s = int(inicio * SR)
        fim = inicio + len(clip) / SR
        if inicio < fim_anterior - .05:
            print(f'  ! fala {i + 1} começa antes da anterior terminar ({fim_anterior:.2f}s)')
        for j, v in enumerate(clip):
            if s + j < len(trilha):
                trilha[s + j] = max(-32768, min(32767, trilha[s + j] + v))
        fim_anterior = fim
        relatorio.append({'inicio': inicio, 'fim': round(fim, 2), 'texto': texto})
        print(f'{inicio:6.2f}–{fim:6.2f}s  {texto}')
    with wave.open(os.path.join(SAIDA, 'narracao.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(trilha.tobytes())
    with open(os.path.join(AQUI, 'roteiro-narracao.json'), 'w', encoding='utf-8') as f:
        json.dump(relatorio, f, ensure_ascii=False, indent=1)
    print('ok saida/narracao.wav')


if __name__ == '__main__':
    main()
