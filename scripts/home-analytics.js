// Keep the home page's initial render ahead of third-party analytics work.
(() => {
  if (window.__lisardHomeAnalyticsScheduled) return;
  window.__lisardHomeAnalyticsScheduled = true;

  const measurementId = 'G-PH35Q4YGM6';
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  // Queue the normal automatic page_view with the original referral context.
  // Other scripts can also use gtag before the Google library has downloaded.
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    page_location: window.location.href,
    page_referrer: document.referrer,
    page_title: document.title,
  });

  let started = false;
  let scheduled = false;
  let frameHandle;
  let idleHandle;
  let fallbackHandle;

  function start() {
    if (started) return;
    started = true;
    window.clearTimeout(fallbackHandle);
    if (frameHandle !== undefined && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(frameHandle);
    }
    if (idleHandle !== undefined && window.cancelIdleCallback) {
      window.cancelIdleCallback(idleHandle);
    }
    window.removeEventListener('load', schedule);
    window.removeEventListener('pagehide', start);
    document.removeEventListener('visibilitychange', onVisibilityChange);

    const google = document.createElement('script');
    google.id = 'home-google-analytics';
    google.async = true;
    google.fetchPriority = 'low';
    google.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(google);

    // Reuse the site's tracker so the Metricool account hash stays in one place.
    if (!document.getElementById('metricool-tracker')) {
      const metricool = document.createElement('script');
      metricool.id = 'home-metricool-loader';
      metricool.async = true;
      metricool.fetchPriority = 'low';
      metricool.src = '/scripts/metricool.js';
      document.head.appendChild(metricool);
    }
  }

  function scheduleIdle() {
    if (started) return;
    if (window.requestIdleCallback) {
      idleHandle = window.requestIdleCallback(start, { timeout: 1500 });
    }
  }

  function schedule() {
    if (scheduled || started) return;
    scheduled = true;
    // This deadline starts at load, even if animation frames are suspended in a
    // background tab. Normal visits never need a click or scroll to be measured.
    fallbackHandle = window.setTimeout(start, 1500);
    if (window.requestAnimationFrame) {
      // load alone does not mean the page has painted. Give the browser a paint
      // opportunity between two frames before requesting idle analytics work.
      frameHandle = window.requestAnimationFrame(() => {
        if (started) return;
        frameHandle = window.requestAnimationFrame(() => {
          frameHandle = undefined;
          scheduleIdle();
        });
      });
    } else {
      scheduleIdle();
    }
  }

  function onVisibilityChange() {
    // Best effort for short visits; unloading can still interrupt the download.
    if (document.visibilityState === 'hidden') start();
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', start);
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });
})();
