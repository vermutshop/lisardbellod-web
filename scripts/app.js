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

function mergeManualSocialMetrics(data, manualMetrics) {
  if (!manualMetrics) return data;

  const instagramFollowers =
    Number.parseInt(manualMetrics.instagramFollowers, 10) || data.socials?.instagramFollowers || 0;
  const tiktokFollowers =
    Number.parseInt(manualMetrics.tiktokFollowers, 10) || data.socials?.tiktokFollowers || 0;
  const youtubeHoursManual =
    Number.parseFloat(manualMetrics.youtubeHoursManual) || data.metrics?.hoursWatchedThisYear || 0;

  const channelSubscribers = (data.channels || []).reduce(
    (sum, channel) => sum + (Number(channel.subscribers) || 0),
    0
  );

  return {
    ...data,
    metrics: {
      ...data.metrics,
      totalAudience: channelSubscribers + instagramFollowers + tiktokFollowers,
      hoursWatchedThisYear: youtubeHoursManual,
    },
    socials: {
      ...data.socials,
      instagramFollowers,
      tiktokFollowers,
    },
  };
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
  const feedback = document.querySelector("[data-calculator-feedback]");
  const copyButton = document.querySelector("[data-calculator-copy]");
  const resetButton = document.querySelector("[data-calculator-reset]");

  if (!form || !feedback || !copyButton || !resetButton) return;

  const outputs = {
    totalFinanced: document.querySelector('[data-calc-output="totalFinanced"]'),
    extraPaid: document.querySelector('[data-calc-output="extraPaid"]'),
    extraPercent: document.querySelector('[data-calc-output="extraPercent"]'),
    installmentTotal: document.querySelector('[data-calc-output="installmentTotal"]'),
  };

  const getValue = (name) => Number.parseFloat(form.elements[name].value) || 0;
  const trackCalculation = createCounterTracker(
    "buy_car",
    () => getValue("cashPrice") > 0 && (getValue("downPayment") > 0 || getValue("monthlyPayment") > 0 || getValue("finalPayment") > 0)
  );
  const getSignature = () =>
    JSON.stringify({
      cashPrice: getValue("cashPrice"),
      downPayment: getValue("downPayment"),
      monthlyPayment: getValue("monthlyPayment"),
      months: Math.max(0, Math.round(getValue("months"))),
      finalPayment: getValue("finalPayment"),
      extraCosts: getValue("extraCosts"),
    });

  const render = () => {
    const cashPrice = getValue("cashPrice");
    const downPayment = getValue("downPayment");
    const monthlyPayment = getValue("monthlyPayment");
    const months = Math.max(0, Math.round(getValue("months")));
    const finalPayment = getValue("finalPayment");
    const extraCosts = getValue("extraCosts");

    const installmentTotal = monthlyPayment * months + finalPayment;
    const totalFinanced = downPayment + installmentTotal + extraCosts;
    const extraPaid = totalFinanced - cashPrice;
    const extraPercent = cashPrice > 0 ? (extraPaid / cashPrice) * 100 : 0;

    outputs.totalFinanced.textContent = formatCurrency(totalFinanced);
    outputs.extraPaid.textContent = formatCurrency(extraPaid);
    outputs.extraPercent.textContent = `${new Intl.NumberFormat("es-ES", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    }).format(extraPercent)} %`;
    outputs.installmentTotal.textContent = formatCurrency(installmentTotal);
  };

  form.addEventListener("input", () => {
    feedback.textContent = "";
    render();
    trackCalculation(getSignature());
  });

  resetButton.addEventListener("click", () => {
    form.reset();
    feedback.textContent = "Valores restablecidos.";
    render();
  });

  copyButton.addEventListener("click", async () => {
    const summary = [
      `Precio al contado: ${formatCurrency(getValue("cashPrice"))}`,
      `Entrada: ${formatCurrency(getValue("downPayment"))}`,
      `Cuota mensual: ${formatCurrency(getValue("monthlyPayment"))}`,
      `Numero de cuotas: ${Math.max(0, Math.round(getValue("months")))}`,
      `Cuota final: ${formatCurrency(getValue("finalPayment"))}`,
      `Otros costes: ${formatCurrency(getValue("extraCosts"))}`,
      `Coste total financiado: ${outputs.totalFinanced.textContent}`,
      `Pagas de mas: ${outputs.extraPaid.textContent}`,
      `Incremento porcentual: ${outputs.extraPercent.textContent}`,
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
    element.textContent = `Ultima actualización: ${formatDate(data.meta.lastUpdated)}`;
  });
}

function renderHome(data) {
  renderSharedStats(data);
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

async function init() {
  const [dataResponse, socialMetricsResponse] = await Promise.all([
    fetch("./data/data.json", { cache: "no-store" }),
    fetch("./data/social-metrics.json", { cache: "no-store" }).catch(() => null),
  ]);
  const data = await dataResponse.json();
  const socialMetrics = socialMetricsResponse?.ok ? await socialMetricsResponse.json() : null;
  const mergedData = mergeManualSocialMetrics(data, socialMetrics);

  initCounters();
  initShare();
  initCalculator();
  initEVCalculator();
  renderFooter(mergedData);
  renderSharedStats(mergedData);

  if (page === "home") renderHome(mergedData);
  if (page === "videos") renderVideos(mergedData);
}

init().catch((error) => {
  const target = document.querySelector("main");
  if (target) {
    target.insertAdjacentHTML(
      "beforeend",
      `<div class="container"><div class="empty-state">No se pudieron cargar los datos: ${error.message}</div></div>`
    );
  }
});
