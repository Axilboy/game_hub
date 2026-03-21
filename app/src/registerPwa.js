/**
 * Service Worker: кэш только собранных JS/CSS/HTML (precache), без API.
 * В dev по умолчанию отключён — см. vite.config.js devOptions.
 */
export function registerPwa() {
  if (!import.meta.env.PROD) return;

  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onOfflineReady() {
          try {
            if (sessionStorage.getItem('gh_pwa_offline_hint')) return;
            sessionStorage.setItem('gh_pwa_offline_hint', '1');
            window.dispatchEvent(new CustomEvent('gh-pwa-offline-ready'));
          } catch (_) {
            window.dispatchEvent(new CustomEvent('gh-pwa-offline-ready'));
          }
        },
      });
    })
    .catch(() => {
      /* нет SW — не критично */
    });
}
