(() => {
  // Progressive enhancement: browsers without WebMCP keep the normal links.
  const context = document.modelContext || navigator.modelContext;
  if (typeof context?.registerTool !== "function") return;

  const sections = {
    inicio: { title: "Inicio", path: "/" },
    blog: { title: "Blog y buscador", path: "/blog/" },
    videos: { title: "Videoteca", path: "/videos.html" },
    herramientas: { title: "Herramientas", path: "/herramientas.html" },
    compra_coche: { title: "Calculadora de compra de coche", path: "/calculadora-compra-coche.html" },
    ahorro_electrico: { title: "Calculadora eléctrico frente a combustible", path: "/calculadora-ahorro-coche-electrico.html" },
    shop: { title: "Shop", path: "/shop.html" },
    proyectos: { title: "Proyectos", path: "/proyectos.html" },
    contacto: { title: "Contacto", path: "/contacto.html" },
  };

  const tools = [
    {
      name: "list_site_sections",
      description: "Devuelve los enlaces a las secciones y calculadoras públicas de Lisard Bellod.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async () => JSON.stringify(Object.entries(sections).map(([section, item]) => ({
        section, title: item.title, url: new URL(item.path, location.origin).href,
      }))),
    },
    {
      name: "open_site_section",
      description: "Abre en esta pestaña una sección o calculadora de la web. Permite continuar usando sus enlaces y formularios visibles.",
      inputSchema: {
        type: "object",
        properties: { section: { type: "string", enum: Object.keys(sections), description: "Sección que se quiere abrir." } },
        required: ["section"], additionalProperties: false,
      },
      execute: async ({ section } = {}) => {
        if (!Object.hasOwn(sections, section)) throw new Error("Sección desconocida.");
        location.assign(sections[section].path);
        return "Abriendo la sección seleccionada.";
      },
    },
    {
      name: "search_blog",
      description: "Abre el buscador del blog de Lisard Bellod con los términos indicados y muestra los artículos coincidentes en pantalla.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 2, maxLength: 120, description: "Palabras sobre un tema, coche o lugar; entre 2 y 120 caracteres." } },
        required: ["query"], additionalProperties: false,
      },
      execute: async ({ query } = {}) => {
        if (typeof query !== "string" || query.trim().length < 2 || query.length > 120) {
          throw new Error("Escribe entre 2 y 120 caracteres para buscar.");
        }
        const url = new URL("/blog/", location.origin);
        url.searchParams.set("q", query.trim());
        location.assign(url.href);
        return "Abriendo los resultados del blog.";
      },
    },
  ];

  for (const tool of tools) {
    try {
      Promise.resolve(context.registerTool(tool)).catch(() => {});
    } catch {
      // Experimental API differences must not break the public site.
    }
  }
})();
