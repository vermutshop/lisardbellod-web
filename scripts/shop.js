const shopGrid = document.querySelector("[data-shop-grid]");
const shopStatus = document.querySelector("[data-shop-status]");

function productUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Falta una URL de producto");
  }
  const url = new URL(value, window.location.href);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("URL de producto no válida");
  }
  return url.href;
}

function createProductCard(product) {
  if (!product.name || !product.store) throw new Error("Falta el nombre o la tienda");
  const card = document.createElement("article");
  card.className = "shop-card";

  const imageLink = document.createElement("a");
  imageLink.className = "shop-card-image";
  imageLink.href = productUrl(product.url);
  imageLink.target = "_blank";
  imageLink.rel = product.affiliate ? "sponsored noopener noreferrer" : "noopener noreferrer";
  imageLink.setAttribute("aria-label", `Ver ${product.name} en ${product.store}`);

  const image = document.createElement("img");
  image.src = productUrl(product.image);
  image.alt = product.name;
  image.loading = "lazy";
  image.decoding = "async";
  image.width = 640;
  image.height = 640;
  image.addEventListener("error", () => {
    image.hidden = true;
    imageLink.classList.add("shop-image-unavailable");
    imageLink.textContent = "Ver imagen en la tienda ↗";
  }, { once: true });
  if (product.imageCrop) {
    const crop = product.imageCrop;
    const values = [crop.x, crop.y, crop.width, crop.height, crop.sourceWidth, crop.sourceHeight];
    if (!values.every(Number.isFinite) || crop.x < 0 || crop.y < 0 ||
        crop.width <= 0 || crop.height <= 0 ||
        crop.x + crop.width > crop.sourceWidth || crop.y + crop.height > crop.sourceHeight) {
      throw new Error("Encuadre de imagen no válido");
    }
    // Frame the exact product photo from the supplied screenshot in CSS.
    const frame = document.createElement("div");
    frame.className = "shop-source-crop";
    frame.style.aspectRatio = `${crop.width} / ${crop.height}`;
    image.width = crop.sourceWidth;
    image.height = crop.sourceHeight;
    image.style.width = `${(crop.sourceWidth / crop.width) * 100}%`;
    image.style.left = `${(-crop.x / crop.width) * 100}%`;
    image.style.top = `${(-crop.y / crop.height) * 100}%`;
    frame.append(image);
    imageLink.append(frame);
  } else {
    imageLink.append(image);
  }

  const body = document.createElement("div");
  body.className = "shop-card-body";
  const store = document.createElement("p");
  store.className = "eyebrow";
  store.textContent = product.store;
  const name = document.createElement("h3");
  name.textContent = product.name;
  body.append(store, name);

  if (product.note) {
    const note = document.createElement("p");
    note.className = "shop-card-note";
    note.textContent = product.note;
    body.append(note);
  }

  const buyLink = document.createElement("a");
  buyLink.className = "button secondary shop-buy-link";
  // Keep the supplied link intact, including affiliate codes and tracking parameters.
  buyLink.href = imageLink.href;
  buyLink.target = imageLink.target;
  buyLink.rel = imageLink.rel;
  buyLink.textContent = `Comprar en ${product.store} ↗`;
  buyLink.setAttribute("aria-label", `Comprar ${product.name} en ${product.store} (abre en una pestaña nueva)`);
  body.append(buyLink);

  if (product.affiliate) {
    const affiliate = document.createElement("p");
    affiliate.className = "shop-affiliate-label";
    affiliate.textContent = "Enlace de afiliado";
    body.append(affiliate);
  }

  card.append(imageLink, body);
  return card;
}

async function initShop() {
  if (!shopGrid || !shopStatus) return;
  try {
    const response = await fetch("./data/shop.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo cargar el catálogo");
    const { products } = await response.json();
    if (!Array.isArray(products)) throw new Error("Catálogo no válido");
    if (!products.length) {
      shopStatus.textContent = "Estoy preparando mis primeras recomendaciones. Pronto las encontrarás aquí.";
      return;
    }
    const cards = products.map(createProductCard);
    shopGrid.replaceChildren(...cards);
    shopStatus.hidden = true;
  } catch (error) {
    shopStatus.textContent = "No se han podido cargar las recomendaciones. Vuelve a intentarlo en unos minutos.";
    console.error("Shop:", error);
  }
}

initShop();
