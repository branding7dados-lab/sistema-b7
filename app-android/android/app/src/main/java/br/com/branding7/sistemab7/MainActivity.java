package br.com.branding7.sistemab7;

import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.MimeTypeMap;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.content.FileProvider;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Collections;
import org.json.JSONObject;

/*
 * Casca Android do Sistema B7.
 *
 * O conteúdo é o site publicado (capacitor.config.json → server.url), então
 * cada publicação no main chega ao app sozinha. Aqui só fica o que o
 * WebView não faz por conta própria e o navegador faz:
 *   • salvar arquivo baixado (backup, arte, PDF, imagem) em Downloads;
 *   • imprimir (window.print não existe no WebView);
 *   • "voltar" do aparelho: volta uma tela; na primeira, minimiza.
 * O lado do site está em js/app-nativo.js, que só age quando acha
 * window.B7Nativo. A ponte só existe para o endereço do sistema (ORIGEM):
 * um iframe de fora (YouTube, Drive) não a enxerga.
 */
public class MainActivity extends BridgeActivity {

    static final String ORIGEM = "https://branding7dados-lab.github.io";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge == null) return;

        WebView web = bridge.getWebView();
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            Nativo nativo = new Nativo(this, web);
            WebViewCompat.addWebMessageListener(web, "B7Nativo", Collections.singleton(ORIGEM),
                (view, msg, origem, principal, resposta) -> nativo.receber(msg, resposta));
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) web.goBack();
                else moveTaskToBack(true);
            }
        });
    }

    static class Nativo {
        private final MainActivity act;
        private final WebView web;

        Nativo(MainActivity act, WebView web) {
            this.act = act;
            this.web = web;
        }

        /* mensagens do site: {"acao": "...", ...}; responde {"id", "ok"} */
        void receber(WebMessageCompat msg, JavaScriptReplyProxy resposta) {
            String id = "";
            boolean ok = false;
            try {
                JSONObject m = new JSONObject(msg.getData());
                id = m.optString("id");
                switch (m.optString("acao")) {
                    case "versao":
                        ok = true;
                        break;
                    case "salvar":
                        ok = salvar(m.optString("base64"), m.optString("nome"), m.optString("tipo"));
                        break;
                    case "imprimir":
                        imprimir(m.optString("titulo"));
                        ok = true;
                        break;
                    case "abrirFora":
                        abrirFora(m.optString("url"));
                        ok = true;
                        break;
                }
            } catch (Exception e) {
                ok = false;
            }
            try {
                JSONObject r = new JSONObject();
                r.put("id", id);
                r.put("ok", ok);
                r.put("versao", BuildConfig.VERSION_NAME);
                resposta.postMessage(r.toString());
            } catch (Exception e) {
                /* página já saiu */
            }
        }

        /* conteúdo em base64 (sem o prefixo data:) → Downloads, e abre */
        boolean salvar(String base64, String nome, String tipo) {
            try {
                byte[] dados = Base64.decode(base64, Base64.DEFAULT);
                String arquivo = nomeSeguro(nome, tipo);
                String mime = (tipo == null || tipo.isEmpty()) ? adivinharTipo(arquivo) : tipo;
                Uri uri = gravar(act, dados, arquivo, mime);
                act.runOnUiThread(() -> {
                    Toast.makeText(act, "Salvo em Downloads: " + arquivo, Toast.LENGTH_LONG).show();
                    abrir(uri, mime);
                });
                return true;
            } catch (Exception e) {
                act.runOnUiThread(() -> Toast.makeText(act, "Não foi possível salvar o arquivo.", Toast.LENGTH_LONG).show());
                return false;
            }
        }

        void imprimir(String titulo) {
            act.runOnUiThread(() -> {
                PrintManager pm = (PrintManager) act.getSystemService(Context.PRINT_SERVICE);
                String nome = (titulo == null || titulo.isEmpty()) ? "Sistema B7" : titulo;
                PrintDocumentAdapter ad = web.createPrintDocumentAdapter(nome);
                pm.print(nome, ad, new PrintAttributes.Builder().build());
            });
        }

        /* link de fora do sistema (WhatsApp, Drive, Instagram) → app certo ou navegador */
        void abrirFora(String url) {
            Uri u = Uri.parse(url);
            String esquema = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
            if (!esquema.equals("https") && !esquema.equals("http") && !esquema.equals("mailto")
                && !esquema.equals("tel") && !esquema.equals("whatsapp")) return;
            act.runOnUiThread(() -> {
                try {
                    act.startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception e) {
                    Toast.makeText(act, "Nenhum app abre este link.", Toast.LENGTH_SHORT).show();
                }
            });
        }

        private void abrir(Uri uri, String mime) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, mime);
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                act.startActivity(i);
            } catch (Exception e) {
                /* sem app para esse tipo: o arquivo já está em Downloads */
            }
        }
    }

    static String nomeSeguro(String nome, String tipo) {
        String n = (nome == null ? "" : nome).replaceAll("[\\\\/:*?\"<>|\\n\\r]", "_").trim();
        if (n.isEmpty()) n = "arquivo";
        if (!n.contains(".") && tipo != null) {
            String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(tipo);
            if (ext != null) n = n + "." + ext;
        }
        return n;
    }

    static String adivinharTipo(String nome) {
        int p = nome.lastIndexOf('.');
        String t = p < 0 ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(nome.substring(p + 1).toLowerCase());
        return t == null ? "application/octet-stream" : t;
    }

    static Uri gravar(Context ctx, byte[] dados, String nome, String mime) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.Downloads.DISPLAY_NAME, nome);
            v.put(MediaStore.Downloads.MIME_TYPE, mime);
            v.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = ctx.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new Exception("sem acesso a Downloads");
            try (OutputStream os = ctx.getContentResolver().openOutputStream(uri)) {
                os.write(dados);
            }
            v.clear();
            v.put(MediaStore.Downloads.IS_PENDING, 0);
            ctx.getContentResolver().update(uri, v, null, null);
            return uri;
        }
        /* Android 7–9: pasta do próprio app, aberta por FileProvider */
        File dir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) dir = ctx.getFilesDir();
        File f = new File(dir, nome);
        try (FileOutputStream os = new FileOutputStream(f)) {
            os.write(dados);
        }
        return FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
    }
}
