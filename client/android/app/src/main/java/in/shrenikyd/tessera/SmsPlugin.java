package in.shrenikyd.tessera;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.telephony.SmsMessage;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;

/**
 * Bank alerts, read on the device.
 *
 * This hands the web layer the sender, the text and the time, and nothing else:
 * no message is stored here, none is sent anywhere, and the parsing — and the
 * decision about what becomes a transaction — happens in JavaScript where the
 * user can see it. Reading stops the moment `stop` is called or the app is
 * destroyed.
 */
@CapacitorPlugin(
    name = "Sms",
    permissions = {
        @Permission(alias = SmsPlugin.SMS, strings = { Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS })
    }
)
public class SmsPlugin extends Plugin {

    static final String SMS = "sms";
    private static final String RECEIVED = "smsReceived";

    private BroadcastReceiver receiver;

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", getPermissionState(SMS) == com.getcapacitor.PermissionState.GRANTED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (getPermissionState(SMS) == com.getcapacitor.PermissionState.GRANTED) {
            checkPermission(call);
            return;
        }
        requestPermissionForAlias(SMS, call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        checkPermission(call);
    }

    /** Start listening. Messages arrive as `smsReceived` events. */
    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState(SMS) != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Permission to read messages has not been given.");
            return;
        }
        if (receiver != null) {
            call.resolve();
            return;
        }

        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                SmsMessage[] messages = android.provider.Telephony.Sms.Intents.getMessagesFromIntent(intent);
                if (messages == null) return;

                // A long alert arrives in parts that have to be joined before it
                // can be read; the parts share a sender and a timestamp.
                StringBuilder body = new StringBuilder();
                String sender = null;
                long at = System.currentTimeMillis();
                for (SmsMessage message : messages) {
                    if (message == null) continue;
                    if (sender == null) sender = message.getOriginatingAddress();
                    at = message.getTimestampMillis();
                    body.append(message.getMessageBody());
                }

                JSObject event = new JSObject();
                event.put("sender", sender == null ? "" : sender);
                event.put("body", body.toString());
                event.put("at", at);
                notifyListeners(RECEIVED, event);
            }
        };

        IntentFilter filter = new IntentFilter("android.provider.Telephony.SMS_RECEIVED");
        filter.setPriority(999);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        unregister();
        call.resolve();
    }

    /**
     * The inbox, for catching up on what arrived while the app was closed.
     * Returns the raw messages of the last `days` days, newest first.
     */
    @PluginMethod
    public void recent(PluginCall call) throws JSONException {
        if (getPermissionState(SMS) != com.getcapacitor.PermissionState.GRANTED) {
            call.reject("Permission to read messages has not been given.");
            return;
        }

        int days = call.getInt("days", 7);
        long since = System.currentTimeMillis() - (long) days * 24L * 60L * 60L * 1000L;

        JSArray messages = new JSArray();
        Cursor cursor = getContext().getContentResolver().query(
            Uri.parse("content://sms/inbox"),
            new String[] { "address", "body", "date" },
            "date >= ?",
            new String[] { String.valueOf(since) },
            "date DESC"
        );

        if (cursor != null) {
            try {
                while (cursor.moveToNext()) {
                    JSObject message = new JSObject();
                    message.put("sender", cursor.getString(0));
                    message.put("body", cursor.getString(1));
                    message.put("at", cursor.getLong(2));
                    messages.put(message);
                }
            } finally {
                cursor.close();
            }
        }

        JSObject result = new JSObject();
        result.put("messages", messages);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        unregister();
    }

    private void unregister() {
        if (receiver == null) return;
        try {
            getContext().unregisterReceiver(receiver);
        } catch (IllegalArgumentException ignored) {
            // already gone
        }
        receiver = null;
    }
}
