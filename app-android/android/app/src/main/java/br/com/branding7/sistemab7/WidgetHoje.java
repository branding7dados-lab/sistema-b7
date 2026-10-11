package br.com.branding7.sistemab7;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/*
 * Widget "Hoje no B7" da tela inicial.
 *
 * Mostra os números do dia da pessoa (gravações, prazos, atrasos; para a
 * gestão, publicações e atrasos da operação) e a próxima gravação. Toque
 * abre o Painel.
 *
 * Os números vêm da função widget_hoje do banco, com uma chave própria do
 * widget (widget_token_novo), só de leitura — nunca a sessão do app, que
 * seria derrubada se fosse renovada por fora. O app manda a chave ao
 * entrar na conta (js/app-nativo.js → "widgetToken") e a apaga ao sair.
 * Atualiza ao abrir o app e a cada 30 min em segundo plano (WorkManager).
 */
public class WidgetHoje extends AppWidgetProvider {

    static final String PREFS = "b7_widget";
    static final String TRABALHO = "b7_widget_hoje";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        desenhar(ctx);
        agendar(ctx);
        atualizarAgora(ctx);
    }

    @Override
    public void onDisabled(Context ctx) {
        WorkManager.getInstance(ctx).cancelUniqueWork(TRABALHO);
    }

    /* ------------------------------------------------- chave e agenda */

    static void guardarChave(Context ctx, String token, String url, String anon) {
        prefs(ctx).edit().putString("token", token).putString("url", url).putString("anon", anon).apply();
        agendar(ctx);
        atualizarAgora(ctx);
    }

    static boolean temChave(Context ctx) {
        return prefs(ctx).getString("token", null) != null;
    }

    /* saiu da conta: apaga a chave (e a revoga no banco) e mostra o convite */
    static void sair(Context ctx) {
        SharedPreferences p = prefs(ctx);
        final String token = p.getString("token", null), url = p.getString("url", null), anon = p.getString("anon", null);
        p.edit().clear().apply();
        desenhar(ctx);
        if (token != null && url != null) {
            new Thread(() -> {
                try { rpc(url, anon, "widget_token_revogar", token); } catch (Exception e) { /* sem rede: a chave expira com a próxima */ }
            }).start();
        }
    }

    static void agendar(Context ctx) {
        if (!temChave(ctx) || !temWidget(ctx)) return;
        Constraints rede = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest r = new PeriodicWorkRequest.Builder(Atualizar.class, 30, TimeUnit.MINUTES).setConstraints(rede).build();
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(TRABALHO, ExistingPeriodicWorkPolicy.KEEP, r);
    }

    static void atualizarAgora(Context ctx) {
        if (!temChave(ctx) || !temWidget(ctx)) return;
        Constraints rede = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        OneTimeWorkRequest r = new OneTimeWorkRequest.Builder(Atualizar.class).setConstraints(rede).build();
        WorkManager.getInstance(ctx).enqueueUniqueWork(TRABALHO + "_agora", ExistingWorkPolicy.REPLACE, r);
    }

    static boolean temWidget(Context ctx) {
        return AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, WidgetHoje.class)).length > 0;
    }

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* --------------------------------------------------------- busca */

    public static class Atualizar extends Worker {
        public Atualizar(Context ctx, WorkerParameters p) { super(ctx, p); }

        @Override
        public Result doWork() {
            Context ctx = getApplicationContext();
            SharedPreferences p = prefs(ctx);
            String token = p.getString("token", null), url = p.getString("url", null), anon = p.getString("anon", null);
            if (token == null || url == null) return Result.success();
            try {
                String r = rpc(url, anon, "widget_hoje", token);
                if (r == null || r.trim().equals("null")) {
                    /* chave recusada (conta saiu ou foi desativada) */
                    p.edit().remove("token").remove("dados").apply();
                } else {
                    p.edit().putString("dados", r).putLong("quando", System.currentTimeMillis()).apply();
                }
                desenhar(ctx);
                return Result.success();
            } catch (Exception e) {
                return Result.retry();
            }
        }
    }

    static String rpc(String url, String anon, String funcao, String token) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url + "/rest/v1/rpc/" + funcao).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setRequestMethod("POST");
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/json");
        /* chave pública nova (sb_publishable_…): vai só no apikey, nunca
           como Bearer — sem sessão, o banco atende como anon */
        if (anon != null) c.setRequestProperty("apikey", anon);
        try (OutputStream os = c.getOutputStream()) {
            os.write(new JSONObject().put("p_chave", token).toString().getBytes("UTF-8"));
        }
        try {
            if (c.getResponseCode() / 100 != 2) throw new Exception("HTTP " + c.getResponseCode());
            try (java.io.InputStream in = c.getInputStream(); java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
                byte[] b = new byte[8192];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
                return out.toString("UTF-8");
            }
        } finally {
            c.disconnect();
        }
    }

    /* -------------------------------------------------------- desenho */

    static void desenhar(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetHoje.class));
        if (ids.length == 0) return;
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_hoje);

        Intent abrir = new Intent(ctx, MainActivity.class)
            .setAction("b7.widget")
            .putExtra(MainActivity.EXTRA_LINK, "#/painel")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.w_raiz, PendingIntent.getActivity(ctx, 7700, abrir,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));

        v.setTextViewText(R.id.w_data, new SimpleDateFormat("EEE, d MMM", new Locale("pt", "BR")).format(new Date()));

        SharedPreferences p = prefs(ctx);
        String dados = p.getString("dados", null);
        if (p.getString("token", null) == null || dados == null) {
            v.setViewVisibility(R.id.w_blocos, View.GONE);
            v.setTextViewText(R.id.w_proxima, p.getString("token", null) == null
                ? "Abra o app do B7 e entre na sua conta para ver o seu dia aqui."
                : "Carregando o seu dia…");
            v.setTextViewText(R.id.w_rodape, "");
            mgr.updateAppWidget(ids, v);
            return;
        }
        try {
            JSONObject d = new JSONObject(dados);
            v.setViewVisibility(R.id.w_blocos, View.VISIBLE);
            String nome = d.optString("nome", "");
            v.setTextViewText(R.id.w_titulo, nome.isEmpty() ? "Hoje no B7" : "Hoje, " + nome);
            boolean gestao = d.optBoolean("gestao");
            bloco(v, R.id.w_num1, R.id.w_rot1, d.optInt("gravacoes_hoje"), "gravação hoje", "gravações hoje");
            if (gestao) {
                bloco(v, R.id.w_num2, R.id.w_rot2, d.optInt("publicacoes_hoje"), "publicação hoje", "publicações hoje");
                bloco(v, R.id.w_num3, R.id.w_rot3, d.optInt("atrasados_operacao"), "vídeo atrasado", "vídeos atrasados");
            } else {
                bloco(v, R.id.w_num2, R.id.w_rot2, d.optInt("prazos_hoje"), "prazo hoje", "prazos hoje");
                bloco(v, R.id.w_num3, R.id.w_rot3, d.optInt("atrasados"), "atrasada", "atrasadas");
            }
            JSONObject prox = d.optJSONObject("proxima");
            if (prox != null) {
                String cli = prox.optString("cliente", "");
                v.setTextViewText(R.id.w_proxima, "🎬 Próxima: " + prox.optString("nome") + (cli.isEmpty() ? "" : " · " + cli)
                    + " · " + (prox.optBoolean("hoje") ? "hoje " + horario(prox.optString("quando")) : prox.optString("quando")));
            } else {
                v.setTextViewText(R.id.w_proxima, "Nenhuma gravação marcada até amanhã.");
            }
            long quando = p.getLong("quando", 0);
            v.setTextViewText(R.id.w_rodape, quando > 0
                ? "atualizado às " + new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(quando)) + " · toque para abrir"
                : "toque para abrir");
        } catch (Exception e) {
            v.setTextViewText(R.id.w_proxima, "Não foi possível ler o seu dia agora.");
        }
        mgr.updateAppWidget(ids, v);
    }

    static void bloco(RemoteViews v, int num, int rot, int n, String um, String varios) {
        v.setTextViewText(num, String.valueOf(n));
        v.setTextViewText(rot, n == 1 ? um : varios);
    }

    /* "11/10 14:30" → "14:30" */
    static String horario(String quando) {
        int i = quando.indexOf(' ');
        return i > 0 ? quando.substring(i + 1) : "";
    }
}
