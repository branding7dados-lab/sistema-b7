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
 * Mostra a saudação, os números do dia da pessoa (gravações, prazos,
 * atrasos; para a gestão, publicações e atrasos da operação), um destaque
 * (próxima gravação, alerta de atraso ou "tudo em dia") e atalhos (Painel,
 * Gravações, Ideia, Prompter). Cada bloco abre a sua tela; ↻ atualiza.
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
                    p.edit().remove("token").remove("dados").putBoolean("girando", false).apply();
                } else {
                    p.edit().putString("dados", r).putLong("quando", System.currentTimeMillis()).putBoolean("girando", false).apply();
                }
                desenhar(ctx);
                return Result.success();
            } catch (Exception e) {
                p.edit().putBoolean("girando", false).apply();
                desenhar(ctx);
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

    static final String ATUALIZAR = "b7.widget.atualizar";

    /* toque no ↻ do widget: busca de novo na hora */
    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent != null && ATUALIZAR.equals(intent.getAction())) {
            if (temChave(ctx)) prefs(ctx).edit().putBoolean("girando", true).apply();
            desenhar(ctx);
            atualizarAgora(ctx);
            return;
        }
        super.onReceive(ctx, intent);
    }

    /* mudou o tamanho: os atalhos aparecem ou somem */
    @Override
    public void onAppWidgetOptionsChanged(Context ctx, AppWidgetManager mgr, int id, android.os.Bundle novas) {
        desenhar(ctx);
    }

    static PendingIntent abrirEm(Context ctx, String link, int codigo) {
        Intent i = new Intent(ctx, MainActivity.class)
            .setAction("b7.widget." + codigo)
            .putExtra(MainActivity.EXTRA_LINK, link)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, 7700 + codigo, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static String saudacao() {
        int h = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY);
        return h < 5 ? "Boa noite" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
    }

    static void desenhar(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, WidgetHoje.class));
        if (ids.length == 0) return;
        for (int id : ids) {
            /* widget baixo (menos de ~170dp): sem a fileira de atalhos */
            int alto = mgr.getAppWidgetOptions(id).getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
            mgr.updateAppWidget(id, montar(ctx, alto == 0 || alto >= 170));
        }
    }

    static RemoteViews montar(Context ctx, boolean comBotoes) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_hoje);
        SharedPreferences p = prefs(ctx);

        v.setOnClickPendingIntent(R.id.w_raiz, abrirEm(ctx, "#/painel", 0));
        v.setOnClickPendingIntent(R.id.w_bt_hoje, abrirEm(ctx, "#/painel", 1));
        v.setOnClickPendingIntent(R.id.w_bt_grav, abrirEm(ctx, "b7:gravacoes", 2));
        v.setOnClickPendingIntent(R.id.w_bt_ideia, abrirEm(ctx, "b7:ideia", 3));
        v.setOnClickPendingIntent(R.id.w_bt_tele, abrirEm(ctx, "b7:teleprompter", 4));
        Intent atualizar = new Intent(ctx, WidgetHoje.class).setAction(ATUALIZAR);
        v.setOnClickPendingIntent(R.id.w_atualizar, PendingIntent.getBroadcast(ctx, 7790, atualizar,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        v.setViewVisibility(R.id.w_botoes, comBotoes ? View.VISIBLE : View.GONE);

        String hoje = new SimpleDateFormat("EEEE, d 'de' MMMM", new Locale("pt", "BR")).format(new Date());
        v.setTextViewText(R.id.w_data, hoje.substring(0, 1).toUpperCase(Locale.ROOT) + hoje.substring(1));
        v.setInt(R.id.w_atualizar, "setImageAlpha", p.getBoolean("girando", false) ? 90 : 255);

        String dados = p.getString("dados", null);
        if (p.getString("token", null) == null || dados == null) {
            v.setTextViewText(R.id.w_titulo, saudacao() + "!");
            v.setViewVisibility(R.id.w_blocos, View.GONE);
            v.setImageViewResource(R.id.w_destaque_ic, R.drawable.wi_casa);
            v.setTextViewText(R.id.w_proxima, p.getString("token", null) == null
                ? "Abra o app do B7 e entre na sua conta para ver o seu dia aqui."
                : "Carregando o seu dia…");
            v.setTextViewText(R.id.w_rodape, "");
            return v;
        }
        try {
            JSONObject d = new JSONObject(dados);
            v.setViewVisibility(R.id.w_blocos, View.VISIBLE);
            String nome = d.optString("nome", "");
            v.setTextViewText(R.id.w_titulo, saudacao() + (nome.isEmpty() ? "!" : ", " + nome));
            boolean gestao = d.optBoolean("gestao");
            int grav = d.optInt("gravacoes_hoje");
            int meio = gestao ? d.optInt("publicacoes_hoje") : d.optInt("prazos_hoje");
            int atras = gestao ? d.optInt("atrasados_operacao") : d.optInt("atrasados");

            bloco(v, 1, grav, "gravação hoje", "gravações hoje", R.drawable.wi_camera);
            v.setOnClickPendingIntent(R.id.w_bloco1, abrirEm(ctx, "b7:gravacoes", 5));
            if (gestao) {
                bloco(v, 2, meio, "publicação hoje", "publicações hoje", R.drawable.wi_calendario);
                v.setOnClickPendingIntent(R.id.w_bloco2, abrirEm(ctx, "#/publicacoes", 6));
                bloco(v, 3, atras, "vídeo atrasado", "vídeos atrasados", atras > 0 ? R.drawable.wi_alerta : R.drawable.wi_ok);
                v.setOnClickPendingIntent(R.id.w_bloco3, abrirEm(ctx, "#/video", 7));
            } else {
                bloco(v, 2, meio, "prazo hoje", "prazos hoje", R.drawable.wi_relogio);
                v.setOnClickPendingIntent(R.id.w_bloco2, abrirEm(ctx, "#/painel", 6));
                bloco(v, 3, atras, "atrasada", "atrasadas", atras > 0 ? R.drawable.wi_alerta : R.drawable.wi_ok);
                v.setOnClickPendingIntent(R.id.w_bloco3, abrirEm(ctx, "#/painel", 7));
            }
            /* atraso acende o terceiro bloco; sem atraso ele fica verde */
            v.setInt(R.id.w_bloco3, "setBackgroundResource", atras > 0 ? R.drawable.widget_bloco_alerta : R.drawable.widget_bloco_ok);
            v.setInt(R.id.w_ic3, "setBackgroundResource", atras > 0 ? R.drawable.widget_chip_alerta : R.drawable.widget_chip_ok);
            if (atras == 0) v.setTextViewText(R.id.w_rot3, "nada atrasado");

            JSONObject prox = d.optJSONObject("proxima");
            if (prox != null) {
                String cli = prox.optString("cliente", "");
                String quando = prox.optBoolean("hoje") ? "hoje, " + horario(prox.optString("quando")) : prox.optString("quando");
                v.setImageViewResource(R.id.w_destaque_ic, R.drawable.wi_camera);
                v.setInt(R.id.w_destaque_ic, "setBackgroundResource", R.drawable.widget_chip_azul);
                v.setTextViewText(R.id.w_proxima, "Próxima gravação · " + quando + "\n" + prox.optString("nome") + (cli.isEmpty() ? "" : " · " + cli));
            } else if (atras > 0) {
                v.setImageViewResource(R.id.w_destaque_ic, R.drawable.wi_alerta);
                v.setInt(R.id.w_destaque_ic, "setBackgroundResource", R.drawable.widget_chip_alerta);
                String coisa = gestao ? (atras == 1 ? " vídeo atrasado pede" : " vídeos atrasados pedem") : (atras == 1 ? " entrega atrasada pede" : " entregas atrasadas pedem");
                v.setTextViewText(R.id.w_proxima, atras + coisa + " atenção. Toque para ver.");
            } else {
                v.setImageViewResource(R.id.w_destaque_ic, R.drawable.wi_ok);
                v.setInt(R.id.w_destaque_ic, "setBackgroundResource", R.drawable.widget_chip_ok);
                v.setTextViewText(R.id.w_proxima, "Tudo em dia. Nenhuma gravação até amanhã.");
            }
            long quando = p.getLong("quando", 0);
            v.setTextViewText(R.id.w_rodape, quando > 0 ? new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(quando)) : "");
        } catch (Exception e) {
            v.setTextViewText(R.id.w_proxima, "Não foi possível ler o seu dia agora.");
        }
        return v;
    }

    static final int[] NUM = { R.id.w_num1, R.id.w_num2, R.id.w_num3 };
    static final int[] ROT = { R.id.w_rot1, R.id.w_rot2, R.id.w_rot3 };
    static final int[] ICO = { R.id.w_ic1, R.id.w_ic2, R.id.w_ic3 };

    static void bloco(RemoteViews v, int i, int n, String um, String varios, int icone) {
        v.setTextViewText(NUM[i - 1], String.valueOf(n));
        v.setTextViewText(ROT[i - 1], n == 1 ? um : varios);
        v.setImageViewResource(ICO[i - 1], icone);
    }

    /* "11/10 14:30" → "14:30" */
    static String horario(String quando) {
        int i = quando.indexOf(' ');
        return i > 0 ? quando.substring(i + 1) : "";
    }
}
