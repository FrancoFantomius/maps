// maps PWA Service Worker Registration Module - js/pwa.js

export function initPWA() {
    if ('serviceWorker' in navigator) {
        // Automatically reload client when new Service Worker takes control (new release shipped)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });

        navigator.serviceWorker.register('/sw.js', { scope: '/' })
            .then((registration) => {
                console.log('[PWA] Service Worker registered, scope:', registration.scope);
            })
            .catch((error) => {
                console.error('[PWA] Service Worker registration failed:', error);
            });
    }
}
