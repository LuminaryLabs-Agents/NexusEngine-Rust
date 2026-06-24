package dev.luminarylabs.nexusrealtime;

import android.app.Activity;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    static {
        System.loadLibrary("nexus_android_bridge");
    }

    private native String nativeInit(String sequenceJson, String manifestJson);
    private native String nativeTick(float deltaSeconds);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String project = readAsset("nexus/xr-house-demo/project.json", "{}");
        String sequence = readAsset("nexus/xr-house-demo/scene.sequence.json", "{\"id\":\"xr_house_scene\",\"type\":\"flow\",\"children\":[]}");
        String manifest = readAsset("manifests/dsk-manifest.json", "{\"schema\":\"nexus.dsk-manifest.v1\",\"kits\":[]}");
        String host = readAsset("nexus/xr-house-demo/host.adaptive.json", "{}");
        String interaction = readAsset("nexus/xr-house-demo/interaction.grab.json", "{}");
        String status = nativeInit(sequence, manifest) + "\n" + nativeTick(0.016f);
        setContentView(new HouseDemoView(this, status, project, host, interaction));
    }

    private String readAsset(String path, String fallback) {
        try (InputStream input = getAssets().open(path); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        } catch (Exception ignored) {
            return fallback;
        }
    }

    static class HouseDemoView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final String status;
        private final String project;
        private final String host;
        private final String interaction;
        private float grabX = -1.0f;
        private float grabY = -1.0f;
        private boolean grabbing = false;

        HouseDemoView(Activity activity, String status, String project, String host, String interaction) {
            super(activity);
            this.status = status;
            this.project = project;
            this.host = host;
            this.interaction = interaction;
            setFocusable(true);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            int w = getWidth();
            int h = getHeight();
            drawGradientSky(canvas, w, h);
            drawSun(canvas, w, h);
            drawGround(canvas, w, h);
            drawHouse(canvas, w, h);
            drawProps(canvas, w, h);
            drawControllerHints(canvas, w, h);
            drawHud(canvas, w, h);
            postInvalidateDelayed(16);
        }

        private void drawGradientSky(Canvas c, int w, int h) {
            paint.setShader(new LinearGradient(0, 0, 0, h * 0.72f,
                    new int[]{Color.rgb(35, 80, 180), Color.rgb(86, 150, 230), Color.rgb(255, 185, 110)},
                    new float[]{0.0f, 0.58f, 1.0f}, Shader.TileMode.CLAMP));
            c.drawRect(0, 0, w, h, paint);
            paint.setShader(null);
        }

        private void drawSun(Canvas c, int w, int h) {
            paint.setShader(new RadialGradient(w * 0.76f, h * 0.18f, h * 0.16f,
                    Color.argb(210, 255, 232, 140), Color.argb(0, 255, 232, 140), Shader.TileMode.CLAMP));
            c.drawCircle(w * 0.76f, h * 0.18f, h * 0.16f, paint);
            paint.setShader(null);
        }

        private void drawGround(Canvas c, int w, int h) {
            paint.setColor(Color.rgb(52, 132, 78));
            c.drawRect(0, h * 0.68f, w, h, paint);
            paint.setColor(Color.rgb(40, 88, 56));
            paint.setStrokeWidth(5.0f);
            for (int i = -2; i < 12; i++) {
                c.drawLine(i * w / 8.0f, h, w * 0.50f, h * 0.68f, paint);
            }
        }

        private void drawHouse(Canvas c, int w, int h) {
            float cx = w * 0.50f;
            float base = h * 0.67f;
            float hw = w * 0.18f;
            float hh = h * 0.24f;
            outlineRect(c, cx - hw, base - hh, cx + hw, base, 7.0f);
            celRect(c, cx - hw, base - hh, cx + hw, base, Color.rgb(226, 177, 112));
            Path roof = new Path();
            roof.moveTo(cx - hw * 1.16f, base - hh);
            roof.lineTo(cx, base - hh * 1.55f);
            roof.lineTo(cx + hw * 1.16f, base - hh);
            roof.close();
            outlinePath(c, roof, 8.0f);
            paint.setColor(Color.rgb(126, 58, 42));
            c.drawPath(roof, paint);
            paint.setColor(Color.argb(80, 255, 255, 255));
            c.drawPath(roof, paint);
            celRect(c, cx - hw * 0.18f, base - hh * 0.44f, cx + hw * 0.18f, base, Color.rgb(95, 58, 40));
            celRect(c, cx - hw * 0.72f, base - hh * 0.72f, cx - hw * 0.38f, base - hh * 0.42f, Color.rgb(125, 190, 220));
            celRect(c, cx + hw * 0.38f, base - hh * 0.72f, cx + hw * 0.72f, base - hh * 0.42f, Color.rgb(125, 190, 220));
        }

        private void drawProps(Canvas c, int w, int h) {
            float y = h * 0.73f;
            float cubeX = grabbing ? grabX : w * 0.35f;
            float cubeY = grabbing ? grabY : y;
            outlineRect(c, cubeX - 38, cubeY - 38, cubeX + 38, cubeY + 38, 6.0f);
            celRect(c, cubeX - 38, cubeY - 38, cubeX + 38, cubeY + 38, Color.rgb(80, 126, 235));
            paint.setColor(Color.rgb(28, 24, 24));
            c.drawCircle(w * 0.65f, y + 10, 47, paint);
            paint.setColor(Color.rgb(230, 90, 86));
            c.drawCircle(w * 0.65f, y + 10, 41, paint);
        }

        private void drawControllerHints(Canvas c, int w, int h) {
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(5.0f);
            paint.setColor(Color.argb(190, 20, 20, 24));
            c.drawLine(w * 0.18f, h * 0.84f, w * 0.35f, h * 0.73f, paint);
            c.drawLine(w * 0.82f, h * 0.84f, w * 0.65f, h * 0.73f, paint);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.argb(220, 255, 255, 255));
            c.drawCircle(w * 0.18f, h * 0.84f, 18, paint);
            c.drawCircle(w * 0.82f, h * 0.84f, 18, paint);
        }

        private void drawHud(Canvas c, int w, int h) {
            paint.setColor(Color.argb(210, 10, 14, 24));
            c.drawRoundRect(24, 22, w * 0.68f, 178, 18, 18, paint);
            paint.setColor(Color.WHITE);
            paint.setTextSize(30.0f);
            c.drawText("NexusRealtime XR House Demo", 46, 62, paint);
            paint.setTextSize(18.0f);
            c.drawText("descriptor-driven fallback; project=" + project.contains("xr-house-demo"), 46, 94, paint);
            c.drawText("adaptive host=" + host.contains("quest-openxr") + " grab kit=" + interaction.contains("blue-cube"), 46, 121, paint);
            c.drawText(status, 46, 150, paint);
        }

        private void celRect(Canvas c, float l, float t, float r, float b, int color) {
            paint.setColor(color);
            c.drawRect(l, t, r, b, paint);
            paint.setColor(Color.argb(80, 255, 255, 255));
            c.drawRect(l, t, r, t + (b - t) * 0.30f, paint);
            paint.setColor(Color.argb(70, 0, 0, 0));
            c.drawRect(l, b - (b - t) * 0.22f, r, b, paint);
        }

        private void outlineRect(Canvas c, float l, float t, float r, float b, float width) {
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(width);
            paint.setColor(Color.rgb(25, 22, 24));
            c.drawRect(l, t, r, b, paint);
            paint.setStyle(Paint.Style.FILL);
        }

        private void outlinePath(Canvas c, Path path, float width) {
            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(width);
            paint.setColor(Color.rgb(25, 22, 24));
            c.drawPath(path, paint);
            paint.setStyle(Paint.Style.FILL);
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            if (event.getActionMasked() == MotionEvent.ACTION_DOWN || event.getActionMasked() == MotionEvent.ACTION_MOVE) {
                grabbing = true;
                grabX = event.getX();
                grabY = event.getY();
                invalidate();
                return true;
            }
            if (event.getActionMasked() == MotionEvent.ACTION_UP || event.getActionMasked() == MotionEvent.ACTION_CANCEL) {
                grabbing = false;
                invalidate();
                return true;
            }
            return true;
        }
    }
}
