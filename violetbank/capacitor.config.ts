import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.violetbank.demo',
  appName: 'VBanque',
  webDir: 'dist-android',
  android: {
    // Android 15 impose l'affichage bord à bord : les marges système sont gérées par le WebView.
    adjustMarginsForEdgeToEdge: 'force',
    backgroundColor: '#101014',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#4C32B8',
      showSpinner: false,
      androidScaleType: 'CENTER',
      splashFullScreen: false,
      splashImmersive: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#4C32B8',
      overlaysWebView: false,
    },
  },
};

export default config;
