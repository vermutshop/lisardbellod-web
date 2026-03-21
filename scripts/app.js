const page = document.body.dataset.page;

const formatNumber = (value) =>
  new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(value || 0);

const formatDate = (value) =>
  new Intl.DateTimeFormat("es-ES", { dateStyle: "long" }).format(new Date(value));

const formatCompactHours = (value) => `${formatNumber(Math.round(value || 0))}h`;

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
  const response = await fetch("./data/data.json", { cache: "no-store" });
  const data = await response.json();

  initShare();
  renderFooter(data);
  renderSharedStats(data);

  if (page === "home") renderHome(data);
  if (page === "videos") renderVideos(data);
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
