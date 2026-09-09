package in.shrenikyd.tessera;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Plugins that live in this app rather than in a package have to be
        // registered before the bridge starts.
        registerPlugin(SmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
