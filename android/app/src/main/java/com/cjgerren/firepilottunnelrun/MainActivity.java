package com.cjgerren.firepilottunnelrun;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int AUDIO_PERMISSION_REQUEST_CODE = 5001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayBillingPlugin.class);
        super.onCreate(savedInstanceState);

        configureWebViewCaching();
        ensureAudioPermission();
        configureWebChromeMicPermissionBridge();
    }

    private void configureWebViewCaching() {
        if (bridge == null || bridge.getWebView() == null) return;

        bridge.getWebView().clearCache(true);

        WebSettings settings = bridge.getWebView().getSettings();
        if (settings != null) {
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        }
    }

    private void ensureAudioPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.RECORD_AUDIO },
                AUDIO_PERMISSION_REQUEST_CODE
            );
        }
    }

    private void configureWebChromeMicPermissionBridge() {
        if (bridge == null || bridge.getWebView() == null) return;

        bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    if (request == null) return;

                    boolean hasAudioPermission =
                        ContextCompat.checkSelfPermission(
                            MainActivity.this,
                            Manifest.permission.RECORD_AUDIO
                        ) == PackageManager.PERMISSION_GRANTED;

                    if (hasAudioPermission) {
                        request.grant(request.getResources());
                    } else {
                        ensureAudioPermission();
                        request.deny();
                    }
                });
            }
        });
    }
}
