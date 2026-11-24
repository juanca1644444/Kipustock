/**
 * TIENDA WEB PÚBLICA - KIPUSTOCK STORE
 * Lógica de Catálogo, Carrito y Checkout sin fricción (Costo $0)
 */

document.addEventListener("DOMContentLoaded", () => {
  const EXCHANGE_RATE = 3.75;
  const NEUTRAL_PLACEHOLDER = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22400%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%3E%3Crect%20width%3D%2218%22%20height%3D%2218%22%20x%3D%223%22%20y%3D%223%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%229%22%20r%3D%222%22%2F%3E%3Cpath%20d%3D%22m21%2015-3.086-3.086a2%202%200%200%200-2.828%200L6%2021%22%2F%3E%3C%2Fsvg%3E";

  function getStoredCart() {
    try {
      const raw = localStorage.getItem("kipustock_store_cart");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(item => item && item.product_id != null && !isNaN(Number(item.product_id)))
        .map(item => ({
          product_id: Number(item.product_id),
          nombre: String(item.nombre || "Producto"),
          foto_url: item.foto_url || null,
          precio_venta: Number(item.precio_venta) || 0,
          cantidad: Math.max(1, parseInt(item.cantidad, 10) || 1),
          stock_max: Number(item.stock_max) || 999
        }));
    } catch (e) {
      console.warn("Error leyendo carrito de localStorage, reiniciando:", e);
      return [];
    }
  }

  const state = {
    config: {
      nombre_tienda: "KipuStock Store",
      whatsapp_ventas: "51944830586",
      mensaje_bienvenida: "¡Bienvenido a KipuStock Store! Productos de alta rotación con entrega inmediata.",
      qr_yape_url: null,
      qr_plin_url: null,
      instrucciones_pago: "Realiza tu pago vía Yape o Plin al número oficial y envía la constancia por WhatsApp."
    },
    products: [],
    cart: getStoredCart(),
    currency: "PEN",
    activeFilter: "all",
    searchQuery: "",
    selectedPaymentMethod: "Contraentrega",
    uploadedProofUrl: null
  };

  // DOM
  const DOM = {
    brandStoreName: document.getElementById("brandStoreName"),
    bannerWelcome: document.getElementById("bannerWelcome"),
    bannerDesc: document.getElementById("bannerDesc"),
    storeSearchInput: document.getElementById("storeSearchInput"),
    filterChips: document.querySelectorAll(".chip-btn"),
    catalogCountText: document.getElementById("catalogCountText"),
    productsGrid: document.getElementById("productsGrid"),
    btnOpenCart: document.getElementById("btnOpenCart"),
    cartCountBadge: document.getElementById("cartCountBadge"),
    cartDrawerOverlay: document.getElementById("cartDrawerOverlay"),
    cartDrawer: document.getElementById("cartDrawer"),
    btnCloseDrawer: document.getElementById("btnCloseDrawer"),
    btnContinueTop: document.getElementById("btnContinueTop"),
    cartItemsList: document.getElementById("cartItemsList"),
    cartEmptyView: document.getElementById("cartEmptyView"),
    btnEmptyKeepShopping: document.getElementById("btnEmptyKeepShopping"),
    cartKeepShoppingWrap: document.getElementById("cartKeepShoppingWrap"),
    btnKeepShopping: document.getElementById("btnKeepShopping"),
    checkoutSection: document.getElementById("checkoutSection"),
    cartTotalAmount: document.getElementById("cartTotalAmount"),
    formCheckout: document.getElementById("formCheckout"),
    custName: document.getElementById("custName"),
    custPhone: document.getElementById("custPhone"),
    custAddress: document.getElementById("custAddress"),
    custNotes: document.getElementById("custNotes"),
    payOptionPills: document.querySelectorAll(".pay-option-pill"),
    codSection: document.getElementById("codSection"),
    qrSection: document.getElementById("qrSection"),
    qrPreviewImg: document.getElementById("qrPreviewImg"),
    qrInstructionsText: document.getElementById("qrInstructionsText"),
    qrAmountToPay: document.getElementById("qrAmountToPay"),
    fileProofUpload: document.getElementById("fileProofUpload"),
    proofUploadStatus: document.getElementById("proofUploadStatus"),
    btnSubmitOrder: document.getElementById("btnSubmitOrder"),
    orderSuccessModal: document.getElementById("orderSuccessModal"),
    orderSuccessCode: document.getElementById("orderSuccessCode"),
    orderSuccessTotal: document.getElementById("orderSuccessTotal"),
    btnSendOrderWaNow: document.getElementById("btnSendOrderWaNow"),
    btnCloseOrderModal: document.getElementById("btnCloseOrderModal"),
    currBtns: document.querySelectorAll(".curr-btn"),
    // Toast
    storeToastContainer: document.getElementById("storeToastContainer"),
    storeToast: document.getElementById("storeToast"),
    storeToastTitle: document.getElementById("storeToastTitle"),
    storeToastDesc: document.getElementById("storeToastDesc"),
    btnToastContinue: document.getElementById("btnToastContinue"),
    btnToastViewCart: document.getElementById("btnToastViewCart")
  };

  // HELPERS
  function formatMoney(amountInPEN) {
    if (isNaN(amountInPEN) || amountInPEN === null) amountInPEN = 0;
    if (state.currency === "USD") {
      const usd = amountInPEN / EXCHANGE_RATE;
      return `$ ${usd.toFixed(2)}`;
    }
    return `S/ ${amountInPEN.toFixed(2)}`;
  }

  function saveCart() {
    localStorage.setItem("kipustock_store_cart", JSON.stringify(state.cart));
    updateCartUI();
  }

  let toastTimer = null;
  function showStoreToast(title, desc = "") {
    if (!DOM.storeToast) return;
    if (DOM.storeToastTitle) DOM.storeToastTitle.textContent = title;
    if (DOM.storeToastDesc) DOM.storeToastDesc.textContent = desc;

    DOM.storeToast.classList.add("visible");

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      hideStoreToast();
    }, 4000);
  }

  function hideStoreToast() {
    if (DOM.storeToast) DOM.storeToast.classList.remove("visible");
    if (toastTimer) clearTimeout(toastTimer);
  }

  // INICIALIZACIÓN
  async function init() {
    await loadStoreConfig();
    await loadProducts();
    updateCartUI();
    setupEvents();
  }

  async function loadStoreConfig() {
    try {
      const res = await fetch("/api/store/config");
      if (res.ok) {
        state.config = await res.json();
        if (DOM.brandStoreName) DOM.brandStoreName.textContent = state.config.nombre_tienda || "KipuStock Store";
        if (DOM.bannerWelcome) DOM.bannerWelcome.textContent = state.config.nombre_tienda || "KipuStock Store";
        if (DOM.bannerDesc) DOM.bannerDesc.textContent = state.config.mensaje_bienvenida || "Catálogo oficial en vivo";
      }
    } catch (e) {
      console.warn("Configuración usando valores por defecto:", e);
    }
  }

  async function loadProducts() {
    try {
      const res = await fetch("/api/store/products");
      if (res.ok) {
        state.products = await res.json();
        renderProducts();
      }
    } catch (e) {
      console.error("Error al cargar productos:", e);
      if (DOM.catalogCountText) DOM.catalogCountText.textContent = "Error al conectar con el almacén.";
    }
  }

  function renderProducts() {
    if (!DOM.productsGrid) return;
    DOM.productsGrid.innerHTML = "";

    const q = state.searchQuery.toLowerCase().trim();
    const filtered = state.products.filter(p => {
      const estadoLower = (p.estado || "").toLowerCase();
      const isOnDemand = estadoLower.includes("pedido") || estadoLower.includes("encargo") || p.es_bajo_pedido;

      let matchFilter = true;
      if (state.activeFilter === "Bajo Pedido") {
        matchFilter = isOnDemand;
      } else if (state.activeFilter !== "all") {
        matchFilter = estadoLower === state.activeFilter.toLowerCase();
      }

      const matchSearch = !q || p.nombre.toLowerCase().includes(q) || (p.modelo && p.modelo.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q));
      return matchFilter && matchSearch;
    });

    if (DOM.catalogCountText) {
      DOM.catalogCountText.textContent = `Mostrando ${filtered.length} producto${filtered.length === 1 ? '' : 's'} disponible${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      DOM.productsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem 1.5rem; text-align: center; color: var(--text-muted); background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: 14px;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📦</div>
          <h4 style="color: #ffffff; margin-bottom: 0.25rem;">No encontramos productos disponibles</h4>
          <p style="font-size: 0.88rem;">Intenta con otro término de búsqueda o selecciona la categoría "Todos".</p>
        </div>
      `;
      return;
    }

    filtered.forEach(p => {
      const card = document.createElement("article");
      card.className = "product-card";

      const estadoLower = (p.estado || "Nuevo").toLowerCase();
      const isOnDemand = estadoLower.includes("pedido") || estadoLower.includes("encargo") || p.es_bajo_pedido;

      let badgeCls = "badge-nuevo";
      let estadoLabel = p.estado || "Nuevo";
      if (isOnDemand) {
        badgeCls = "badge-bajopedido";
        estadoLabel = "⏳ Por Encargo";
      } else if (estadoLower.includes("saldo")) {
        badgeCls = "badge-saldo";
      } else if (estadoLower.includes("liquid")) {
        badgeCls = "badge-liquidacion";
      }

      const stockTag = isOnDemand 
        ? `<span class="stock-tag-card" style="color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); background: rgba(56, 189, 248, 0.1);">🚚 Contraentrega (24-48h)</span>`
        : (p.stock <= 3 
            ? `<span class="stock-tag-card" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.4);">⚡ Últimas ${p.stock} unid.</span>`
            : `<span class="stock-tag-card">Stock: ${p.stock} unid.</span>`);

      const imgSrc = p.foto_url ? p.foto_url : NEUTRAL_PLACEHOLDER;
      const priceText = formatMoney(p.precio_venta);

      // Enlace directo WhatsApp
      const waPhone = state.config.whatsapp_ventas || "51944830586";
      const cleanWa = waPhone.replace(/[^0-9]/g, "");
      const skuDisplay = p.sku ? (isOnDemand ? `Código: ${p.sku} (Por Encargo)` : `SKU: ${p.sku}`) : (p.modelo ? 'Mod: ' + p.modelo : 'Garantía oficial');
      const currentStoreUrl = window.location.href.split('?')[0];
      
      const waMsg = isOnDemand
        ? `¡Hola! Me interesa pedir por encargo el producto *${p.nombre}* (${skuDisplay})\nPrecio: *${priceText}*\nModalidad: Contraentrega en 24 a 48 hrs (Efectivo/Yape/Plin).\nCatálogo: ${currentStoreUrl}`
        : `¡Hola! Me interesa comprar el producto *${p.nombre}* (${p.estado})\nPrecio: *${priceText}*\n¿Está disponible para envío?\nCatálogo: ${currentStoreUrl}`;
      const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(waMsg)}`;

      card.innerHTML = `
        <div class="product-img-box">
          <span class="badge-estado-card ${badgeCls}">${estadoLabel}</span>
          ${stockTag}
          <img class="product-img" src="${imgSrc}" alt="${p.nombre}" loading="lazy" onerror="this.onerror=null; this.src='${NEUTRAL_PLACEHOLDER}'" />
        </div>
        <div class="product-info-box">
          <h3 class="product-title" title="${p.nombre}">${p.nombre}</h3>
          <p class="product-sub">${skuDisplay}</p>
          
          <div class="product-price-row">
            <span class="price-lbl">${isOnDemand ? 'Precio por encargo:' : 'Precio contado:'}</span>
            <span class="price-num">${priceText}</span>
          </div>

          <div class="product-actions-row">
            <button class="btn-add-cart" data-id="${p.id}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>
              <span>${isOnDemand ? 'Pedir Contraentrega' : 'Agregar al Carrito'}</span>
            </button>
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn-quick-wa" title="Consultar por WhatsApp">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            </a>
          </div>
        </div>
      `;

      DOM.productsGrid.appendChild(card);
    });
  }

  // CARRITO CON SOPORTE COMPLETO MULTI-PRODUCTO
  function addToCart(productId, clickedBtn = null) {
    const idNum = Number(productId);
    if (isNaN(idNum)) return;

    const prod = state.products.find(p => Number(p.id) === idNum);
    if (!prod) return;

    const existing = state.cart.find(item => Number(item.product_id) === idNum);
    if (existing) {
      if (existing.cantidad < prod.stock) {
        existing.cantidad += 1;
      } else {
        showStoreToast(`⚠️ Stock máximo alcanzado`, `Solo disponemos de ${prod.stock} unidades de "${prod.nombre}".`);
        return;
      }
    } else {
      state.cart.push({
        product_id: idNum,
        nombre: prod.nombre,
        foto_url: prod.foto_url,
        precio_venta: Number(prod.precio_venta),
        cantidad: 1,
        stock_max: Number(prod.stock)
      });
    }

    saveCart();

    // 1. Feedback visual instantáneo en el botón pulsado
    if (clickedBtn) {
      clickedBtn.classList.add("added-success");
      const prevHTML = clickedBtn.innerHTML;
      clickedBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>¡Agregado!</span>
      `;
      setTimeout(() => {
        clickedBtn.innerHTML = prevHTML;
        clickedBtn.classList.remove("added-success");
      }, 1200);
    }

    // 2. Rebote en el badge del carrito
    if (DOM.cartCountBadge) {
      DOM.cartCountBadge.classList.remove("bump");
      void DOM.cartCountBadge.offsetWidth;
      DOM.cartCountBadge.classList.add("bump");
    }

    // 3. Notificación flotante informativa
    const totalCount = state.cart.reduce((sum, i) => sum + i.cantidad, 0);
    showStoreToast(`✓ Agregaste: ${prod.nombre}`, `${totalCount} producto${totalCount === 1 ? '' : 's'} en el carrito. Puedes continuar agregando más.`);

    // 4. Abrir drawer mostrando todos los ítems y botón claro "Seguir Comprando"
    toggleCartDrawer(true);
  }

  function updateCartQty(productId, delta) {
    const idNum = Number(productId);
    const item = state.cart.find(i => Number(i.product_id) === idNum);
    if (!item) return;

    const newQty = item.cantidad + delta;
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const prod = state.products.find(p => Number(p.id) === idNum);
    const maxStock = prod ? prod.stock : item.stock_max;

    if (newQty > maxStock) {
      showStoreToast(`⚠️ Stock límite`, `Solo disponemos de ${maxStock} unidades en almacén.`);
      return;
    }

    item.cantidad = newQty;
    saveCart();
  }

  function removeFromCart(productId) {
    const idNum = Number(productId);
    state.cart = state.cart.filter(i => Number(i.product_id) !== idNum);
    saveCart();
  }

  function updateCartUI() {
    const totalCount = state.cart.reduce((sum, i) => sum + i.cantidad, 0);
    const totalAmount = state.cart.reduce((sum, i) => sum + (i.precio_venta * i.cantidad), 0);

    if (DOM.cartCountBadge) DOM.cartCountBadge.textContent = totalCount;
    if (DOM.cartTotalAmount) DOM.cartTotalAmount.textContent = formatMoney(totalAmount);
    if (DOM.qrAmountToPay) DOM.qrAmountToPay.textContent = formatMoney(totalAmount);

    if (!DOM.cartItemsList) return;

    if (state.cart.length === 0) {
      if (DOM.cartEmptyView) DOM.cartEmptyView.style.display = "block";
      DOM.cartItemsList.innerHTML = "";
      if (DOM.checkoutSection) DOM.checkoutSection.style.display = "none";
      if (DOM.cartKeepShoppingWrap) DOM.cartKeepShoppingWrap.style.display = "none";
      return;
    }

    if (DOM.cartEmptyView) DOM.cartEmptyView.style.display = "none";
    if (DOM.checkoutSection) DOM.checkoutSection.style.display = "block";
    if (DOM.cartKeepShoppingWrap) DOM.cartKeepShoppingWrap.style.display = "block";

    DOM.cartItemsList.innerHTML = state.cart.map(item => {
      const subtotal = item.precio_venta * item.cantidad;
      const imgSrc = item.foto_url ? item.foto_url : NEUTRAL_PLACEHOLDER;

      return `
        <div class="cart-item-row">
          <img class="cart-item-img" src="${imgSrc}" alt="${item.nombre}" onerror="this.onerror=null; this.src='${NEUTRAL_PLACEHOLDER}'" />
          <div class="cart-item-info">
            <h5 class="cart-item-title" title="${item.nombre}">${item.nombre}</h5>
            <div class="cart-item-price">${formatMoney(item.precio_venta)} <span style="font-size: 0.74rem; color: #94a3b8; font-weight: normal;">(x${item.cantidad} = ${formatMoney(subtotal)})</span></div>
          </div>
          <div class="cart-item-controls">
            <div class="cart-stepper">
              <button type="button" class="btn-step-minus" data-id="${item.product_id}">-</button>
              <span>${item.cantidad}</span>
              <button type="button" class="btn-step-plus" data-id="${item.product_id}">+</button>
            </div>
            <button type="button" class="btn-remove-cart-item" data-id="${item.product_id}" title="Quitar">&times;</button>
          </div>
        </div>
      `;
    }).join("");

    DOM.cartItemsList.querySelectorAll(".btn-step-minus").forEach(btn => {
      btn.addEventListener("click", () => updateCartQty(btn.dataset.id, -1));
    });
    DOM.cartItemsList.querySelectorAll(".btn-step-plus").forEach(btn => {
      btn.addEventListener("click", () => updateCartQty(btn.dataset.id, 1));
    });
    DOM.cartItemsList.querySelectorAll(".btn-remove-cart-item").forEach(btn => {
      btn.addEventListener("click", () => removeFromCart(btn.dataset.id));
    });
  }

  function toggleCartDrawer(open) {
    if (open) {
      DOM.cartDrawerOverlay.classList.add("active");
      DOM.cartDrawer.classList.add("active");
    } else {
      DOM.cartDrawerOverlay.classList.remove("active");
      DOM.cartDrawer.classList.remove("active");
    }
  }

  // MÉTODOS DE PAGO Y QR
  function selectPaymentMethod(method) {
    state.selectedPaymentMethod = method;

    DOM.payOptionPills.forEach(pill => {
      if (pill.dataset.method === method) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    if (method === "Contraentrega") {
      if (DOM.codSection) DOM.codSection.style.display = "block";
      if (DOM.qrSection) DOM.qrSection.style.display = "none";
      DOM.btnSubmitOrder.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <span>Confirmar Pedido Contraentrega</span>
      `;
    } else if (method === "Yape" || method === "Plin") {
      if (DOM.codSection) DOM.codSection.style.display = "none";
      DOM.qrSection.style.display = "block";
      const qrUrl = method === "Yape" ? state.config.qr_yape_url : state.config.qr_plin_url;
      const cleanPhone = (state.config.whatsapp_ventas || "51944830586").replace(/[^0-9]/g, "");

      if (qrUrl) {
        DOM.qrPreviewImg.src = qrUrl;
        DOM.qrPreviewImg.style.display = "block";
      } else {
        DOM.qrPreviewImg.style.display = "none";
      }

      DOM.qrInstructionsText.innerHTML = `
        Transfiere vía <strong>${method}</strong> al número <strong>${cleanPhone}</strong>.<br>
        ${state.config.instrucciones_pago || 'Adjunta tu constancia o envíala directamente por WhatsApp para despachar.'}
      `;

      DOM.btnSubmitOrder.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <span>Confirmar Pago y Registrar Pedido</span>
      `;
    } else {
      if (DOM.codSection) DOM.codSection.style.display = "none";
      DOM.qrSection.style.display = "none";
      DOM.btnSubmitOrder.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
        <span>Confirmar Pedido y Abrir WhatsApp</span>
      `;
    }
  }

  // SUBIR COMPROBANTE
  async function handleProofUpload(file) {
    if (!file) return;
    DOM.proofUploadStatus.textContent = "Subiendo constancia...";
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/store/upload-comprobante", {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("Error al subir archivo");
      const data = await res.json();
      state.uploadedProofUrl = data.url;
      DOM.proofUploadStatus.innerHTML = `✓ Constancia adjunta con éxito (${file.name})`;
      DOM.proofUploadStatus.style.color = "#10b981";
    } catch (err) {
      console.error(err);
      DOM.proofUploadStatus.textContent = "Error al subir comprobante. Puedes enviarlo directamente por WhatsApp.";
      DOM.proofUploadStatus.style.color = "#f87171";
    }
  }

  // ENVIAR PEDIDO
  async function handleOrderSubmit(e) {
    e.preventDefault();

    if (state.cart.length === 0) {
      alert("Tu carrito está vacío.");
      return;
    }

    const name = DOM.custName.value.trim();
    const phone = DOM.custPhone.value.trim();
    const address = DOM.custAddress.value.trim();
    const notes = DOM.custNotes ? DOM.custNotes.value.trim() : "";

    if (!name || !phone || !address) {
      alert("Por favor completa tu Nombre, WhatsApp y Distrito/Dirección de entrega.");
      return;
    }

    DOM.btnSubmitOrder.disabled = true;
    DOM.btnSubmitOrder.innerHTML = `<span>Procesando pedido...</span>`;

    const itemsPayload = state.cart.map(item => ({
      producto_id: Number(item.product_id),
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precio_venta,
      subtotal: item.precio_venta * item.cantidad
    }));

    const totalAmount = state.cart.reduce((sum, i) => sum + (i.precio_venta * i.cantidad), 0);

    try {
      const res = await fetch("/api/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_cliente: name,
          telefono_cliente: phone,
          direccion_distrito: address,
          metodo_pago: state.selectedPaymentMethod,
          items: itemsPayload,
          total_monto: totalAmount,
          comprobante_url: state.uploadedProofUrl,
          notas: notes
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Error al registrar el pedido");
      }

      const orderData = await res.json();

      // Preparar mensaje de WhatsApp
      const cleanWa = (state.config.whatsapp_ventas || "51944830586").replace(/[^0-9]/g, "");
      let waMsg = `🛍️ *NUEVO PEDIDO WEB - ${state.config.nombre_tienda.toUpperCase()}*\n`;
      waMsg += `📋 *Código:* ${orderData.codigo_pedido}\n\n`;
      waMsg += `👤 *Cliente:* ${name}\n`;
      waMsg += `📱 *Teléfono:* ${phone}\n`;
      waMsg += `📍 *Entrega:* ${address}\n`;
      waMsg += `💳 *Método de Pago:* ${state.selectedPaymentMethod}\n\n`;
      waMsg += `🛒 *DETALLE DEL PEDIDO:*\n`;

      state.cart.forEach(item => {
        waMsg += `• ${item.cantidad}x ${item.nombre} - ${formatMoney(item.precio_venta * item.cantidad)}\n`;
      });

      waMsg += `\n💰 *TOTAL A PAGAR: ${formatMoney(totalAmount)}*\n`;
      if (notes) waMsg += `📝 *Notas:* ${notes}\n`;
      if (state.uploadedProofUrl) waMsg += `📎 *Comprobante:* Adjunto en sistema web\n`;
      waMsg += `🌐 *Tienda:* ${window.location.origin}/tienda\n\n`;
      waMsg += `¡Hola! He registrado mi pedido en la tienda web y quedo atento para coordinar la entrega.`;

      const waUrl = `https://wa.me/${cleanWa}?text=${encodeURIComponent(waMsg)}`;

      // Vaciar carrito
      state.cart = [];
      saveCart();
      toggleCartDrawer(false);

      // Mostrar modal de éxito
      if (DOM.orderSuccessCode) DOM.orderSuccessCode.textContent = orderData.codigo_pedido;
      if (DOM.orderSuccessTotal) DOM.orderSuccessTotal.textContent = formatMoney(totalAmount);
      if (DOM.btnSendOrderWaNow) {
        DOM.btnSendOrderWaNow.onclick = () => window.open(waUrl, "_blank");
      }
      if (DOM.orderSuccessModal) DOM.orderSuccessModal.style.display = "flex";

      // Abrir WhatsApp automáticamente
      window.open(waUrl, "_blank");

    } catch (err) {
      console.error(err);
      alert(err.message || "Error al procesar el pedido. Intenta nuevamente.");
    } finally {
      DOM.btnSubmitOrder.disabled = false;
      selectPaymentMethod(state.selectedPaymentMethod);
    }
  }

  // EVENTOS
  function setupEvents() {
    // Carrito drawer apertura y cierre
    if (DOM.btnOpenCart) DOM.btnOpenCart.addEventListener("click", () => toggleCartDrawer(true));
    if (DOM.btnCloseDrawer) DOM.btnCloseDrawer.addEventListener("click", () => toggleCartDrawer(false));
    if (DOM.cartDrawerOverlay) DOM.cartDrawerOverlay.addEventListener("click", () => toggleCartDrawer(false));

    // Botones de "Seguir Comprando"
    if (DOM.btnContinueTop) DOM.btnContinueTop.addEventListener("click", () => toggleCartDrawer(false));
    if (DOM.btnKeepShopping) DOM.btnKeepShopping.addEventListener("click", () => toggleCartDrawer(false));
    if (DOM.btnEmptyKeepShopping) DOM.btnEmptyKeepShopping.addEventListener("click", () => toggleCartDrawer(false));

    // Toast actions
    if (DOM.btnToastContinue) DOM.btnToastContinue.addEventListener("click", hideStoreToast);
    if (DOM.btnToastViewCart) {
      DOM.btnToastViewCart.addEventListener("click", () => {
        hideStoreToast();
        toggleCartDrawer(true);
      });
    }

    // Tecla Escape para cerrar drawer o toast
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        toggleCartDrawer(false);
        hideStoreToast();
      }
    });

    // Delegación de eventos para agregar productos al carrito
    if (DOM.productsGrid) {
      DOM.productsGrid.addEventListener("click", (e) => {
        const btn = e.target.closest(".btn-add-cart");
        if (btn) {
          e.preventDefault();
          const id = Number(btn.dataset.id);
          addToCart(id, btn);
        }
      });
    }

    // Buscador
    if (DOM.storeSearchInput) {
      DOM.storeSearchInput.addEventListener("input", (e) => {
        state.searchQuery = e.target.value;
        renderProducts();
      });
    }

    // Filtros por estado
    DOM.filterChips.forEach(btn => {
      btn.addEventListener("click", () => {
        DOM.filterChips.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeFilter = btn.dataset.estado;
        renderProducts();
      });
    });

    // Selector de moneda
    DOM.currBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        DOM.currBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        state.currency = btn.dataset.curr;
        renderProducts();
        updateCartUI();
      });
    });

    // Selector de método de pago
    DOM.payOptionPills.forEach(pill => {
      pill.addEventListener("click", () => {
        selectPaymentMethod(pill.dataset.method);
      });
    });

    // Subida de comprobante
    if (DOM.fileProofUpload) {
      DOM.fileProofUpload.addEventListener("change", (e) => {
        if (e.target.files && e.target.files[0]) {
          handleProofUpload(e.target.files[0]);
        }
      });
    }

    // Envío de formulario
    if (DOM.formCheckout) {
      DOM.formCheckout.addEventListener("submit", handleOrderSubmit);
    }

    // Modal éxito
    if (DOM.btnCloseOrderModal && DOM.orderSuccessModal) {
      DOM.btnCloseOrderModal.addEventListener("click", () => {
        DOM.orderSuccessModal.style.display = "none";
      });
    }
  }

  init();
});
