(() => {
  const search = document.querySelector("[data-blog-search]");
  if (!search) return;

  const input = search.querySelector("[data-blog-search-input]");
  const defaultView = document.querySelector("[data-blog-default]");
  const results = document.querySelector("[data-blog-search-results]");
  const status = results.querySelector("[data-blog-search-status]");
  const list = results.querySelector("[data-blog-search-list]");
  const more = results.querySelector("[data-blog-search-more]");
  const PAGE_SIZE = 24;
  let documentsPromise;
  let matches = [];
  let visible = PAGE_SIZE;
  let timer;

  const normalize = (value) => value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  function loadDocuments() {
    if (!documentsPromise) {
      documentsPromise = fetch("/blog/search-index.json")
        .then((response) => {
          if (!response.ok) throw new Error("No se ha podido cargar el índice");
          return response.json();
        })
        .then((items) => items.map((item) => ({
          ...item,
          titleSearch: normalize(item.t),
          categorySearch: normalize(item.c),
          descriptionSearch: normalize(item.d),
          bodySearch: normalize(item.x),
          dateSearch: normalize(item.p),
        })))
        .catch((error) => {
          documentsPromise = undefined;
          throw error;
        });
    }
    return documentsPromise;
  }

  function card(item, terms) {
    const link = document.createElement("a");
    link.className = "blog-search-result";
    link.href = item.u;
    const meta = document.createElement("small");
    meta.textContent = `${item.c} · ${item.l}`;
    const title = document.createElement("strong");
    title.textContent = item.t;
    const excerpt = document.createElement("span");
    const inBody = terms.find((term) => item.bodySearch.includes(term));
    if (inBody && !terms.some((term) => item.descriptionSearch.includes(term))) {
      const position = item.bodySearch.indexOf(inBody);
      const start = Math.max(0, position - 55);
      excerpt.textContent = `${start ? "…" : ""}${item.x.slice(start, position + 150)}${position + 150 < item.x.length ? "…" : ""}`;
    } else {
      excerpt.textContent = item.d;
    }
    link.append(meta, title, excerpt);
    return link;
  }

  function draw(terms, query) {
    const fragment = document.createDocumentFragment();
    for (const item of matches.slice(0, visible)) fragment.append(card(item, terms));
    list.replaceChildren(fragment);
    status.textContent = matches.length
      ? `${matches.length.toLocaleString("es-ES")} ${matches.length === 1 ? "artículo" : "artículos"} para «${query}»`
      : `No he encontrado artículos para «${query}». Prueba con otra palabra.`;
    more.hidden = visible >= matches.length;
  }

  async function run(query) {
    try {
      const documents = await loadDocuments();
      if (input.value.trim() !== query) return;
      const terms = normalize(query).split(/\s+/).filter(Boolean);
      matches = documents
        .map((item) => {
          const fields = [item.titleSearch, item.categorySearch, item.descriptionSearch, item.bodySearch, item.dateSearch];
          if (!terms.every((term) => fields.some((field) => field.includes(term)))) return null;
          const score = terms.reduce((total, term) => total +
            (item.titleSearch.includes(term) ? 8 : 0) +
            (item.categorySearch.includes(term) ? 4 : 0) +
            (item.descriptionSearch.includes(term) ? 2 : 0) +
            (item.bodySearch.includes(term) ? 1 : 0), 0);
          return { item, score };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);
      visible = PAGE_SIZE;
      draw(terms, query);
    } catch {
      if (input.value.trim() !== query) return;
      status.textContent = "No he podido cargar el buscador. Vuelve a intentarlo en unos momentos.";
      list.replaceChildren();
      more.hidden = true;
    }
  }

  search.hidden = false;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const query = input.value.trim();
    if (!query) {
      defaultView.hidden = false;
      results.hidden = true;
      return;
    }
    defaultView.hidden = true;
    results.hidden = false;
    list.replaceChildren();
    more.hidden = true;
    if (normalize(query).length < 2) {
      status.textContent = "Escribe al menos dos caracteres para buscar.";
      return;
    }
    status.textContent = "Buscando en todos los artículos…";
    timer = setTimeout(() => run(query), 180);
  });
  more.addEventListener("click", () => {
    visible += PAGE_SIZE;
    draw(normalize(input.value.trim()).split(/\s+/).filter(Boolean), input.value.trim());
  });
})();
