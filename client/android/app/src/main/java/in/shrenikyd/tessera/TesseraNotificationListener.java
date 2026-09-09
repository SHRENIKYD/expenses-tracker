package in.shrenikyd.tessera;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/**
 * Bank alerts as they appear in the notification shade.
 *
 * The same job as the SMS receiver and a better-behaved one: reading
 * notifications is not a restricted permission, so a sideloaded build can be
 * granted it without unlocking anything, and it catches alerts posted by bank
 * apps as well as by SMS.
 *
 * Like the SMS side, this keeps nothing and sends nothing. It hands the title
 * and the text straight to the plugin, which passes them to the web layer,
 * where the reading and the decision happen.
 */
public class TesseraNotificationListener extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification posted) {
        if (posted == null) return;

        Notification notification = posted.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence text = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (text == null) text = extras.getCharSequence(Notification.EXTRA_TEXT);
        if (text == null) return;

        SmsPlugin.deliverNotification(
            posted.getPackageName(),
            title == null ? "" : title.toString(),
            text.toString(),
            posted.getPostTime()
        );
    }
}
