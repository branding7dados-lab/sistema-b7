package br.com.branding7.sistemab7;

import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/*
 * zzz297 — recebe as mensagens do Firebase no lugar do serviço do plugin
 * (AndroidManifest troca um pelo outro). Mensagem de conversa vem só com
 * DADOS e quem desenha é o app (AvisoConversa), com o app aberto ou
 * fechado. Todo o resto segue igual: vai para o plugin do Capacitor.
 */
public class MensagensB7 extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage msg) {
        Map<String, String> d = msg.getData();
        if (d != null && "conversa".equals(d.get("kind")) && d.get("conversa") != null) {
            AvisoConversa.mostrar(this, d.get("conversa"), d.get("link"));
            return;
        }
        super.onMessageReceived(msg);
    }
}
