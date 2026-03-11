import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.guardianangel.alert',
    appName: 'AI & GPS Monitor',
    webDir: 'dist',
    server: {
        androidScheme: 'http',
    },
    plugins: {
        SplashScreen: {
            launchShowDuration: 2000,
            backgroundColor: '#0f172a',
            showSpinner: false,
        },
    },
};

export default config;
