// Metricool web analytics. Keep the account hash in one place for the whole site.
(() => {
  if (document.getElementById('metricool-tracker')) return;

  const script = document.createElement('script');
  script.id = 'metricool-tracker';
  script.type = 'text/javascript';
  script.src = 'https://tracker.metricool.com/resources/be.js';
  script.async = true;
  script.addEventListener('load', () => {
    window.beTracker?.t({ hash: '12410878ef0a39b76a3225fac6032d8b' });
  }, { once: true });
  document.head.appendChild(script);
})();
