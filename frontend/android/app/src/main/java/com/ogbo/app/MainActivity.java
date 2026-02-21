package com.ogbo.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().setWebViewClient(new BridgeWebViewClient(getBridge()) {

            // Android API 24+ 需要覆盖此重载
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleCustomScheme(request.getUrl().toString());
            }

            // 旧版兼容
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleCustomScheme(url);
            }

            private boolean handleCustomScheme(String url) {
                if (url == null) return false;
                // 排除标准协议和 Capacitor 内部协议（含 blob:、data:）
                if (url.startsWith("http://")
                        || url.startsWith("https://")
                        || url.startsWith("javascript:")
                        || url.startsWith("capacitor://")
                        || url.startsWith("blob:")
                        || url.startsWith("data:")) {
                    return false; // 由 WebView 正常处理
                }
                // 其他自定义 scheme（tpoutside://, metamask://, okex://, wc:// 等）
                // 通过 Android Intent 系统打开对应 App
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    // 对应 App 未安装时静默忽略（AppKit 会展示 fallback）
                }
                return true; // 已由 Intent 处理，WebView 不再处理
            }
        });
    }
}
