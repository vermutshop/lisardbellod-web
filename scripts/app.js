const page = document.body.dataset.page;

const formatNumber = (value) =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value || 0);

const formatDate = (value) =>
  new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(value));

const formatCompactHours = (value) => `${formatNumber(Math.round(value || 0))}h`;
const formatCurrency = (value) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value || 0);
const formatDecimal = (value, digits = 1) =>
  new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value || 0);
const COUNTER_STORAGE_KEY = "lisard_calculator_counters";

const FILTER_ORDER = ["Todos", "Coche eléctrico", "Emprende", "Local", "Comercio"];

function initNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const panel = document.querySelector("[data-nav-panel]");
  if (!toggle || !panel) return;

  const closeNav = () => {
    document.body.classList.remove("nav-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Abrir menú");
  };

  const openNav = () => {
    document.body.classList.add("nav-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Cerrar menú");
  };

  toggle.addEventListener("click", () => {
    if (document.body.classList.contains("nav-open")) {
      closeNav();
    } else {
      openNav();
    }
  });

  panel.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeNav();
  });

  document.addEventListener("click", (event) => {
    if (!document.body.classList.contains("nav-open")) return;
    if (panel.contains(event.target) || toggle.contains(event.target)) return;
    closeNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeNav();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 720) closeNav();
  });
}

function getVideoTopics(video) {
  const haystack = `${video.title} ${video.description || ""}`.toLowerCase();
  const topics = new Set();

  if (video.category === "Principal") topics.add("Coche eléctrico");
  if (video.category === "Emprendimiento") topics.add("Emprende");
  if (video.category === "Catalan") topics.add("Local");

  if (
    /comer[cç]|comercio|negocio|tienda|botiga|shop|empresa|emprend/i.test(haystack)
  ) {
    topics.add("Comercio");
  }

  return topics;
}

function initShare() {
  const toggle = document.querySelector("[data-share-toggle]");
  const popover = document.querySelector("[data-share-popover]");
  const whatsapp = document.querySelector("[data-share-whatsapp]");
  const x = document.querySelector("[data-share-x]");
  const copy = document.querySelector("[data-share-copy]");
  const feedback = document.querySelector("[data-share-feedback]");

  if (!toggle || !popover || !whatsapp || !x || !copy || !feedback) return;

  const pageUrl = window.location.href;
  const shareText = document.title;
  whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`;
  x.href = `https://x.com/intent/post?text=${encodeURIComponent(`${shareText} ${pageUrl}`)}`;

  toggle.addEventListener("click", () => {
    const isOpen = !popover.hasAttribute("hidden");
    if (isOpen) {
      popover.setAttribute("hidden", "");
      toggle.setAttribute("aria-expanded", "false");
    } else {
      popover.removeAttribute("hidden");
      toggle.setAttribute("aria-expanded", "true");
    }
  });

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      feedback.textContent = "Enlace copiado.";
    } catch {
      feedback.textContent = "No se pudo copiar el enlace.";
    }
  });

  document.addEventListener("click", (event) => {
    if (popover.hasAttribute("hidden")) return;
    if (popover.contains(event.target) || toggle.contains(event.target)) return;
    popover.setAttribute("hidden", "");
    toggle.setAttribute("aria-expanded", "false");
  });
}

function getLocalCounterState() {
  try {
    const saved = JSON.parse(localStorage.getItem(COUNTER_STORAGE_KEY) || "{}");
    const buyCar = Number.parseInt(saved.buy_car || 0, 10) || 0;
    const evSavings = Number.parseInt(saved.ev_savings || 0, 10) || 0;
    return {
      buy_car: buyCar,
      ev_savings: evSavings,
      total: buyCar + evSavings,
    };
  } catch {
    return { buy_car: 0, ev_savings: 0, total: 0 };
  }
}

function setLocalCounterState(state) {
  localStorage.setItem(
    COUNTER_STORAGE_KEY,
    JSON.stringify({
      buy_car: state.buy_car || 0,
      ev_savings: state.ev_savings || 0,
    })
  );
}

async function fetchCounterState() {
  try {
    const response = await fetch("/api/calculator-counter", { cache: "no-store" });
    if (!response.ok) throw new Error("counter_unavailable");
    return response.json();
  } catch {
    return getLocalCounterState();
  }
}

async function incrementCounter(counterKey) {
  try {
    const response = await fetch("/api/calculator-counter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ counter: counterKey }),
    });

    if (!response.ok) throw new Error("counter_unavailable");
    return response.json();
  } catch {
    const current = getLocalCounterState();
    const next = {
      ...current,
      [counterKey]: (current[counterKey] || 0) + 1,
    };
    next.total = (next.buy_car || 0) + (next.ev_savings || 0);
    setLocalCounterState(next);
    return next;
  }
}

function renderCounters(state) {
  if (!state) return;

  document.querySelectorAll("[data-counter-output]").forEach((element) => {
    const key = element.dataset.counterOutput;
    const value = key === "total" ? state.total : state[key];
    element.textContent = formatNumber(value || 0);
  });
}

async function initCounters() {
  renderCounters(await fetchCounterState());
}

function getSessionCounterKey(counterKey) {
  return `lisard_counter_signature_${counterKey}`;
}

function readSessionCounterSignature(counterKey) {
  try {
    return sessionStorage.getItem(getSessionCounterKey(counterKey));
  } catch {
    return null;
  }
}

function writeSessionCounterSignature(counterKey, value) {
  try {
    sessionStorage.setItem(getSessionCounterKey(counterKey), value);
  } catch {}
}

function createCounterTracker(counterKey, isMeaningful) {
  let timer;

  return (signature) => {
    if (!signature || !isMeaningful()) return;
    if (readSessionCounterSignature(counterKey) === signature) return;

    clearTimeout(timer);
    timer = window.setTimeout(async () => {
      if (readSessionCounterSignature(counterKey) === signature) return;
      writeSessionCounterSignature(counterKey, signature);
      renderCounters(await incrementCounter(counterKey));
    }, 1200);
  };
}

function initCalculator() {
  const form = document.querySelector("[data-calculator-form]");
  const results = document.querySelector("[data-calculator-results]");
  if (!form || !results) return;

  const feedback = results.querySelector("[data-calculator-feedback]");
  const resultTitle = document.getElementById("purchase-result-title");
  const shareButton = results.querySelector("[data-calculator-share]");
  const sharePanel = results.querySelector("[data-calculator-share-panel]");
  const shareMessage = results.querySelector("[data-calculator-message]");
  const sharePreview = results.querySelector("[data-calculator-preview]");
  const whatsappLink = results.querySelector("[data-calculator-whatsapp]");
  const emailLink = results.querySelector("[data-calculator-email]");
  const calculatorUrl = "https://www.lisardbellod.com/calculadora-compra-coche.html";
  const outputs = Object.fromEntries(
    [...results.querySelectorAll("[data-calc-output]")].map((element) => [element.dataset.calcOutput, element])
  );
  const currency = new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const money = (cents) => currency.format(cents / 100);
  const cents = (name) => Math.round(Number(form.elements[name].value) * 100);
  const trackCalculation = createCounterTracker("buy_car", () => true);
  let summary = "";

  const invalidateResult = () => {
    results.hidden = true;
    feedback.textContent = "";
    summary = "";
    sharePanel.hidden = true;
    shareButton.setAttribute("aria-expanded", "false");
    sharePreview.open = false;
    shareMessage.value = "";
    whatsappLink.removeAttribute("href");
    emailLink.removeAttribute("href");
  };

  const scrollTo = (element) => {
    element.focus({ preventScroll: true });
    element.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
      block: "start",
    });
  };

  form.addEventListener("input", invalidateResult);
  form.addEventListener("reset", () => {
    queueMicrotask(() => {
      invalidateResult();
      form.elements.downPayment.focus();
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const downPayment = cents("downPayment");
    const monthlyPayment = cents("monthlyPayment");
    const months = Number(form.elements.months.value);
    const finalPayment = cents("finalPayment");
    const cashPrice = cents("cashPrice");
    const monthlyTotal = monthlyPayment * months;
    const totalFinanced = downPayment + monthlyTotal + finalPayment;
    const difference = totalFinanced - cashPrice;

    const financeTone = difference > 0 ? "negative" : difference < 0 ? "positive" : "neutral";
    const cashTone = difference > 0 ? "positive" : difference < 0 ? "negative" : "neutral";
    for (const [name, tone] of [["finance", financeTone], ["cash", cashTone]]) {
      const badge = results.querySelector(`[data-price-badge="${name}"]`);
      badge.textContent = tone === "positive" ? "Menor coste" : tone === "negative" ? "Mayor coste" : "Mismo coste";
      badge.closest(".result-card").dataset.priceTone = tone;
    }
    results.querySelector("[data-comparison-result]").dataset.priceTone = financeTone;
    outputs.totalFinanced.textContent = money(totalFinanced);
    outputs.cashTotal.textContent = money(cashPrice);
    outputs.downPayment.textContent = money(downPayment);
    outputs.installmentLabel.textContent = `${months} mensualidades × ${money(monthlyPayment)}`;
    outputs.monthlyTotal.textContent = money(monthlyTotal);
    outputs.finalPayment.textContent = money(finalPayment);
    if (difference === 0) {
      outputs.comparison.textContent = "Financiar y pagar al contado cuestan lo mismo.";
    } else {
      const amount = document.createElement("strong");
      amount.textContent = `${money(Math.abs(difference))} ${difference > 0 ? "más" : "menos"}`;
      outputs.comparison.replaceChildren("Al financiar pagas ", amount, " que al contado.");
    }

    summary = [
      "🚗 COSTE REAL DEL COCHE",
      "",
      `💳 Financiado: ${money(totalFinanced)}`,
      `💶 Al contado: ${money(cashPrice)}`,
      "",
      `${difference > 0 ? "🔴" : difference < 0 ? "🟢" : "⚖️"} ${outputs.comparison.textContent}`,
      "",
      "DESGLOSE DE LA FINANCIACIÓN",
      `• Entrada o primer pago: ${money(downPayment)}`,
      `• ${months} mensualidades de ${money(monthlyPayment)}: ${money(monthlyTotal)}`,
      `• Cuota final: ${money(finalPayment)}`,
      "",
      "Total de los pagos introducidos.",
      "",
      "Creado en Lisard Bellod",
      calculatorUrl,
    ].join("\n");
    shareMessage.value = summary;
    whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(summary)}`;
    emailLink.href = `mailto:?subject=${encodeURIComponent("Coste real del coche · Lisard Bellod")}&body=${encodeURIComponent(summary.replace(/\n/g, "\r\n"))}`;
    feedback.textContent = "";
    results.hidden = false;
    trackCalculation(JSON.stringify({ downPayment, monthlyPayment, months, finalPayment, cashPrice }));
    scrollTo(resultTitle);
  });

  shareButton.addEventListener("click", () => {
    if (!summary) return;
    sharePanel.hidden = !sharePanel.hidden;
    shareButton.setAttribute("aria-expanded", String(!sharePanel.hidden));
    if (!sharePanel.hidden) {
      whatsappLink.focus({ preventScroll: true });
      sharePanel.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
        block: "nearest",
      });
    }
  });

  results.querySelector("[data-calculator-copy]").addEventListener("click", async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      feedback.textContent = "Resumen y enlace copiados. Listos para pegar en WhatsApp o un correo.";
    } catch {
      sharePreview.open = true;
      shareMessage.focus();
      shareMessage.select();
      feedback.textContent = "No se pudo copiar automáticamente. El mensaje está seleccionado para que puedas copiarlo.";
    }
  });

  results.querySelector("[data-calculator-edit]").addEventListener("click", (event) => {
    event.preventDefault();
    scrollTo(form.elements.downPayment);
  });
}

function initEVCalculator() {
  const form = document.querySelector("[data-ev-calculator-form]");
  const feedback = document.querySelector("[data-ev-calculator-feedback]");
  const copyButton = document.querySelector("[data-ev-calculator-copy]");
  const resetButton = document.querySelector("[data-ev-calculator-reset]");

  if (!form || !feedback || !copyButton || !resetButton) return;

  const outputs = {
    electricTotal: document.querySelector('[data-ev-output="electricTotal"]'),
    fuelTotal: document.querySelector('[data-ev-output="fuelTotal"]'),
    savings: document.querySelector('[data-ev-output="savings"]'),
    fuelLiters: document.querySelector('[data-ev-output="fuelLiters"]'),
  };

  const getValue = (name) => Number.parseFloat(form.elements[name].value) || 0;
  const getFuelType = () => form.querySelector('input[name="fuelType"]:checked')?.value || "gasoline";
  const trackCalculation = createCounterTracker(
    "ev_savings",
    () => getValue("km") > 0 && getValue("fuelConsumption") > 0 && getValue("electricConsumption") > 0
  );
  const getSignature = () =>
    JSON.stringify({
      km: getValue("km"),
      electricConsumption: getValue("electricConsumption"),
      electricCost: getValue("electricCost"),
      fuelConsumption: getValue("fuelConsumption"),
      gasolineCost: getValue("gasolineCost"),
      dieselCost: getValue("dieselCost"),
      freeCharge: form.elements.freeCharge.checked,
      fuelType: getFuelType(),
    });

  const render = () => {
    const km = getValue("km");
    const electricConsumption = getValue("electricConsumption") || 16.2;
    let electricCost = getValue("electricCost") || 0.09;
    const fuelConsumption = getValue("fuelConsumption") || 6.7;
    const gasolineCost = getValue("gasolineCost") || 1.59;
    const dieselCost = getValue("dieselCost") || 1.45;
    const freeCharge = form.elements.freeCharge.checked;
    const fuelType = getFuelType();
    const selectedFuelCost = fuelType === "diesel" ? dieselCost : gasolineCost;

    if (freeCharge) electricCost = 0;

    const electricTotal = (km / 100) * electricConsumption * electricCost;
    const fuelTotal = (km / 100) * fuelConsumption * selectedFuelCost;
    const savings = fuelTotal - electricTotal;
    const fuelLiters = (km / 100) * fuelConsumption;

    outputs.electricTotal.textContent = formatCurrency(electricTotal);
    outputs.fuelTotal.textContent = formatCurrency(fuelTotal);
    outputs.savings.textContent = formatCurrency(savings);
    outputs.fuelLiters.textContent = `${formatDecimal(fuelLiters, 1)} L`;
  };

  form.addEventListener("input", () => {
    feedback.textContent = "";
    render();
    trackCalculation(getSignature());
  });

  form.addEventListener("change", () => {
    feedback.textContent = "";
    render();
    trackCalculation(getSignature());
  });

  resetButton.addEventListener("click", () => {
    form.reset();
    form.querySelector('input[name="fuelType"][value="gasoline"]').checked = true;
    feedback.textContent = "Valores restablecidos.";
    render();
  });

  copyButton.addEventListener("click", async () => {
    const fuelType = getFuelType() === "diesel" ? "diésel" : "gasolina";
    const summary = [
      `Km recorridos: ${formatNumber(getValue("km"))} km`,
      `Consumo electrico: ${formatDecimal(getValue("electricConsumption"), 1)} kWh/100 km`,
      `Coste de la luz: ${formatDecimal(form.elements.freeCharge.checked ? 0 : getValue("electricCost"), 2)} EUR/kWh`,
      `Consumo termico: ${formatDecimal(getValue("fuelConsumption"), 1)} L/100 km`,
      `Comparativa contra: ${fuelType}`,
      `Coste en electrico: ${outputs.electricTotal.textContent}`,
      `Coste en ${fuelType}: ${outputs.fuelTotal.textContent}`,
      `Ahorro estimado: ${outputs.savings.textContent}`,
      `Litros evitados: ${outputs.fuelLiters.textContent}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(summary);
      feedback.textContent = "Resumen copiado al portapapeles.";
    } catch {
      feedback.textContent = "No se pudo copiar el resumen.";
    }
  });

  render();
}

function createVideoCard(video) {
  return `
    <article class="video-card">
      <a class="thumb-link" href="${video.url}" target="_blank" rel="noreferrer">
        <img src="${video.thumbnail}" alt="Miniatura de ${video.title}" loading="lazy" />
      </a>
      <div class="video-body">
        <h3 class="video-title">${video.title}</h3>
        <p class="video-meta">
          <span>${video.channelName}</span>
          <span>${video.category}</span>
          <span>${formatDate(video.publishedAt)}</span>
        </p>
      </div>
    </article>
  `;
}

function renderFooter(data) {
  document.querySelectorAll('[data-stat="lastUpdatedLabel"]').forEach((element) => {
    element.textContent = `Datos actualizados: ${formatDate(data.meta.lastUpdated)}`;
  });
}

function renderHome(data) {
  const rowsContainer = document.getElementById("latestRows");
  rowsContainer.innerHTML = data.channels
    .map((channel) => {
      const cards = channel.latestVideos.slice(0, 3).map(createVideoCard).join("");
      return `
        <section class="channel-row">
          <div class="channel-row-head">
            <div>
              <h3 class="channel-row-title">${channel.name}</h3>
              <p class="channel-meta">${channel.description}</p>
            </div>
            <p class="channel-meta">${formatNumber(channel.subscribers)} suscriptores</p>
          </div>
          <div class="video-strip">
            ${cards || '<div class="empty-state">Este canal todavía no tiene vídeos listados.</div>'}
          </div>
        </section>
      `;
    })
    .join("");
}

function renderSharedStats(data) {
  const stats = data.metrics;
  const fromStudio = data.metricSources?.viewsLast365Days === "studio";
  document.querySelectorAll('[data-metric-label="viewsLast365Days"]').forEach((element) => {
    element.textContent = fromStudio ? "Visualizaciones en los últimos 365 días" : "Visualizaciones de vídeos del último año";
  });
  document.querySelectorAll('[data-metric-note="viewsLast365Days"]').forEach((element) => {
    element.textContent = fromStudio
      ? "Dato de YouTube Studio actualizado manualmente, incluyendo vídeos y Shorts."
      : "Visitas acumuladas de los vídeos y Shorts publicados en los últimos 365 días.";
  });
  document.querySelectorAll('[data-metrics-sync]').forEach((element) => {
    element.textContent = `YouTube sincronizado el ${formatDate(data.metricSources?.youtubeUpdatedAt || data.meta.lastUpdated)}.`;
  });
  const statMap = {
    totalAudience: formatNumber(stats.totalAudience),
    hoursWatched: formatCompactHours(stats.hoursWatchedThisYear),
    videoCount: formatNumber(stats.totalVideos),
    viewsLast365Days: formatNumber(stats.viewsLast365Days),
  };

  Object.entries(statMap).forEach(([key, value]) => {
    document.querySelectorAll(`[data-stat="${key}"]`).forEach((element) => {
      element.textContent = value;
    });
  });
}

function renderVideos(data) {
  const searchInput = document.getElementById("searchInput");
  const filterButtons = document.getElementById("filterButtons");
  const videoGrid = document.getElementById("videoGrid");
  const resultsSummary = document.getElementById("resultsSummary");

  const filters = FILTER_ORDER.filter((filter) => {
    if (filter === "Todos") return true;
    return data.videos.some((video) => getVideoTopics(video).has(filter));
  });
  let activeFilter = "Todos";
  let searchTerm = "";

  filterButtons.innerHTML = filters
    .map(
      (filter) => `
        <button class="filter-button ${filter === "Todos" ? "active" : ""}" data-filter="${filter}">
          ${filter}
        </button>
      `
    )
    .join("");

  const render = () => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const filtered = data.videos.filter((video) => {
      const matchesFilter = activeFilter === "Todos" || getVideoTopics(video).has(activeFilter);
      const matchesSearch = !normalizedSearch || video.title.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });

    resultsSummary.textContent = `${formatNumber(filtered.length)} vídeos encontrados`;
    videoGrid.innerHTML = filtered.length
      ? filtered.map(createVideoCard).join("")
      : '<div class="empty-state">No hay resultados para esa combinación de filtro y búsqueda.</div>';
  };

  filterButtons.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    filterButtons.querySelectorAll(".filter-button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    render();
  });

  searchInput.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    render();
  });

  render();
}

async function optionalJson(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

async function init() {
  initNav();
  initCalculator();
  initCounters();
  initShare();
  initEVCalculator();

  if (!document.querySelector('[data-stat]') && page !== "home" && page !== "videos") return;
  const [{ mergeSiteMetrics }, dataResponse, socialMetrics, overrides] = await Promise.all([
    import("./site-metrics.mjs"),
    fetch("/data/data.json", { cache: "no-store" }),
    optionalJson("/data/social-metrics.json"),
    optionalJson("/data/metric-overrides.json"),
  ]);
  if (!dataResponse.ok) throw new Error("metrics_unavailable");
  const mergedData = mergeSiteMetrics(await dataResponse.json(), socialMetrics, overrides);
  renderFooter(mergedData);
  renderSharedStats(mergedData);
  if (page === "home") renderHome(mergedData);
  if (page === "videos") renderVideos(mergedData);
}

init().catch(() => {
  document.querySelectorAll('[data-stat]').forEach((element) => { element.textContent = "—"; });
  const target = document.querySelector('[data-metrics-sync]') || document.querySelector('main');
  if (target?.hasAttribute('data-metrics-sync')) {
    target.textContent = "Las cifras no están disponibles ahora. Puedes seguir explorando la web.";
  } else if (target) {
    target.insertAdjacentHTML("beforeend", '<div class="container"><p class="empty-state">No se han podido cargar los datos. Prueba a recargar la página.</p></div>');
  }
});
