package dev.luminarylabs.nexusrealtime;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String TAG = "NexusQuestDemo";
    private static final String QUEST_APP_URL = "file:///android_asset/nexus/quest-cube-demo/index.html";

    static {
        System.loadLibrary("nexus_android_bridge");
    }

    private native String nativeInit(String sequenceJson, String manifestJson);
    private native String nativeTick(float deltaSeconds);
    private native String nativeStartOpenXr();
    private native String nativeOnResume();
    private native String nativeOnPause();
    private native String nativeShutdown();

    private WebView webView;
    private String initStatus = "native init pending";
    private String xrStatus = "native xr pending";
    private boolean rightGripPressed = false;
    private boolean resetPressed = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String sequence = readAsset(
                "nexus/quest-cube-demo/scene.sequence.json",
                "{\"id\":\"quest_cube_scene\",\"type\":\"flow\",\"children\":[]}"
        );
        String manifest = readAsset(
                "manifests/dsk-manifest.json",
                "{\"schema\":\"nexus.dsk-manifest.v1\",\"kits\":[]}"
        );
        initStatus = nativeInit(sequence, manifest);
        xrStatus = nativeStartOpenXr();
        Log.i(TAG, "initStatus=" + initStatus + " xrStatus=" + xrStatus);

        webView = createWebView();
        setContentView(webView);
        webView.loadUrl(QUEST_APP_URL);
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private WebView createWebView() {
        WebView view = new WebView(this);
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        view.setFocusable(true);
        view.setFocusableInTouchMode(true);
        view.addJavascriptInterface(new NativeBridge(), "NexusNative");
        view.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.i(TAG, consoleMessage.message());
                return true;
            }
        });
        return view;
    }

    @Override
    protected void onResume() {
        super.onResume();
        String status = nativeOnResume();
        Log.i(TAG, status);
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        Log.i(TAG, nativeOnPause());
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        Log.i(TAG, nativeShutdown());
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public boolean onGenericMotionEvent(MotionEvent event) {
        if ((event.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK
                && event.getAction() == MotionEvent.ACTION_MOVE) {
            InputDevice device = event.getDevice();
            float leftX = centeredAxis(event, device, MotionEvent.AXIS_X);
            float leftY = centeredAxis(event, device, MotionEvent.AXIS_Y);
            float rightX = centeredAxis(event, device, MotionEvent.AXIS_Z);
            float rightY = centeredAxis(event, device, MotionEvent.AXIS_RZ);
            float rightTrigger = rawAxis(event, MotionEvent.AXIS_RTRIGGER);
            float rightBrake = rawAxis(event, MotionEvent.AXIS_BRAKE);
            boolean grip = rightGripPressed || rightTrigger > 0.45f || rightBrake > 0.45f;
            injectHostInput(leftX, leftY, rightX, rightY, grip, resetPressed);
            resetPressed = false;
            return true;
        }
        return super.onGenericMotionEvent(event);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (isResetKey(keyCode)) {
            resetPressed = true;
            injectButton("reset", true);
            return true;
        }
        if (isGripKey(keyCode)) {
            rightGripPressed = true;
            injectButton("rightGrip", true);
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (isResetKey(keyCode)) {
            resetPressed = false;
            injectButton("reset", false);
            return true;
        }
        if (isGripKey(keyCode)) {
            rightGripPressed = false;
            injectButton("rightGrip", false);
            return true;
        }
        return super.onKeyUp(keyCode, event);
    }

    private boolean isResetKey(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_BUTTON_A
                || keyCode == KeyEvent.KEYCODE_BUTTON_START
                || keyCode == KeyEvent.KEYCODE_R;
    }

    private boolean isGripKey(int keyCode) {
        return keyCode == KeyEvent.KEYCODE_BUTTON_R1
                || keyCode == KeyEvent.KEYCODE_BUTTON_R2
                || keyCode == KeyEvent.KEYCODE_BUTTON_THUMBR;
    }

    private float rawAxis(MotionEvent event, int axis) {
        return event.getAxisValue(axis);
    }

    private float centeredAxis(MotionEvent event, InputDevice device, int axis) {
        if (device == null) {
            return rawAxis(event, axis);
        }
        InputDevice.MotionRange range = device.getMotionRange(axis, event.getSource());
        float value = rawAxis(event, axis);
        float flat = range == null ? 0.08f : range.getFlat();
        return Math.abs(value) > flat ? value : 0.0f;
    }

    private void injectHostInput(float leftX, float leftY, float rightX, float rightY, boolean grip, boolean reset) {
        String script = String.format(Locale.US,
                "window.NexusQuestInput&&window.NexusQuestInput.setHostInput({leftStick:[%.4f,%.4f],rightAim:[%.4f,%.4f],rightGrip:%s,reset:%s,source:'android-host'});",
                leftX, leftY, rightX, rightY, grip ? "true" : "false", reset ? "true" : "false");
        evaluate(script);
    }

    private void injectButton(String button, boolean pressed) {
        String script = String.format(Locale.US,
                "window.NexusQuestInput&&window.NexusQuestInput.setButton('%s',%s);",
                button, pressed ? "true" : "false");
        evaluate(script);
    }

    private void evaluate(String script) {
        if (webView != null) {
            webView.evaluateJavascript(script, null);
        }
    }

    private String readAsset(String path, String fallback) {
        try (InputStream input = getAssets().open(path); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (Exception error) {
            Log.w(TAG, "asset fallback for " + path + ": " + error.getMessage());
            return fallback;
        }
    }

    final class NativeBridge {
        @JavascriptInterface
        public String initStatus() {
            return initStatus;
        }

        @JavascriptInterface
        public String openXrStatus() {
            return xrStatus;
        }

        @JavascriptInterface
        public String startOpenXr() {
            xrStatus = nativeStartOpenXr();
            Log.i(TAG, xrStatus);
            return xrStatus;
        }

        @JavascriptInterface
        public String tick(float deltaSeconds) {
            return nativeTick(deltaSeconds);
        }

        @JavascriptInterface
        public void log(String message) {
            Log.i(TAG, message);
        }
    }
}
