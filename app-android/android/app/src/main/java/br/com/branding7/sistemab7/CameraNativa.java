package br.com.branding7.sistemab7;

/* =====================================================================
   CÂMERA NATIVA DO TELEPROMPTER (4.14.0)
   Pedido do Kevin: gravar usando tudo que o celular tem (estabilização,
   HDR, maior resolução, lentes), com o áudio puro do microfone.
   A câmera (CameraX) fica ATRÁS do WebView, que fica transparente: o
   teleprompter do sistema (caixa do texto, rolagem, controles) continua
   igual por cima. O vídeo vai direto para a galeria (Filmes/B7).
   ===================================================================== */

import android.Manifest;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.provider.MediaStore;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.DynamicRange;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.video.FallbackStrategy;
import androidx.camera.video.MediaStoreOutputOptions;
import androidx.camera.video.Quality;
import androidx.camera.video.QualitySelector;
import androidx.camera.video.Recorder;
import androidx.camera.video.Recording;
import androidx.camera.video.VideoCapabilities;
import androidx.camera.video.VideoCapture;
import androidx.camera.video.VideoRecordEvent;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import java.util.Arrays;

class CameraNativa {
    private final MainActivity act;
    private final WebView web;
    private PreviewView tela;
    private ProcessCameraProvider provedor;
    private VideoCapture<Recorder> captura;
    private Recording gravando;
    private boolean frente = true;
    String info = "";

    CameraNativa(MainActivity act, WebView web) { this.act = act; this.web = web; }

    boolean temPermissao() {
        return ContextCompat.checkSelfPermission(act, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            && ContextCompat.checkSelfPermission(act, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }

    void pedirPermissao() {
        act.requestPermissions(new String[] { Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO }, 4140);
    }

    /* liga a câmera atrás do WebView (thread da interface) */
    void abrir(ProcessCameraProvider p, boolean daFrente) throws Exception {
        provedor = p;
        frente = daFrente;
        if (tela == null) {
            tela = new PreviewView(act);
            tela.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
            tela.setScaleType(PreviewView.ScaleType.FILL_CENTER);
            ViewGroup pai = (ViewGroup) web.getParent();
            pai.addView(tela, 0, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            web.setBackgroundColor(Color.TRANSPARENT);
        }
        ligar();
    }

    private void ligar() {
        provedor.unbindAll();
        CameraSelector sel = frente ? CameraSelector.DEFAULT_FRONT_CAMERA : CameraSelector.DEFAULT_BACK_CAMERA;
        /* maior qualidade que esta lente aguentar: 4K → Full HD → HD */
        QualitySelector q = QualitySelector.fromOrderedList(Arrays.asList(Quality.UHD, Quality.FHD, Quality.HD),
            FallbackStrategy.lowerQualityOrHigherThan(Quality.HD));
        Recorder rec = new Recorder.Builder().setQualitySelector(q).build();
        VideoCapture.Builder<Recorder> vb = new VideoCapture.Builder<>(rec);
        Preview.Builder pb = new Preview.Builder();
        boolean estab = false, hdr = false;
        try {
            VideoCapabilities cap = Recorder.getVideoCapabilities(provedor.getCameraInfo(sel));
            if (cap.isStabilizationSupported()) { vb.setVideoStabilizationEnabled(true); pb.setPreviewStabilizationEnabled(true); estab = true; }
            if (cap.getSupportedDynamicRanges().contains(DynamicRange.HLG_10_BIT)) { vb.setDynamicRange(DynamicRange.HLG_10_BIT); pb.setDynamicRange(DynamicRange.HLG_10_BIT); hdr = true; }
        } catch (Exception e) { /* aparelho sem a informação: segue no padrão */ }
        captura = vb.build();
        Preview prev = pb.build();
        prev.setSurfaceProvider(tela.getSurfaceProvider());
        try {
            provedor.bindToLifecycle(act, sel, prev, captura);
        } catch (Exception e) {
            /* combinação estabilização/HDR recusada: tenta o básico */
            captura = new VideoCapture.Builder<>(rec).build();
            prev = new Preview.Builder().build(); prev.setSurfaceProvider(tela.getSurfaceProvider());
            provedor.unbindAll(); provedor.bindToLifecycle(act, sel, prev, captura);
            estab = false; hdr = false;
        }
        info = (estab ? "estabilização" : "") + (hdr ? (estab ? " + " : "") + "HDR" : "");
    }

    void trocar() { if (provedor != null && gravando == null) { frente = !frente; ligar(); } }

    void fechar() {
        parar();
        if (provedor != null) provedor.unbindAll();
        if (tela != null) { ((ViewGroup) tela.getParent()).removeView(tela); tela = null; }
        web.setBackgroundColor(Color.parseColor("#05030A"));
    }

    /* grava direto na galeria, em Filmes/B7 */
    @SuppressWarnings("MissingPermission")
    boolean gravar(String nome) {
        if (captura == null || gravando != null) return false;
        ContentValues cv = new ContentValues();
        cv.put(MediaStore.Video.Media.DISPLAY_NAME, (nome == null || nome.isEmpty() ? "B7 teleprompter" : nome) + ".mp4");
        cv.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
        if (android.os.Build.VERSION.SDK_INT >= 29) cv.put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/B7");
        MediaStoreOutputOptions saida = new MediaStoreOutputOptions.Builder(act.getContentResolver(), MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
            .setContentValues(cv).build();
        gravando = captura.getOutput().prepareRecording(act, saida).withAudioEnabled()
            .start(ContextCompat.getMainExecutor(act), ev -> {
                if (ev instanceof VideoRecordEvent.Finalize) {
                    VideoRecordEvent.Finalize f = (VideoRecordEvent.Finalize) ev;
                    Toast.makeText(act, f.hasError() ? "Não foi possível salvar o vídeo." : "Vídeo salvo na galeria (Filmes/B7).", Toast.LENGTH_SHORT).show();
                }
            });
        return true;
    }

    void parar() { if (gravando != null) { try { gravando.stop(); } catch (Exception e) {} gravando = null; } }

    boolean aberta() { return tela != null; }
}
