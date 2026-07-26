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
    }
}
