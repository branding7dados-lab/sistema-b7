package br.com.branding7.sistemab7;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.graphics.drawable.IconCompat;
import java.util.HashMap;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/*
 * zzz297 — aviso de conversa igual ao do WhatsApp.
 *
 * A função b7-push manda só os DADOS (foto e nome de quem mandou, as
 * mensagens ainda não lidas e uma assinatura). Este app desenha o aviso no
 * estilo de conversa do Android: foto da pessoa, as mensagens empilhadas e
 * os botões Responder (escreve ali mesmo), Marcar como lida e Silenciar.
 * Os botões falam direto com a b7-push (AcaoConversa), sem abrir o B7: a
 * assinatura vale só para esta pessoa e esta conversa, por 7 dias.
 */
public class AvisoConversa {

    static final String CANAL = "conversas";
    static final String TAG = "conversa";
    static final String CHAVE_RESPOSTA = "b7_resposta";
    static final String SUPABASE = "https://rartcafydsaocdzshqcx.supabase.co";
    /* chave pública do site (a mesma de js/config.js): não é segredo */
    static final String CHAVE_PUBLICA = "sb_publishable_N9Ha9Gwmh-jJsXaI5oY7Lw_dY4XAb8e";

    /* fotos já baixadas (cada aviso não precisa baixar de novo) */
    private static final Map<String, Bitmap> FOTOS = new HashMap<>();

    static int numero(String conversa) { return conversa == null ? 0 : conversa.hashCode(); }

    static void criarCanal(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel c = new NotificationChannel(CANAL, "Conversas do B7", NotificationManager.IMPORTANCE_HIGH);
        c.setDescription("Mensagens das conversas com a equipe");
        c.enableVibration(true);
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(c);
    }

    /* roda fora da linha da tela (baixa as fotos) */
    static void mostrar(Context ctx, String json, String link) {
        try {
            JSONObject c = new JSONObject(json);
            String id = c.optString("id");
            if (id.isEmpty()) return;
            /* a pessoa está com esta conversa aberta na frente: a própria tela mostra */
            if (MainActivity.naFrente && id.equals(MainActivity.conversaAberta)) return;
            criarCanal(ctx);
            boolean grupo = c.optBoolean("grupo");
            String nome = c.optString("nome", "Conversa");
            JSONArray msgs = c.optJSONArray("mensagens");
            if (msgs == null || msgs.length() == 0) return;

            Person eu = new Person.Builder().setName("Você").setKey("eu").build();
            NotificationCompat.MessagingStyle estilo = new NotificationCompat.MessagingStyle(eu);
            if (grupo) estilo.setConversationTitle(nome).setGroupConversation(true);
            Bitmap ultimaFoto = null;
            String ultimoNome = nome, ultimoTexto = "";
            for (int i = 0; i < msgs.length(); i++) {
                JSONObject m = msgs.getJSONObject(i);
                String quem = m.optString("n", "Equipe");
                Bitmap foto = foto(m.optString("f"));
                Person.Builder pb = new Person.Builder().setName(quem).setKey(quem);
                if (foto != null) pb.setIcon(IconCompat.createWithBitmap(foto));
                estilo.addMessage(m.optString("t"), m.optLong("em", System.currentTimeMillis()), pb.build());
                ultimaFoto = foto; ultimoNome = quem; ultimoTexto = m.optString("t");
            }

            int num = numero(id);
            String destino = (link == null || link.isEmpty()) ? "#/conversa/" + id : link;
            NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, CANAL)
                .setSmallIcon(R.drawable.ic_notificacao)
                .setColor(Color.parseColor("#D63384"))
                .setStyle(estilo)
                .setContentTitle(grupo ? nome : ultimoNome)
                .setContentText(ultimoTexto)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setOnlyAlertOnce(false)
                .setAutoCancel(true)
                .setContentIntent(abrir(ctx, destino, num));
            if (ultimaFoto != null && !grupo) n.setLargeIcon(ultimaFoto);

            /* Responder: o campo abre ali mesmo, como no WhatsApp */
            RemoteInput campo = new RemoteInput.Builder(CHAVE_RESPOSTA).setLabel("Mensagem").build();
            NotificationCompat.Action responder = new NotificationCompat.Action.Builder(0, "Responder",
                    acao(ctx, "responder", c, num, true))
                .addRemoteInput(campo)
                .setAllowGeneratedReplies(true)
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
                .setShowsUserInterface(false)
                .build();
            NotificationCompat.Action lida = new NotificationCompat.Action.Builder(0, "Marcar como lida",
                    acao(ctx, "lida", c, num, false))
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
                .setShowsUserInterface(false)
                .build();
            NotificationCompat.Action silenciar = new NotificationCompat.Action.Builder(0, "Silenciar",
                    acao(ctx, "silenciar", c, num, false))
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MUTE)
                .setShowsUserInterface(false)
                .build();
            n.addAction(responder).addAction(lida).addAction(silenciar);

            NotificationManagerCompat.from(ctx).notify(TAG, num, n.build());
        } catch (SecurityException e) {
            /* sem permissão de notificação: o sino do app já mostra */
        } catch (Exception e) {
            /* dados inválidos: sem aviso (o sino do app continua com ele) */
        }
    }

    static void tirar(Context ctx, String conversa) {
        try { NotificationManagerCompat.from(ctx).cancel(TAG, numero(conversa)); } catch (Exception e) { /* nada */ }
    }

    /* não deu (sem internet, aviso vencido): avisa e deixa abrir a conversa */
    static void falhou(Context ctx, String conversa, String texto) {
        try {
            criarCanal(ctx);
            int num = numero(conversa);
            NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, CANAL)
                .setSmallIcon(R.drawable.ic_notificacao)
                .setColor(Color.parseColor("#D63384"))
                .setContentTitle("Não deu para enviar")
                .setContentText(texto)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(texto))
                .setAutoCancel(true)
                .setContentIntent(abrir(ctx, "#/conversa/" + conversa, num));
            NotificationManagerCompat.from(ctx).notify(TAG, num, n.build());
        } catch (SecurityException e) { /* nada */ }
    }

    static PendingIntent abrir(Context ctx, String link, int num) {
        Intent i = new Intent(ctx, MainActivity.class)
            .setAction("b7.conversa.abrir." + num)
            .putExtra(MainActivity.EXTRA_LINK, link)
            .putExtra(MainActivity.EXTRA_ID, "")
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(ctx, num, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    static PendingIntent acao(Context ctx, String qual, JSONObject c, int num, boolean comCampo) {
        Intent i = new Intent(ctx, AcaoConversa.class)
            .setAction("b7.conversa." + qual + "." + num)
            .putExtra("acao", qual)
            .putExtra("conversa", c.optString("id"))
            .putExtra("perfil", c.optString("perfil"))
            .putExtra("exp", c.optLong("exp"))
            .putExtra("ass", c.optString("ass"));
        /* o campo de resposta precisa de um PendingIntent "mutável" (o Android escreve o texto nele) */
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (comCampo
            ? (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0)
            : PendingIntent.FLAG_IMMUTABLE);
        int extra = "responder".equals(qual) ? 1 : "lida".equals(qual) ? 2 : 3;
        return PendingIntent.getBroadcast(ctx, num * 4 + extra, i, flags);
    }

    /* foto redonda (só https, até 3 MB) */
    static Bitmap foto(String endereco) {
        if (endereco == null || !endereco.startsWith("https://")) return null;
        synchronized (FOTOS) { if (FOTOS.containsKey(endereco)) return FOTOS.get(endereco); }
        Bitmap b = MainActivity.imagemDe(endereco);
        Bitmap r = b == null ? null : redonda(b);
        synchronized (FOTOS) { if (FOTOS.size() > 40) FOTOS.clear(); FOTOS.put(endereco, r); }
        return r;
    }

    static Bitmap redonda(Bitmap b) {
        int lado = Math.min(b.getWidth(), b.getHeight());
        int tam = Math.min(lado, 256);
        Bitmap saida = Bitmap.createBitmap(tam, tam, Bitmap.Config.ARGB_8888);
        Canvas tela = new Canvas(saida);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        tela.drawCircle(tam / 2f, tam / 2f, tam / 2f, p);
        p.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        int x = (b.getWidth() - lado) / 2, y = (b.getHeight() - lado) / 2;
        tela.drawBitmap(b, new Rect(x, y, x + lado, y + lado), new Rect(0, 0, tam, tam), p);
        return saida;
    }
}
