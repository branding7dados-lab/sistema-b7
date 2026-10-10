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
import android.provider.Settings;
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
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collections;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

/*
 * App Android do Sistema B7.
 *
 * As telas do sistema (index.html, js/, styles/, assets/) vão DENTRO do
 * APK: o GitHub Actions copia o site para www/ a cada publicação no main e
 * gera um APK novo. A internet só serve para o login e os dados (Supabase).
 *
 * Aqui fica o que o WebView não faz sozinho:
 *   • salvar arquivo baixado (backup, arte, PDF, imagem) em Downloads;
 *   • imprimir (window.print não existe no WebView);
 *   • "voltar" do aparelho: volta uma tela; na primeira, minimiza;
 *   • conferir se saiu APK novo e instalar por cima.
 * O lado das telas está em js/app-nativo.js. A ponte (B7Nativo) só existe
 * para as telas do próprio app (ORIGEM): um iframe de fora não a enxerga.
 */
public class MainActivity extends BridgeActivity {

    static final String ORIGEM = "https://localhost";
    static final String RELEASES = "https://api.github.com/repos/branding7dados-lab/sistema-b7/releases/latest";
    static final String APK = "https://github.com/branding7dados-lab/sistema-b7/releases/latest/download/sistema-b7.apk";
    static final String SITE_AUTH = "https://branding7dados-lab.github.io/sistema-b7/js/auth.js";

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
        private volatile boolean baixando = false;

        Nativo(MainActivity act, WebView web) {
            this.act = act;
            this.web = web;
        }

        /* mensagens das telas: {"id", "acao", ...}; responde {"id", "ok", ...} */
        void receber(WebMessageCompat msg, JavaScriptReplyProxy resposta) {
            JSONObject m;
            try {
                m = new JSONObject(msg.getData());
            } catch (Exception e) {
                return;
            }
            String id = m.optString("id");
            String acao = m.optString("acao");
            /* o que usa a internet roda fora da linha da tela */
            if (acao.equals("conferirApk") || acao.equals("versaoSite") || acao.equals("instalarApk")) {
                new Thread(() -> {
                    JSONObject r = new JSONObject();
                    boolean ok;
                    try {
                        if (acao.equals("conferirApk")) ok = conferirApk(r);
                        else if (acao.equals("versaoSite")) ok = versaoSite(r);
                        else ok = instalarApk();
                    } catch (Exception e) {
                        ok = false;
                    }
                    boolean fim = ok;
                    act.runOnUiThread(() -> responder(resposta, id, fim, r));
                }).start();
                return;
            }
            boolean ok = false;
            try {
                switch (acao) {
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
                        ok = abrirFora(m.optString("url"));
                        break;
                }
            } catch (Exception e) {
                ok = false;
            }
            responder(resposta, id, ok, new JSONObject());
        }

        private void responder(JavaScriptReplyProxy resposta, String id, boolean ok, JSONObject r) {
            try {
                r.put("id", id);
                r.put("ok", ok);
                r.put("versao", BuildConfig.VERSION_NAME);
                r.put("codigo", BuildConfig.VERSION_CODE);
                resposta.postMessage(r.toString());
            } catch (Exception e) {
                /* a tela já saiu */
            }
        }

        /* ---------------------------------------------------- APK novo */

        /* último APK publicado (tag app-v<código>) */
        private boolean conferirApk(JSONObject r) throws Exception {
            JSONObject rel = new JSONObject(new String(baixar(RELEASES), "UTF-8"));
            Matcher mt = Pattern.compile("^app-v(\\d+)$").matcher(rel.optString("tag_name"));
            if (!mt.find()) return false;
            r.put("ultimo", Integer.parseInt(mt.group(1)));
            r.put("ultimoNome", rel.optString("name"));
            return true;
        }

        /* versão que o site publicado está servindo (para "Atualizar todos") */
        private boolean versaoSite(JSONObject r) throws Exception {
            String js = new String(baixar(SITE_AUTH + "?t=" + System.currentTimeMillis()), "UTF-8");
            Matcher mt = Pattern.compile("VERSAO\\s*=\\s*'([^']+)'").matcher(js);
            if (!mt.find()) return false;
            r.put("site", mt.group(1));
            return true;
        }

        /* baixa o APK mais novo e abre o instalador do Android */
        private boolean instalarApk() throws Exception {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !act.getPackageManager().canRequestPackageInstalls()) {
                /* primeira vez: o Android pede para liberar "instalar apps" para o B7 */
                act.runOnUiThread(() -> {
                    Toast.makeText(act, "Libere \"Permitir desta fonte\" e toque em Instalar de novo.", Toast.LENGTH_LONG).show();
                    act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + act.getPackageName())));
                });
                return false;
            }
            if (baixando) return false;
            baixando = true;
            try {
                act.runOnUiThread(() -> Toast.makeText(act, "Baixando a versão nova do app…", Toast.LENGTH_SHORT).show());
                File dir = new File(act.getCacheDir(), "apk");
                dir.mkdirs();
                File f = new File(dir, "sistema-b7.apk");
                try (FileOutputStream os = new FileOutputStream(f)) {
                    os.write(baixar(APK));
                }
                Uri uri = FileProvider.getUriForFile(act, act.getPackageName() + ".fileprovider", f);
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(uri, "application/vnd.android.package-archive");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                act.runOnUiThread(() -> act.startActivity(i));
                return true;
            } finally {
                baixando = false;
            }
        }

        /* ---------------------------------------------------- arquivos */

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
        boolean abrirFora(String url) {
            Uri u = Uri.parse(url);
            String esquema = u.getScheme() == null ? "" : u.getScheme().toLowerCase();
            if (!esquema.equals("https") && !esquema.equals("http") && !esquema.equals("mailto")
                && !esquema.equals("tel") && !esquema.equals("whatsapp")) return false;
            act.runOnUiThread(() -> {
                try {
                    act.startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception e) {
                    Toast.makeText(act, "Nenhum app abre este link.", Toast.LENGTH_SHORT).show();
                }
            });
            return true;
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

    static byte[] baixar(String endereco) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(endereco).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "SistemaB7App/Android");
        c.setRequestProperty("Accept", "application/vnd.github+json, */*");
        try {
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            try (InputStream in = c.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] b = new byte[64 * 1024];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
                return out.toByteArray();
            }
        } finally {
            c.disconnect();
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
