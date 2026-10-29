package br.com.branding7.sistemab7;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;
import androidx.core.app.RemoteInput;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/*
 * zzz297 — os botões do aviso de conversa (AvisoConversa): Responder,
 * Marcar como lida e Silenciar. Funcionam com o app fechado: mandam para a
 * b7-push a assinatura que veio no aviso, e ela faz no banco como se fosse
 * a própria pessoa (só aquela conversa).
 */
public class AcaoConversa extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        final String acao = intent.getStringExtra("acao");
        final String conversa = intent.getStringExtra("conversa");
        if (acao == null || conversa == null) return;
        String texto = null;
        if ("responder".equals(acao)) {
            Bundle r = RemoteInput.getResultsFromIntent(intent);
            CharSequence cs = r == null ? null : r.getCharSequence(AvisoConversa.CHAVE_RESPOSTA);
            texto = cs == null ? "" : cs.toString().trim();
            if (texto.isEmpty()) { AvisoConversa.tirar(ctx, conversa); return; }
        }
        final String resposta = texto;
        final Context app = ctx.getApplicationContext();
        final PendingResult pendente = goAsync();
        new Thread(() -> {
            boolean ok = false;
            try {
                JSONObject a = new JSONObject()
                    .put("acao", acao).put("conversa", conversa)
                    .put("perfil", intent.getStringExtra("perfil"))
                    .put("exp", intent.getLongExtra("exp", 0))
                    .put("ass", intent.getStringExtra("ass"));
                if (resposta != null) a.put("texto", resposta);
                ok = enviar(new JSONObject().put("conversa_acao", a).toString());
            } catch (Exception e) {
                ok = false;
            }
            if (ok) {
                AvisoConversa.tirar(app, conversa);
                if ("silenciar".equals(acao)) avisar(app, "Conversa silenciada por 8 horas");
            } else if ("responder".equals(acao)) {
                AvisoConversa.falhou(app, conversa, "Sua resposta não foi enviada. Toque para abrir a conversa e tentar de novo.");
            } else {
                avisar(app, "Não deu agora. Abra a conversa no B7.");
            }
            pendente.finish();
        }).start();
    }

    static boolean enviar(String corpo) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(AvisoConversa.SUPABASE + "/functions/v1/b7-push").openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("apikey", AvisoConversa.CHAVE_PUBLICA);
            try (OutputStream o = c.getOutputStream()) { o.write(corpo.getBytes(StandardCharsets.UTF_8)); }
            return c.getResponseCode() == 200;
        } catch (Exception e) {
            return false;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    static void avisar(Context ctx, String texto) {
        new Handler(Looper.getMainLooper()).post(() -> Toast.makeText(ctx, texto, Toast.LENGTH_SHORT).show());
    }
}
