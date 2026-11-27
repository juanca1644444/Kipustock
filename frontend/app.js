/**
 * KIPUSTOCK - ARBITRAJE COMERCIAL & GESTIÓN DE INVENTARIO
 * Lógica de Frontend e Integración con API REST Local (Fase 1)
 */

document.addEventListener("DOMContentLoaded", () => {
  // Placeholder neutral SVG para evitar fotos falsas de otros productos
  const NEUTRAL_PLACEHOLDER = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22400%22%20height%3D%22400%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%221.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20width%3D%2218%22%20height%3D%2218%22%20x%3D%223%22%20y%3D%223%22%20rx%3D%222%22%20ry%3D%222%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%229%22%20r%3D%222%22%2F%3E%3Cpath%20d%3D%22m21%2015-3.086-3.086a2%202%200%200%200-2.828%200L6%2021%22%2F%3E%3C%2Fsvg%3E";

  // ==========================================
  // ESTADO GLOBAL DE LA APLICACIÓN
  // ==========================================
  const ALL_SUPPORTED_STORES = [
    { id: "Falabella", name: "Falabella Perú", icon: "🛒", badge: "Catálogo en vivo" },
    { id: "Ripley", name: "Ripley Perú", icon: "🛍️", badge: "Catálogo en vivo" },
    { id: "Sodimac", name: "Sodimac Perú", icon: "🔨", badge: "Hogar y herramientas" },
    { id: "KAYAK", name: "KAYAK Vuelos & Viajes", icon: "✈️", badge: "Pasajes y aerolíneas" },
    { id: "Facebook Marketplace", name: "Facebook Marketplace", icon: "👥", badge: "Arbitraje P2P" },
    { id: "Mercado Libre", name: "Mercado Libre Perú", icon: "📦", badge: "Marketplace nacional" },
    { id: "Temu", name: "Temu", icon: "🧡", badge: "Importación y ofertas" },
    { id: "AliExpress", name: "AliExpress", icon: "🌐", badge: "Mayorista internacional" },
    { id: "Web / Google Shopping", name: "Web / Google Shopping", icon: "🔍", badge: "Web abierta" },
    { id: "PlazaVea", name: "PlazaVea Perú", icon: "🛒", badge: "Supermercado y electro" },
    { id: "Promart", name: "Promart Perú", icon: "🛠️", badge: "Homecenter Perú" }
  ];

  const state = {
    currency: "PEN",          // "PEN" (S/) o "USD" ($)
    exchangeRate: 3.75,       // S/ 3.75 por USD
    inventory: [],
    lotItems: [],
    lotSummary: {
      inversion_nueva: 0,
      stock_propio_valor: 0,
      ingreso_bruto_proyectado: 0,
      ganancia_neta_total: 0,
      margen_promedio_porcentaje: 0,
      total_unidades: 0,
      total_items: 0
    },
    searchResults: [],
    estadoTiendas: [],
    tiendasEstado: [],
    selectedSites: ["Falabella", "Ripley", "Sodimac"], // Tiendas activas por defecto
    lastQuery: "",
    uploadedSearchImage: null,
    uploadedProdImage: null,
    currentInventoryMatch: null,
    sales: [],
    alerts: [],
    webOrders: [],
    customStores: [],
    storeConfig: {},
    crmClients: [],
    shippingRates: [],
    quoteItems: [],
    currentQuote: null,
    salesSummary: {
      total_ventas_monto: 0,
      total_costos_monto: 0,
      total_comisiones_envio: 0,
      ganancia_neta_acumulada: 0,
      total_unidades_vendidas: 0,
      total_operaciones: 0,
      margen_promedio_porcentaje: 0
    },
    tunnel: {
      active: false,
      public_url: null,
      store_url: null,
      is_starting: false,
      last_error: null
    }
  };

  // ==========================================
  // ELEMENTOS DOM
  // ==========================================
  const DOM = {
    // Moneda & Tabs
    currencyBtns: document.querySelectorAll(".curr-btn"),
    currencySymbols: document.querySelectorAll(".currency-symbol"),
    navTabs: document.querySelectorAll(".nav-tab"),
    tabContents: document.querySelectorAll(".tab-content"),
    openLotQuickBtn: document.getElementById("openLotQuickBtn"),
    lotBadgeCount: document.getElementById("lotBadgeCount"),
    inventoryCounter: document.getElementById("inventoryCounter"),
    lotCounterTab: document.getElementById("lotCounterTab"),
    salesCounterTab: document.getElementById("salesCounterTab"),

    // KPIs de Ventas
    kpiSalesRevenue: document.getElementById("kpiSalesRevenue"),
    kpiSalesCost: document.getElementById("kpiSalesCost"),
    kpiSalesProfit: document.getElementById("kpiSalesProfit"),
    kpiSalesMargin: document.getElementById("kpiSalesMargin"),
    kpiSalesCount: document.getElementById("kpiSalesCount"),
    kpiSalesUnits: document.getElementById("kpiSalesUnits"),

    // Formulario de Ventas
    formNewSale: document.getElementById("formNewSale"),
    labelSourceInventory: document.getElementById("labelSourceInventory"),
    labelSourceManual: document.getElementById("labelSourceManual"),
    groupSaleInventorySelect: document.getElementById("groupSaleInventorySelect"),
    saleInventoryProductSelect: document.getElementById("saleInventoryProductSelect"),
    saleStockAlert: document.getElementById("saleStockAlert"),
    saleStockAlertText: document.getElementById("saleStockAlertText"),
    saleProductName: document.getElementById("saleProductName"),
    saleQuantity: document.getElementById("saleQuantity"),
    saleChannel: document.getElementById("saleChannel"),
    saleUnitCost: document.getElementById("saleUnitCost"),
    saleUnitPrice: document.getElementById("saleUnitPrice"),
    saleCommissionDelivery: document.getElementById("saleCommissionDelivery"),
    saleNotes: document.getElementById("saleNotes"),
    saleCustomerPhone: document.getElementById("saleCustomerPhone"),
    saleCalcMarginPct: document.getElementById("saleCalcMarginPct"),
    saleCalcGross: document.getElementById("saleCalcGross"),
    saleCalcCost: document.getElementById("saleCalcCost"),
    saleCalcFees: document.getElementById("saleCalcFees"),
    saleCalcNetProfit: document.getElementById("saleCalcNetProfit"),
    btnSubmitSale: document.getElementById("btnSubmitSale"),

    // Historial de Ventas
    salesSearchFilter: document.getElementById("salesSearchFilter"),
    salesTableBody: document.getElementById("salesTableBody"),
    salesEmptyState: document.getElementById("salesEmptyState"),

    // Tienda Web & Pedidos
    webOrdersPendingBadge: document.getElementById("webOrdersPendingBadge"),
    kpiWebPendingOrders: document.getElementById("kpiWebPendingOrders"),
    kpiWebTotalOrders: document.getElementById("kpiWebTotalOrders"),
    kpiWebApprovedOrders: document.getElementById("kpiWebApprovedOrders"),
    kpiWebTotalRevenue: document.getElementById("kpiWebTotalRevenue"),
    formStoreConfig: document.getElementById("formStoreConfig"),
    storeCfgName: document.getElementById("storeCfgName"),
    storeCfgPhone: document.getElementById("storeCfgPhone"),
    storeCfgWelcome: document.getElementById("storeCfgWelcome"),
    storeCfgInstructions: document.getElementById("storeCfgInstructions"),
    storeCfgQrYapePreview: document.getElementById("storeCfgQrYapePreview"),
    storeCfgQrYapeFile: document.getElementById("storeCfgQrYapeFile"),
    storeCfgQrYapeStatus: document.getElementById("storeCfgQrYapeStatus"),
    storeCfgQrPlinPreview: document.getElementById("storeCfgQrPlinPreview"),
    storeCfgQrPlinFile: document.getElementById("storeCfgQrPlinFile"),
    storeCfgQrPlinStatus: document.getElementById("storeCfgQrPlinStatus"),
    btnSaveStoreConfig: document.getElementById("btnSaveStoreConfig"),
    btnRefreshWebOrders: document.getElementById("btnRefreshWebOrders"),
    webOrdersFilter: document.getElementById("webOrdersFilter"),
    webOrdersTableBody: document.getElementById("webOrdersTableBody"),
    webOrdersEmptyState: document.getElementById("webOrdersEmptyState"),
    webOrderDetailModal: document.getElementById("webOrderDetailModal"),
    webOrderModalTitle: document.getElementById("webOrderModalTitle"),
    webModalCustName: document.getElementById("webModalCustName"),
    webModalStatusBadge: document.getElementById("webModalStatusBadge"),
    webModalCustDetails: document.getElementById("webModalCustDetails"),
    webModalItemsList: document.getElementById("webModalItemsList"),
    webModalTotalAmount: document.getElementById("webModalTotalAmount"),
    webModalProofWrap: document.getElementById("webModalProofWrap"),
    webModalProofImg: document.getElementById("webModalProofImg"),
    webModalProofLink: document.getElementById("webModalProofLink"),
    btnCloseWebOrderModal: document.getElementById("btnCloseWebOrderModal"),
    btnWebModalReject: document.getElementById("btnWebModalReject"),
    btnWebModalWa: document.getElementById("btnWebModalWa"),
    btnWebModalPurchased: document.getElementById("btnWebModalPurchased"),
    btnWebModalInDelivery: document.getElementById("btnWebModalInDelivery"),
    btnWebModalCodComplete: document.getElementById("btnWebModalCodComplete"),
    btnWebModalApprove: document.getElementById("btnWebModalApprove"),

    // Campañas y Redes Sociales
    campaignSelectProduct: document.getElementById("campaignSelectProduct"),
    campaignInputTitle: document.getElementById("campaignInputTitle"),
    campaignInputModel: document.getElementById("campaignInputModel"),
    campaignSelectEstado: document.getElementById("campaignSelectEstado"),
    campaignInputPrice: document.getElementById("campaignInputPrice"),
    campaignInputOfferPrice: document.getElementById("campaignInputOfferPrice"),
    campaignInputMargin: document.getElementById("campaignInputMargin"),
    campaignInputStock: document.getElementById("campaignInputStock"),
    campaignSelectTone: document.getElementById("campaignSelectTone"),
    campaignInputStoreUrl: document.getElementById("campaignInputStoreUrl"),
    campaignInputWa: document.getElementById("campaignInputWa"),
    campaignFmt1x1: document.getElementById("campaignFmt1x1"),
    campaignFmt9x16: document.getElementById("campaignFmt9x16"),
    campaignChanMarketplace: document.getElementById("campaignChanMarketplace"),
    campaignChanStories: document.getElementById("campaignChanStories"),
    campaignChanWaBroadcast: document.getElementById("campaignChanWaBroadcast"),
    campaignChanEmail: document.getElementById("campaignChanEmail"),
    campaignHiddenPhotoUrl: document.getElementById("campaignHiddenPhotoUrl"),
    campaignHiddenProdId: document.getElementById("campaignHiddenProdId"),
    campaignHiddenItemLoteId: document.getElementById("campaignHiddenItemLoteId"),
    formCampaignGenerator: document.getElementById("formCampaignGenerator"),
    btnSubmitCampaign: document.getElementById("btnSubmitCampaign"),
    campaignBtnIcon: document.getElementById("campaignBtnIcon"),
    campaignBtnText: document.getElementById("campaignBtnText"),
    campaignResultsContainer: document.getElementById("campaignResultsContainer"),
    resCampaignProdTitle: document.getElementById("resCampaignProdTitle"),
    resCampaignToneSub: document.getElementById("resCampaignToneSub"),
    btnDownloadCampaignZip: document.getElementById("btnDownloadCampaignZip"),
    btnCampaignShareDirectWa: document.getElementById("btnCampaignShareDirectWa"),
    imgCampaignFeed1x1: document.getElementById("imgCampaignFeed1x1"),
    imgCampaignStory9x16: document.getElementById("imgCampaignStory9x16"),
    linkDownloadFeedSingle: document.getElementById("linkDownloadFeedSingle"),
    linkDownloadStorySingle: document.getElementById("linkDownloadStorySingle"),
    copyTextMarketplace: document.getElementById("copyTextMarketplace"),
    copyTextStoriesReels: document.getElementById("copyTextStoriesReels"),
    copyTextWaBroadcast: document.getElementById("copyTextWaBroadcast"),
    copyTextEmailPromo: document.getElementById("copyTextEmailPromo"),
    copyTextFbIg: document.getElementById("copyTextFbIg"),
    copyTextWaStatus: document.getElementById("copyTextWaStatus"),
    copyTextTikTok: document.getElementById("copyTextTikTok"),

    // Cloudflare Tunnel & Publicación Tienda
    btnHeaderTunnel: document.getElementById("btnHeaderTunnel"),
    headerTunnelDot: document.getElementById("headerTunnelDot"),
    headerTunnelLabel: document.getElementById("headerTunnelLabel"),
    headerStoreLink: document.getElementById("headerStoreLink"),
    storeTabOpenStoreBtn: document.getElementById("storeTabOpenStoreBtn"),
    storeTabTunnelStatusHint: document.getElementById("storeTabTunnelStatusHint"),
    campaignViewStoreLink: document.getElementById("campaignViewStoreLink"),
    tunnelModal: document.getElementById("tunnelModal"),
    btnCloseTunnelModal: document.getElementById("btnCloseTunnelModal"),
    btnCloseTunnelModalFooter: document.getElementById("btnCloseTunnelModalFooter"),
    tunnelStatusDot: document.getElementById("tunnelStatusDot"),
    tunnelStatusText: document.getElementById("tunnelStatusText"),
    tunnelStatusSub: document.getElementById("tunnelStatusSub"),
    btnStartTunnel: document.getElementById("btnStartTunnel"),
    btnStopTunnel: document.getElementById("btnStopTunnel"),
    tunnelLoadingBox: document.getElementById("tunnelLoadingBox"),
    tunnelLoadingMsg: document.getElementById("tunnelLoadingMsg"),
    tunnelActiveInfoBox: document.getElementById("tunnelActiveInfoBox"),
    tunnelPublicUrlInput: document.getElementById("tunnelPublicUrlInput"),
    btnCopyTunnelUrl: document.getElementById("btnCopyTunnelUrl"),
    btnOpenTunnelExternal: document.getElementById("btnOpenTunnelExternal"),
    tunnelQrCodeImg: document.getElementById("tunnelQrCodeImg"),
    btnDownloadTunnelQr: document.getElementById("btnDownloadTunnelQr"),
    tunnelCardStatusBadge: document.getElementById("tunnelCardStatusBadge"),
    tunnelCardDesc: document.getElementById("tunnelCardDesc"),
    btnTunnelInlineStart: document.getElementById("btnTunnelInlineStart"),
    btnTunnelInlineStop: document.getElementById("btnTunnelInlineStop"),
    btnTunnelInlineOpenModal: document.getElementById("btnTunnelInlineOpenModal"),
    tunnelInlineActiveRow: document.getElementById("tunnelInlineActiveRow"),
    tunnelInlineUrlInput: document.getElementById("tunnelInlineUrlInput"),
    btnTunnelInlineCopy: document.getElementById("btnTunnelInlineCopy"),
    btnTunnelInlineVisit: document.getElementById("btnTunnelInlineVisit"),
    btnToggleFixedDomainConfig: document.getElementById("btnToggleFixedDomainConfig"),
    fixedDomainConfigBody: document.getElementById("fixedDomainConfigBody"),
    fixedConfigChevron: document.getElementById("fixedConfigChevron"),
    badgeFixedConfigActive: document.getElementById("badgeFixedConfigActive"),
    tunnelFixedDomainInput: document.getElementById("tunnelFixedDomainInput"),
    tunnelTokenInput: document.getElementById("tunnelTokenInput"),
    btnSaveTunnelConfig: document.getElementById("btnSaveTunnelConfig"),
    btnResetTunnelConfig: document.getElementById("btnResetTunnelConfig"),
    tunnelConfigFeedback: document.getElementById("tunnelConfigFeedback"),

    // Buscador
    searchForm: document.getElementById("searchForm"),
    searchQuery: document.getElementById("searchQuery"),
    clearSearchQuery: document.getElementById("clearSearchQuery"),
    btnSubmitSearch: document.getElementById("btnSubmitSearch"),
    imageDropZone: document.getElementById("imageDropZone"),
    searchImageFile: document.getElementById("searchImageFile"),
    dropPrompt: document.getElementById("dropPrompt"),
    btnSelectSearchImage: document.getElementById("btnSelectSearchImage"),
    btnPasteSearchImage: document.getElementById("btnPasteSearchImage"),
    searchImagePreviewContainer: document.getElementById("searchImagePreviewContainer"),
    searchImagePreview: document.getElementById("searchImagePreview"),
    previewImageName: document.getElementById("previewImageName"),
    btnRemoveSearchImage: document.getElementById("btnRemoveSearchImage"),

    // Gestor de Portales Seleccionables
    selectStoreToAdd: document.getElementById("selectStoreToAdd"),
    optgroupCustomStores: document.getElementById("optgroupCustomStores"),
    btnAddSelectedStore: document.getElementById("btnAddSelectedStore"),
    activeSitesContainer: document.getElementById("activeSitesContainer"),
    activeSitesBadge: document.getElementById("activeSitesBadge"),
    btnSelectAllSites: document.getElementById("btnSelectAllSites"),
    btnClearAllSites: document.getElementById("btnClearAllSites"),
    hiddenSiteInputs: document.getElementById("hiddenSiteInputs"),

    // Modal de Tiendas y Proveedores Personalizados
    btnOpenCustomStoresModal: document.getElementById("btnOpenCustomStoresModal"),
    customStoresModal: document.getElementById("customStoresModal"),
    btnCloseCustomStoresModal: document.getElementById("btnCloseCustomStoresModal"),
    customStoreForm: document.getElementById("customStoreForm"),
    csStoreId: document.getElementById("csStoreId"),
    csNombre: document.getElementById("csNombre"),
    csUrlWeb: document.getElementById("csUrlWeb"),
    csUrlBusqueda: document.getElementById("csUrlBusqueda"),
    csCategoria: document.getElementById("csCategoria"),
    csWhatsapp: document.getElementById("csWhatsapp"),
    csComision: document.getElementById("csComision"),
    csNotas: document.getElementById("csNotas"),
    btnCancelEditCustomStore: document.getElementById("btnCancelEditCustomStore"),
    customStoresTableBody: document.getElementById("customStoresTableBody"),
    csEmptyState: document.getElementById("csEmptyState"),
    csCount: document.getElementById("csCount"),

    filterMaxPrice: document.getElementById("filterMaxPrice"),
    filterMinMargin: document.getElementById("filterMinMargin"),
    filterCommission: document.getElementById("filterCommission"),
    aiStatusBadge: document.getElementById("aiStatusBadge"),
    aiStatusBadgeText: document.getElementById("aiStatusBadgeText"),
    visionAiAnalysisCard: document.getElementById("visionAiAnalysisCard"),
    visionAiStatusTitle: document.getElementById("visionAiStatusTitle"),
    visionAiCategoryTag: document.getElementById("visionAiCategoryTag"),
    visionAiProdTitle: document.getElementById("visionAiProdTitle"),
    visionAiModelText: document.getElementById("visionAiModelText"),
    visionAiQueriesList: document.getElementById("visionAiQueriesList"),
    visionAiPriceRef: document.getElementById("visionAiPriceRef"),
    searchLoadingIndicator: document.getElementById("searchLoadingIndicator"),
    loadingMainTitle: document.getElementById("loadingMainTitle"),
    loadingSubTitle: document.getElementById("loadingSubTitle"),
    storeStatusBar: document.getElementById("storeStatusBar"),
    inventoryMatchAlert: document.getElementById("inventoryMatchAlert"),
    inventoryMatchText: document.getElementById("inventoryMatchText"),
    btnGoToInventoryMatch: document.getElementById("btnGoToInventoryMatch"),
    resultsGrid: document.getElementById("resultsGrid"),
    resultsEmptyState: document.getElementById("resultsEmptyState"),
    resultsCountText: document.getElementById("resultsCountText"),
    resultsTimeBadge: document.getElementById("resultsTimeBadge"),
    resultsCacheBadge: document.getElementById("resultsCacheBadge"),
    resultsBroadenedBadge: document.getElementById("resultsBroadenedBadge"),
    storeBlockedAlertBanner: document.getElementById("storeBlockedAlertBanner"),
    storeCategoryNoticeBanner: document.getElementById("storeCategoryNoticeBanner"),
    storeCategoryNoticeText: document.getElementById("storeCategoryNoticeText"),
    blockedAlertTitle: document.getElementById("blockedAlertTitle"),
    blockedAlertDesc: document.getElementById("blockedAlertDesc"),
    blockedAlertActions: document.getElementById("blockedAlertActions"),
    quickChipsContainer: document.getElementById("quickChipsContainer"),
    quickSuggestionsBar: document.getElementById("quickSuggestionsBar"),
    sortResultsBy: document.getElementById("sortResultsBy"),

    // Monitor de Oportunidades & Watchlist
    btnToggleNewAlertForm: document.getElementById("btnToggleNewAlertForm"),
    btnRunAlertsScan: document.getElementById("btnRunAlertsScan"),
    newAlertFormWrap: document.getElementById("newAlertFormWrap"),
    formNewAlert: document.getElementById("formNewAlert"),
    alertTerm: document.getElementById("alertTerm"),
    alertMaxPrice: document.getElementById("alertMaxPrice"),
    alertMinMargin: document.getElementById("alertMinMargin"),
    btnCancelAlert: document.getElementById("btnCancelAlert"),
    alertsContainer: document.getElementById("alertsContainer"),
    alertsResultsContainer: document.getElementById("alertsResultsContainer"),
    alertsResultsTitle: document.getElementById("alertsResultsTitle"),
    alertsMatchesGrid: document.getElementById("alertsMatchesGrid"),
    btnCloseAlertsResults: document.getElementById("btnCloseAlertsResults"),

    // Inventario Propio
    newProductForm: document.getElementById("newProductForm"),
    prodName: document.getElementById("prodName"),
    prodModel: document.getElementById("prodModel"),
    prodStatus: document.getElementById("prodStatus"),
    prodPhotoInput: document.getElementById("prodPhotoInput"),
    btnUploadProdPhoto: document.getElementById("btnUploadProdPhoto"),
    btnPasteProdPhoto: document.getElementById("btnPasteProdPhoto"),
    btnAiAutocompleteProd: document.getElementById("btnAiAutocompleteProd"),
    btnGenerateCatalogPhoto: document.getElementById("btnGenerateCatalogPhoto"),
    prodPhotoPreviewCard: document.getElementById("prodPhotoPreviewCard"),
    prodPhotoEmptyState: document.getElementById("prodPhotoEmptyState"),
    prodPhotoActiveState: document.getElementById("prodPhotoActiveState"),
    prodLargePreviewImg: document.getElementById("prodLargePreviewImg"),
    prodPhotoTagChip: document.getElementById("prodPhotoTagChip"),
    prodPhotoTitleText: document.getElementById("prodPhotoTitleText"),
    prodPhotoBadge: document.getElementById("prodPhotoBadge"),
    prodPhotoLoading: document.getElementById("prodPhotoLoading"),
    prodPhotoLoadingText: document.getElementById("prodPhotoLoadingText"),
    btnRemoveProdPhoto: document.getElementById("btnRemoveProdPhoto"),
    prodPhotoName: document.getElementById("prodPhotoName"),
    prodVisionAiCard: document.getElementById("prodVisionAiCard"),
    prodVisionAiBadgeText: document.getElementById("prodVisionAiBadgeText"),
    prodVisionCategory: document.getElementById("prodVisionCategory"),
    prodVisionTitle: document.getElementById("prodVisionTitle"),
    prodVisionModel: document.getElementById("prodVisionModel"),
    prodVisionPrice: document.getElementById("prodVisionPrice"),
    prodThumbPreview: document.getElementById("prodThumbPreview"),
    prodStock: document.getElementById("prodStock"),
    prodCost: document.getElementById("prodCost"),
    prodPrice: document.getElementById("prodPrice"),
    prodNotes: document.getElementById("prodNotes"),
    calcUnitMargin: document.getElementById("calcUnitMargin"),
    calcMarginPct: document.getElementById("calcMarginPct"),
    calcTotalProfit: document.getElementById("calcTotalProfit"),
    inventoryTableBody: document.getElementById("inventoryTableBody"),
    inventoryEmptyState: document.getElementById("inventoryEmptyState"),
    inventorySearchFilter: document.getElementById("inventorySearchFilter"),

    // Lote de Operación
    kpiNewInvestment: document.getElementById("kpiNewInvestment"),
    kpiOwnStockValue: document.getElementById("kpiOwnStockValue"),
    kpiGrossIncome: document.getElementById("kpiGrossIncome"),
    kpiNetProfit: document.getElementById("kpiNetProfit"),
    kpiAverageMargin: document.getElementById("kpiAverageMargin"),
    lotTableBody: document.getElementById("lotTableBody"),
    lotEmptyState: document.getElementById("lotEmptyState"),
    btnClearLot: document.getElementById("btnClearLot"),
    btnExportLotSummary: document.getElementById("btnExportLotSummary"),
    btnExportLotCsv: document.getElementById("btnExportLotCsv"),
    btnExportSalesCsv: document.getElementById("btnExportSalesCsv"),
    btnOpenSocialPostModal: document.getElementById("btnOpenSocialPostModal"),
    btnOpenConfirmLotSalesModal: document.getElementById("btnOpenConfirmLotSalesModal"),

    // Modal Confirmar Ventas de Lote Completo
    confirmLotSalesModal: document.getElementById("confirmLotSalesModal"),
    btnCloseConfirmLotSalesModal: document.getElementById("btnCloseConfirmLotSalesModal"),
    btnCancelConfirmLotSales: document.getElementById("btnCancelConfirmLotSales"),
    btnExecuteLotSales: document.getElementById("btnExecuteLotSales"),
    lotSalesModalPreview: document.getElementById("lotSalesModalPreview"),
    lotSaleChannel: document.getElementById("lotSaleChannel"),
    lotSaleGlobalCommission: document.getElementById("lotSaleGlobalCommission"),
    lotSaleClearCheck: document.getElementById("lotSaleClearCheck"),

    // Modal Exportar
    exportModal: document.getElementById("exportModal"),
    btnCloseExportModal: document.getElementById("btnCloseExportModal"),
    exportSummaryContent: document.getElementById("exportSummaryContent"),
    btnCopyExportText: document.getElementById("btnCopyExportText"),
    btnDownloadExportFile: document.getElementById("btnDownloadExportFile"),

    // Modal Crear Post Redes IA
    socialPostModal: document.getElementById("socialPostModal"),
    btnCloseSocialPostModal: document.getElementById("btnCloseSocialPostModal"),
    btnCancelSocialPostModal: document.getElementById("btnCancelSocialPostModal"),
    postProdSelect: document.getElementById("postProdSelect"),
    postProdName: document.getElementById("postProdName"),
    postProdDesc: document.getElementById("postProdDesc"),
    postStyleCards: document.querySelectorAll(".style-option-card"),
    postGenerateCopy: document.getElementById("postGenerateCopy"),
    btnSubmitGeneratePost: document.getElementById("btnSubmitGeneratePost"),
    postLoadingIndicator: document.getElementById("postLoadingIndicator"),
    postResultContainer: document.getElementById("postResultContainer"),
    postEmptyState: document.getElementById("postEmptyState"),
    postResultImage: document.getElementById("postResultImage"),
    btnDownloadPostImage: document.getElementById("btnDownloadPostImage"),
    postResultCopy: document.getElementById("postResultCopy"),
    btnCopyPostText: document.getElementById("btnCopyPostText"),

    // Modal Seguro de Enlaces de Tienda Externa
    storeLinkModal: document.getElementById("storeLinkModal"),
    storeModalTitle: document.getElementById("storeModalTitle"),
    storeModalSubtitle: document.getElementById("storeModalSubtitle"),
    storeModalUrlInput: document.getElementById("storeModalUrlInput"),
    btnCloseStoreModal: document.getElementById("btnCloseStoreModal"),
    btnCopyStoreModalUrl: document.getElementById("btnCopyStoreModalUrl"),
    btnStayInKipu: document.getElementById("btnStayInKipu"),
    btnOpenStoreExternal: document.getElementById("btnOpenStoreExternal"),

    // Toasts
    toastContainer: document.getElementById("toastContainer")
  };

  // ==========================================
  // HELPERS DE FORMATO Y MONEDA
  // ==========================================

  /**
   * Convierte y formatea un monto (que en BD está en Soles PEN)
   * a la moneda seleccionada por el usuario (PEN o USD).
   */
  function formatMoney(amountInPEN) {
    if (isNaN(amountInPEN) || amountInPEN === null) amountInPEN = 0;
    if (state.currency === "USD") {
      const usd = amountInPEN / state.exchangeRate;
      return `$ ${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `S/ ${amountInPEN.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function getCurrencySymbol() {
    return state.currency === "USD" ? "$" : "S/";
  }

  function updateCurrencyUI() {
    DOM.currencySymbols.forEach(el => {
      el.textContent = getCurrencySymbol();
    });
    // Re-renderizar vistas afectadas
    renderSearchResults();
    renderInventoryTable();
    renderLotView();
    renderSales();
    updateLiveCalc();
    updateSaleLiveCalc();
  }

  function showToast(message, type = "success", duration = 3500) {
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    const icon = type === "success" ? "✓" : type === "warning" ? "⚠️" : type === "info" ? "ℹ️" : "✕";
    toast.innerHTML = `
      <span>${icon}</span>
      <span>${message}</span>
    `;
    DOM.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(30px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ==========================================
  // NAVEGACIÓN POR PESTAÑAS
  // ==========================================
  function switchTab(targetTabId) {
    DOM.navTabs.forEach(tab => {
      if (tab.dataset.tab === targetTabId) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });

    DOM.tabContents.forEach(content => {
      if (content.id === targetTabId) {
        content.classList.add("active");
      } else {
        content.classList.remove("active");
      }
    });

    if (targetTabId === "tab-crm") {
      if (typeof loadCrmClients === "function") loadCrmClients();
      if (typeof loadShippingRates === "function") loadShippingRates();
      if (typeof populateQuoteProductSelect === "function") populateQuoteProductSelect();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  DOM.navTabs.forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  DOM.openLotQuickBtn.addEventListener("click", () => switchTab("tab-lot"));

  // Selector de moneda
  DOM.currencyBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      DOM.currencyBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.currency = btn.dataset.curr;
      updateCurrencyUI();
      showToast(`Moneda cambiada a ${state.currency} (${getCurrencySymbol()})`, "success");
    });
  });

  // ==========================================
  // SECCIÓN A: BUSCADOR DE MERCADERÍAS
  // ==========================================

  // Manejador Drag & Drop para foto de producto
  ["dragenter", "dragover"].forEach(eventName => {
    DOM.imageDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      DOM.imageDropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach(eventName => {
    DOM.imageDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      DOM.imageDropZone.classList.remove("drag-over");
    });
  });

  DOM.imageDropZone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      handleSearchImageSelected(files[0]);
    }
  });

  DOM.btnSelectSearchImage.addEventListener("click", () => DOM.searchImageFile.click());
  DOM.searchImageFile.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      handleSearchImageSelected(e.target.files[0]);
    }
  });

  // ==========================================
  // SOPORTE PARA PEGAR IMÁGENES (CLIPBOARD / CTRL + V)
  // ==========================================
  function extractImageFromClipboard(clipboardData) {
    if (!clipboardData) return null;
    if (clipboardData.items) {
      for (let i = 0; i < clipboardData.items.length; i++) {
        const item = clipboardData.items[i];
        if (item.type && item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
            const fileName = `captura_pegada_${Date.now()}.${ext}`;
            return new File([blob], fileName, { type: blob.type });
          }
        }
      }
    }
    if (clipboardData.files && clipboardData.files.length > 0) {
      for (let i = 0; i < clipboardData.files.length; i++) {
        const file = clipboardData.files[i];
        if (file.type && file.type.startsWith("image/")) {
          return file;
        }
      }
    }
    return null;
  }

  // Pegado directo enfocado sobre la zona de arrastre
  if (DOM.imageDropZone) {
    DOM.imageDropZone.addEventListener("paste", (e) => {
      const file = extractImageFromClipboard(e.clipboardData);
      if (file) {
        e.preventDefault();
        e.stopPropagation();
        DOM.imageDropZone.classList.add("paste-pulse");
        setTimeout(() => DOM.imageDropZone.classList.remove("paste-pulse"), 500);
        showToast("📋 Imagen pegada con éxito (Ctrl + V)", "success");
        handleSearchImageSelected(file);
      }
    });
  }

  // Botón explícito para pegar desde el portapapeles
  if (DOM.btnPasteSearchImage) {
    DOM.btnPasteSearchImage.addEventListener("click", async () => {
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const clipItems = await navigator.clipboard.read();
          for (const item of clipItems) {
            for (const type of item.types) {
              if (type.startsWith("image/")) {
                const blob = await item.getType(type);
                const ext = (type.split("/")[1] || "png").replace("jpeg", "jpg");
                const file = new File([blob], `portapapeles_${Date.now()}.${ext}`, { type });
                if (DOM.imageDropZone) {
                  DOM.imageDropZone.classList.add("paste-pulse");
                  setTimeout(() => DOM.imageDropZone.classList.remove("paste-pulse"), 500);
                }
                showToast("📋 Imagen obtenida del portapapeles con éxito", "success");
                handleSearchImageSelected(file);
                return;
              }
            }
          }
          showToast("No se encontró una imagen en el portapapeles. Copia una imagen con Ctrl + C y presiona Ctrl + V.", "warning");
        } catch (err) {
          DOM.imageDropZone.focus();
          showToast("Presiona Ctrl + V en tu teclado para pegar la imagen directamente.", "info");
        }
      } else {
        DOM.imageDropZone.focus();
        showToast("Presiona Ctrl + V en tu teclado para pegar la imagen copiada.", "info");
      }
    });
  }

  // Soporte global para Ctrl + V de imágenes en cualquier parte de la ventana
  window.addEventListener("paste", (e) => {
    const imageFile = extractImageFromClipboard(e.clipboardData);
    if (!imageFile) {
      // Es texto plano o no es imagen: permitir el comportamiento nativo en inputs y textareas
      return;
    }

    // Si es una imagen en el portapapeles, prevenir comportamiento por defecto
    e.preventDefault();

    const activeTab = document.querySelector(".nav-tab.active");
    const activeTabId = activeTab ? activeTab.dataset.tab : "tab-search";

    if (activeTabId === "tab-inventory") {
      handleProductArticleFile(imageFile);
    } else {
      if (activeTabId !== "tab-search") {
        const searchTabBtn = document.querySelector('.nav-tab[data-tab="tab-search"]');
        if (searchTabBtn) searchTabBtn.click();
      }
      if (DOM.imageDropZone) {
        DOM.imageDropZone.classList.add("paste-pulse");
        setTimeout(() => DOM.imageDropZone.classList.remove("paste-pulse"), 500);
      }
      showToast("📋 Imagen pegada desde el portapapeles (Ctrl + V)", "success");
      handleSearchImageSelected(imageFile);
    }
  });

  function handleSearchImageSelected(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      DOM.searchImagePreview.src = e.target.result;
      DOM.previewImageName.textContent = file.name;
      DOM.dropPrompt.classList.add("hidden");
      DOM.searchImagePreviewContainer.classList.remove("hidden");
    };
    reader.readAsDataURL(file);

    showToast("Analizando imagen con Gemini Vision...", "info");

    // Desplegar de inmediato la tarjeta de análisis con estado de carga para feedback visual instantáneo
    if (DOM.visionAiAnalysisCard) {
      DOM.visionAiAnalysisCard.classList.remove("hidden");
      DOM.visionAiStatusTitle.textContent = "Reconociendo con Gemini Vision...";
      DOM.visionAiProdTitle.textContent = "Analizando fotografía con IA...";
      DOM.visionAiModelText.textContent = "Identificando modelo, marca y cotización de referencia...";
      DOM.visionAiCategoryTag.textContent = "Escaneando...";
      DOM.visionAiPriceRef.textContent = "S/ --.--";
      DOM.visionAiQueriesList.innerHTML = `<span class="query-chip" style="opacity: 0.7;">✨ Escaneando características visuales...</span>`;
    }

    // Enviar foto para reconocimiento inteligente multimodal con Gemini
    analyzeImageWithVisionAI(file).then(aiData => {
      state.uploadedSearchImage = aiData.url || file.name;

      // Autocompletar barra de búsqueda con el producto identificado
      if (aiData.producto_identificado) {
        DOM.searchQuery.value = aiData.producto_identificado;
      }

      // Desplegar tarjeta de reconocimiento visual
      if (DOM.visionAiAnalysisCard) {
        DOM.visionAiAnalysisCard.classList.remove("hidden");
        DOM.visionAiProdTitle.textContent = aiData.producto_identificado || file.name;
        DOM.visionAiModelText.textContent = `Marca/Modelo: ${aiData.marca_modelo || 'Genérico'}`;
        DOM.visionAiCategoryTag.textContent = aiData.categoria || 'Comercial';
        DOM.visionAiPriceRef.textContent = formatMoney(aiData.precio_referencia_sugerido || 0);

        if (aiData.ai_status === "success") {
          DOM.visionAiStatusTitle.textContent = "Reconocimiento Gemini Vision";
        } else {
          DOM.visionAiStatusTitle.textContent = "Detección Visual Local";
        }

        // Renderizar tags de consultas sugeridas como pills interactivas
        DOM.visionAiQueriesList.innerHTML = "";
        const queries = aiData.consultas_busqueda || [aiData.producto_identificado];
        queries.forEach(q => {
          if (!q) return;
          const chip = document.createElement("span");
          chip.className = "query-chip";
          chip.textContent = q;
          chip.title = "Buscar con este término exacto";
          chip.addEventListener("click", () => {
            DOM.searchQuery.value = q;
            performSearch();
          });
          DOM.visionAiQueriesList.appendChild(chip);
        });

        // Si se reconoce un pasaje aéreo o vuelo, asegurar que KAYAK esté en las tiendas activas
        const travelTerms = ["pasaje", "vuelo", "jetsmart", "latam", "sky airline", "kayak", "aerolínea"];
        const isTravelDetected = (aiData.categoria && aiData.categoria.toLowerCase().includes("vuelo")) ||
          travelTerms.some(term => (aiData.producto_identificado || "").toLowerCase().includes(term));
        if (isTravelDetected) {
          if (!state.selectedSites.includes("KAYAK")) {
            state.selectedSites.push("KAYAK");
            renderActiveSites();
            showToast("✈️ Pasaje aéreo detectado: Se añadió KAYAK a tus tiendas activas.", "info");
          }
        }
      }

      showToast("✨ Producto reconocido con IA. Iniciando rastreo...", "success");

      // Iniciar búsqueda automáticamente
      performSearch();
    }).catch(err => {
      console.error("Error analizando imagen:", err);
      showToast("Aviso: No se pudo contactar con Gemini Vision. Puedes ingresar el término manualmente.", "warning");
      if (DOM.visionAiAnalysisCard) {
        DOM.visionAiAnalysisCard.classList.remove("hidden");
        DOM.visionAiStatusTitle.textContent = "Detección Manual";
        DOM.visionAiProdTitle.textContent = "Foto adjunta para búsqueda";
        DOM.visionAiModelText.textContent = "Escribe el nombre del artículo en la barra de búsqueda para rastrearlo.";
        DOM.visionAiCategoryTag.textContent = "Manual";
        DOM.visionAiPriceRef.textContent = "S/ 0.00";
        DOM.visionAiQueriesList.innerHTML = `<span class="query-chip">Escribe el término en el buscador</span>`;
      }
    });
  }

  DOM.btnRemoveSearchImage.addEventListener("click", () => {
    DOM.searchImageFile.value = "";
    state.uploadedSearchImage = null;
    DOM.searchImagePreviewContainer.classList.add("hidden");
    if (DOM.visionAiAnalysisCard) {
      DOM.visionAiAnalysisCard.classList.add("hidden");
    }
    DOM.dropPrompt.classList.remove("hidden");
  });

  DOM.clearSearchQuery.addEventListener("click", () => {
    DOM.searchQuery.value = "";
    DOM.searchQuery.focus();
  });

  // ==========================================
  // GESTOR DE PORTALES Y TIENDAS OBJETIVO
  // ==========================================
  function renderSelectedSitesUI() {
    if (!DOM.activeSitesContainer) return;

    if (!state.selectedSites || state.selectedSites.length === 0) {
      DOM.activeSitesContainer.innerHTML = `
        <span class="site-tag-empty-hint">Ninguna tienda seleccionada. Elige una del desplegable para agregarla a la búsqueda.</span>
      `;
    } else {
      DOM.activeSitesContainer.innerHTML = state.selectedSites.map(siteId => {
        const custom = (state.customStores || []).find(cs => cs.nombre === siteId);
        const store = custom 
          ? { id: custom.nombre, name: custom.nombre, icon: "🌐", isCustom: true }
          : (ALL_SUPPORTED_STORES.find(s => s.id === siteId) || { id: siteId, name: siteId, icon: "🏪", isCustom: false });

        return `
          <span class="site-tag-pill" data-site="${store.id}" ${store.isCustom ? 'data-custom="true"' : ''}>
            <span class="site-tag-icon">${store.icon}</span>
            <span class="site-tag-name">${store.name}</span>
            <button type="button" class="site-tag-remove-btn" data-remove-site="${store.id}" title="Quitar ${store.name}">&times;</button>
          </span>
        `;
      }).join("");
    }

    if (DOM.activeSitesBadge) {
      const count = (state.selectedSites || []).length;
      DOM.activeSitesBadge.textContent = `${count} activa${count === 1 ? '' : 's'}`;
    }

    // Actualizar hidden inputs
    if (DOM.hiddenSiteInputs) {
      DOM.hiddenSiteInputs.innerHTML = (state.selectedSites || []).map(s => 
        `<input type="hidden" name="targetSite" value="${s}">`
      ).join("");
    }

    // Actualizar opciones del selector desplegable
    if (DOM.selectStoreToAdd) {
      Array.from(DOM.selectStoreToAdd.options).forEach((opt, idx) => {
        if (idx === 0) return;
        if (state.selectedSites && state.selectedSites.includes(opt.value)) {
          opt.textContent = `✓ ${opt.value} (Ya agregada)`;
          opt.disabled = true;
        } else {
          const custom = (state.customStores || []).find(cs => cs.nombre === opt.value);
          if (custom) {
            opt.textContent = `🌐 ${custom.nombre} (${custom.categoria})`;
            opt.disabled = false;
          } else {
            const store = ALL_SUPPORTED_STORES.find(s => s.id === opt.value);
            opt.textContent = store ? `${store.icon} ${store.name} (${store.badge})` : opt.value;
            opt.disabled = false;
          }
        }
      });
      DOM.selectStoreToAdd.selectedIndex = 0;
    }
  }

  function addStoreToFilter(storeId) {
    if (!storeId) return;
    if (!state.selectedSites.includes(storeId)) {
      state.selectedSites.push(storeId);
      renderSelectedSitesUI();
      showToast(`Tienda agregada: ${storeId}`, "info");
    }
  }

  function removeStoreFromFilter(storeId) {
    if (!storeId) return;
    state.selectedSites = state.selectedSites.filter(s => s !== storeId);
    renderSelectedSitesUI();
  }

  if (DOM.btnAddSelectedStore && DOM.selectStoreToAdd) {
    DOM.btnAddSelectedStore.addEventListener("click", () => {
      const val = DOM.selectStoreToAdd.value;
      if (val) addStoreToFilter(val);
    });

    DOM.selectStoreToAdd.addEventListener("change", () => {
      const val = DOM.selectStoreToAdd.value;
      if (val) addStoreToFilter(val);
    });
  }

  if (DOM.activeSitesContainer) {
    DOM.activeSitesContainer.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove-site]");
      if (btn) {
        const siteId = btn.getAttribute("data-remove-site");
        removeStoreFromFilter(siteId);
      }
    });
  }

  if (DOM.btnSelectAllSites) {
    DOM.btnSelectAllSites.addEventListener("click", () => {
      state.selectedSites = ALL_SUPPORTED_STORES.map(s => s.id);
      renderSelectedSitesUI();
      showToast("Todas las tiendas han sido agregadas", "info");
    });
  }

  if (DOM.btnClearAllSites) {
    DOM.btnClearAllSites.addEventListener("click", () => {
      state.selectedSites = [];
      renderSelectedSitesUI();
      showToast("Se quitaron todas las tiendas de la búsqueda", "info");
    });
  }

  // ==========================================
  // GESTOR DE TIENDAS Y PROVEEDORES PERSONALIZADOS
  // ==========================================
  async function loadCustomStores() {
    try {
      const res = await fetch("/api/custom-stores");
      if (!res.ok) throw new Error("Error cargando tiendas personalizadas");
      state.customStores = await res.json();
      renderCustomStoresTable();
      populateCustomStoresPicker();
    } catch (err) {
      console.error(err);
    }
  }

  function populateCustomStoresPicker() {
    if (!DOM.optgroupCustomStores) return;
    const activeCustom = (state.customStores || []).filter(s => s.activo);
    if (activeCustom.length === 0) {
      DOM.optgroupCustomStores.innerHTML = `<option value="" disabled>(Sin tiendas web registradas aún)</option>`;
      return;
    }
    DOM.optgroupCustomStores.innerHTML = activeCustom.map(cs => {
      const isSelected = state.selectedSites && state.selectedSites.includes(cs.nombre);
      return `<option value="${cs.nombre}" ${isSelected ? 'disabled' : ''}>🌐 ${cs.nombre} (${cs.categoria})</option>`;
    }).join("");
  }

  function renderCustomStoresTable() {
    if (!DOM.customStoresTableBody) return;
    const list = state.customStores || [];
    if (DOM.csCount) DOM.csCount.textContent = list.length;

    if (list.length === 0) {
      DOM.customStoresTableBody.innerHTML = "";
      if (DOM.csEmptyState) DOM.csEmptyState.classList.remove("hidden");
      return;
    }
    if (DOM.csEmptyState) DOM.csEmptyState.classList.add("hidden");

    DOM.customStoresTableBody.innerHTML = list.map(store => {
      const waLink = store.contacto_whatsapp 
        ? `<a href="https://wa.me/${store.contacto_whatsapp.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener noreferrer" style="color: #25d366; text-decoration: none; font-weight: 600;">📱 ${store.contacto_whatsapp}</a>`
        : `<span style="color: #94a3b8;">-</span>`;

      const statusBadge = store.activo
        ? `<span class="cs-status-toggle cs-status-active" data-toggle-id="${store.id}" title="Clic para desactivar">🟢 Activa</span>`
        : `<span class="cs-status-toggle cs-status-inactive" data-toggle-id="${store.id}" title="Clic para activar">⚪ Inactiva</span>`;

      const cleanWeb = store.url_web.replace(/^https?:\/\/(www\.)?/, '');

      return `
        <tr>
          <td>
            <strong>${store.nombre}</strong>
            ${store.notas ? `<div style="font-size: 0.74rem; color: #64748b;">${store.notas}</div>` : ''}
          </td>
          <td>
            <span class="badge-cs-cat">${store.categoria}</span>
          </td>
          <td>
            <a href="${store.url_web}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); font-size: 0.8rem; text-decoration: underline;" title="${store.url_web}">
              ${cleanWeb.length > 22 ? cleanWeb.slice(0, 22) + '...' : cleanWeb} ↗
            </a>
          </td>
          <td>${waLink}</td>
          <td>${statusBadge}</td>
          <td>
            <button type="button" class="btn-cs-action" data-edit-id="${store.id}" title="Editar tienda">✏️</button>
            <button type="button" class="btn-cs-action" data-delete-id="${store.id}" title="Eliminar tienda" style="color: #ef4444;">🗑️</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function resetCustomStoreForm() {
    if (!DOM.customStoreForm) return;
    DOM.customStoreForm.reset();
    DOM.csStoreId.value = "";
    if (DOM.btnCancelEditCustomStore) DOM.btnCancelEditCustomStore.classList.add("hidden");
    if (DOM.btnSaveCustomStore) DOM.btnSaveCustomStore.innerHTML = "💾 Guardar Tienda Web";
  }

  // Modal Open & Close
  if (DOM.btnOpenCustomStoresModal && DOM.customStoresModal) {
    DOM.btnOpenCustomStoresModal.addEventListener("click", () => {
      resetCustomStoreForm();
      DOM.customStoresModal.classList.remove("hidden");
    });
  }

  if (DOM.btnCloseCustomStoresModal && DOM.customStoresModal) {
    DOM.btnCloseCustomStoresModal.addEventListener("click", () => {
      DOM.customStoresModal.classList.add("hidden");
    });
  }

  if (DOM.btnCancelEditCustomStore) {
    DOM.btnCancelEditCustomStore.addEventListener("click", () => {
      resetCustomStoreForm();
    });
  }

  // Form Submit (Guardar / Actualizar Tienda Web)
  if (DOM.customStoreForm) {
    DOM.customStoreForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const storeId = DOM.csStoreId.value;
      const payload = {
        nombre: DOM.csNombre.value.trim(),
        url_web: DOM.csUrlWeb.value.trim(),
        url_busqueda: DOM.csUrlBusqueda.value.trim() || null,
        categoria: DOM.csCategoria.value,
        contacto_whatsapp: DOM.csWhatsapp.value.trim() || null,
        comision_estimada: parseFloat(DOM.csComision.value) || 10.0,
        notas: DOM.csNotas.value.trim() || null
      };

      try {
        let res;
        if (storeId) {
          res = await fetch(`/api/custom-stores/${storeId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        } else {
          res = await fetch("/api/custom-stores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
        }

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.detail || "Error al guardar tienda");
        }

        const saved = await res.json();
        showToast(`Tienda '${saved.nombre}' guardada con éxito.`, "success");
        resetCustomStoreForm();
        await loadCustomStores();
        renderSelectedSitesUI();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  // Table Event Delegation (Toggle, Edit, Delete)
  if (DOM.customStoresTableBody) {
    DOM.customStoresTableBody.addEventListener("click", async (e) => {
      const toggleBtn = e.target.closest("[data-toggle-id]");
      if (toggleBtn) {
        const id = toggleBtn.getAttribute("data-toggle-id");
        const store = (state.customStores || []).find(s => String(s.id) === String(id));
        if (store) {
          try {
            const res = await fetch(`/api/custom-stores/${id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ activo: !store.activo })
            });
            if (res.ok) {
              await loadCustomStores();
              renderSelectedSitesUI();
            }
          } catch (err) {
            console.error(err);
          }
        }
        return;
      }

      const editBtn = e.target.closest("[data-edit-id]");
      if (editBtn) {
        const id = editBtn.getAttribute("data-edit-id");
        const store = (state.customStores || []).find(s => String(s.id) === String(id));
        if (store) {
          DOM.csStoreId.value = store.id;
          DOM.csNombre.value = store.nombre;
          DOM.csUrlWeb.value = store.url_web;
          DOM.csUrlBusqueda.value = store.url_busqueda || "";
          DOM.csCategoria.value = store.categoria || "General";
          DOM.csWhatsapp.value = store.contacto_whatsapp || "";
          DOM.csComision.value = store.comision_estimada || 10.0;
          DOM.csNotas.value = store.notas || "";

          if (DOM.btnCancelEditCustomStore) DOM.btnCancelEditCustomStore.classList.remove("hidden");
          if (DOM.btnSaveCustomStore) DOM.btnSaveCustomStore.innerHTML = "💾 Actualizar Tienda Web";
          DOM.csNombre.focus();
        }
        return;
      }

      const delBtn = e.target.closest("[data-delete-id]");
      if (delBtn) {
        const id = delBtn.getAttribute("data-delete-id");
        const store = (state.customStores || []).find(s => String(s.id) === String(id));
        if (store && confirm(`¿Deseas eliminar la tienda '${store.nombre}' de tu catálogo de proveedores?`)) {
          try {
            const res = await fetch(`/api/custom-stores/${id}`, { method: "DELETE" });
            if (res.ok) {
              showToast(`Tienda eliminada.`, "info");
              state.selectedSites = state.selectedSites.filter(s => s !== store.nombre);
              await loadCustomStores();
              renderSelectedSitesUI();
            }
          } catch (err) {
            showToast("Error eliminando tienda: " + err.message, "error");
          }
        }
      }
    });
  }

  // Ejecución de Búsqueda de Arbitraje con Playwright y Gemini
  DOM.searchForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await performSearch();
  });

  let currentSearchAbortController = null;
  let isSearching = false;

  async function performSearch() {
    // Si hay una búsqueda previa en curso, cancelarla para dar paso inmediato a la nueva búsqueda
    if (currentSearchAbortController) {
      try {
        currentSearchAbortController.abort();
      } catch (_) {}
      currentSearchAbortController = null;
    }

    const query = DOM.searchQuery.value.trim();
    const selectedSites = state.selectedSites && state.selectedSites.length > 0
      ? [...state.selectedSites]
      : Array.from(document.querySelectorAll("input[name='targetSite']")).map(cb => cb.value);

    if (selectedSites.length === 0) {
      showToast("Selecciona al menos una tienda en los filtros para rastrear", "warning");
      return;
    }

    // BORRADO INMEDIATO DE RESULTADOS ANTERIORES:
    // Limpia la grilla de productos de la primera búsqueda para que la nueva avance de inmediato
    state.searchResults = [];
    if (DOM.resultsGrid) {
      DOM.resultsGrid.innerHTML = "";
    }
    if (DOM.resultsCountText) {
      DOM.resultsCountText.textContent = query
        ? `Buscando oportunidades para "${query}"...`
        : "Rastreando oportunidades en tiempo real...";
    }
    if (DOM.resultsEmptyState) {
      DOM.resultsEmptyState.classList.add("hidden");
    }
    if (DOM.storeBlockedAlertBanner) {
      DOM.storeBlockedAlertBanner.classList.add("hidden");
    }
    if (DOM.storeCategoryNoticeBanner) {
      DOM.storeCategoryNoticeBanner.classList.add("hidden");
    }
    if (DOM.inventoryMatchAlert) {
      DOM.inventoryMatchAlert.classList.add("hidden");
    }
    if (DOM.resultsTimeBadge) DOM.resultsTimeBadge.classList.add("hidden");
    if (DOM.resultsCacheBadge) DOM.resultsCacheBadge.classList.add("hidden");
    if (DOM.resultsBroadenedBadge) DOM.resultsBroadenedBadge.classList.add("hidden");

    isSearching = true;
    currentSearchAbortController = new AbortController();
    const signal = currentSearchAbortController.signal;

    const maxPrice = DOM.filterMaxPrice.value ? parseFloat(DOM.filterMaxPrice.value) : null;
    const minMargin = DOM.filterMinMargin.value ? parseFloat(DOM.filterMinMargin.value) : null;
    const commission = DOM.filterCommission && DOM.filterCommission.value ? parseFloat(DOM.filterCommission.value) : 12.0;

    DOM.btnSubmitSearch.disabled = true;
    DOM.btnSubmitSearch.innerHTML = `<span>Rastreando...</span>`;

    // Mostrar indicador de carga animado de Playwright + Gemini
    const loaderEl = DOM.searchLoadingIndicator || document.getElementById("searchLoadingIndicator");
    if (loaderEl) {
      loaderEl.classList.remove("hidden");
      loaderEl.style.removeProperty("display");
    }

    // Temporizador de protección de 40 segundos para que nunca quede bloqueado
    const timeoutId = setTimeout(() => {
      if (currentSearchAbortController && isSearching) {
        currentSearchAbortController.abort();
        showToast("La búsqueda tomó más tiempo del esperado. Puedes reintentar o ajustar las tiendas.", "warning");
      }
    }, 40000);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: signal,
        body: JSON.stringify({
          query: query,
          target_sites: selectedSites,
          max_price: maxPrice,
          min_margin_percent: minMargin,
          commission_percent: commission,
          image_filename: state.uploadedSearchImage
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMsg = `Error HTTP ${response.status}: ${response.statusText || 'Error en la búsqueda'}`;
        try {
          const errData = await response.json();
          if (errData.error_detail) errorMsg = errData.error_detail;
          else if (errData.detail) errorMsg = errData.detail;
          else if (errData.ai_message) errorMsg = errData.ai_message;
        } catch (_) {}
        throw new Error(errorMsg);
      }
      const data = await response.json();

      if (data.error_detail) {
        console.warn("Detalle de advertencia/error de portales:", data.error_detail);
        showToast(`Aviso: ${data.error_detail}`, "warning");
      }

      state.searchResults = data.resultados || [];
      state.currentInventoryMatch = data.alerta_inventario;
      const estadoTiendas = data.estado_tiendas || data.tiendas_estado || [];
      state.estadoTiendas = estadoTiendas;
      state.tiendasEstado = estadoTiendas;
      state.lastQuery = query;
      state.searchMeta = data;

      // Actualizar badges de métricas de rendimiento y caché
      if (DOM.resultsTimeBadge) {
        if (data.response_time_ms !== undefined) {
          DOM.resultsTimeBadge.textContent = `⏱ ${(data.response_time_ms / 1000).toFixed(1)}s`;
          DOM.resultsTimeBadge.classList.remove("hidden");
        } else {
          DOM.resultsTimeBadge.classList.add("hidden");
        }
      }

      if (DOM.resultsCacheBadge) {
        if (data.from_cache) {
          DOM.resultsCacheBadge.textContent = "⚡ Desde caché";
          DOM.resultsCacheBadge.classList.remove("hidden");
        } else if (data.cache_hits > 0) {
          DOM.resultsCacheBadge.textContent = `⚡ ${data.cache_hits} en caché`;
          DOM.resultsCacheBadge.classList.remove("hidden");
        } else {
          DOM.resultsCacheBadge.classList.add("hidden");
        }
      }

      if (DOM.resultsBroadenedBadge) {
        if (data.consulta_ampliada) {
          DOM.resultsBroadenedBadge.textContent = `🔍 Consulta ampliada: "${data.query_usada}"`;
          DOM.resultsBroadenedBadge.classList.remove("hidden");
        } else {
          DOM.resultsBroadenedBadge.classList.add("hidden");
        }
      }

      // Renderizar banner de tiendas bloqueadas si alguna requiere verificación antibot
      renderBlockedStoresBanner(estadoTiendas);

      // Mostrar aviso si las tiendas seleccionadas no corresponden a la categoría buscada (ej. vuelos vs retail)
      if (DOM.storeCategoryNoticeBanner) {
        if (data.aviso_categoria) {
          if (DOM.storeCategoryNoticeText) {
            DOM.storeCategoryNoticeText.textContent = data.aviso_categoria;
          }
          DOM.storeCategoryNoticeBanner.classList.remove("hidden");
        } else {
          DOM.storeCategoryNoticeBanner.classList.add("hidden");
        }
      }

      // Renderizar etiquetas de diagnóstico de cada tienda consultada
      renderStoreStatusBar(estadoTiendas);

      // Actualizar badge de estado IA
      if (DOM.aiStatusBadge && DOM.aiStatusBadgeText) {
        if (data.ai_status === "success") {
          DOM.aiStatusBadge.className = "ai-status-badge";
          DOM.aiStatusBadgeText.textContent = "Gemini 2.5 Flash Online";
        } else if (data.ai_status === "sin_resultados") {
          DOM.aiStatusBadge.className = "ai-status-badge fallback";
          DOM.aiStatusBadgeText.textContent = "0 Resultados en Vivo";
        } else {
          DOM.aiStatusBadge.className = "ai-status-badge fallback";
          DOM.aiStatusBadgeText.textContent = "Modo Fallback Heurístico";
        }
      }

      // Alerta de coincidencia con mercadería propia
      if (data.alerta_inventario && data.alerta_inventario.encontrado) {
        DOM.inventoryMatchAlert.classList.remove("hidden");
        DOM.inventoryMatchText.textContent = data.alerta_inventario.mensaje || "Ya tienes stock de este producto en almacén.";
      } else {
        DOM.inventoryMatchAlert.classList.add("hidden");
      }

      sortAndRenderResults();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        console.info("Búsqueda anterior cancelada para dar paso inmediato a la nueva búsqueda.");
        return;
      }
      console.error("Error buscando mercaderías:", error);
      const detailMsg = error.message ? error.message : "Error de conexión o fallo interno del servidor";
      showToast(`Error al consultar portales de compra: ${detailMsg}`, "error");
      if (state.searchResults.length === 0 && DOM.resultsEmptyState) {
        DOM.resultsEmptyState.classList.remove("hidden");
      }
    } finally {
      isSearching = false;
      currentSearchAbortController = null;
      const loaderEl = DOM.searchLoadingIndicator || document.getElementById("searchLoadingIndicator");
      if (loaderEl) {
        loaderEl.classList.add("hidden");
        loaderEl.style.setProperty("display", "none", "important");
      }
      DOM.btnSubmitSearch.disabled = false;
      DOM.btnSubmitSearch.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.3-4.3"></path>
        </svg>
        <span>Buscar Oportunidades</span>
      `;
    }
  }

  function renderBlockedStoresBanner(tiendas) {
    if (!DOM.storeBlockedAlertBanner) return;
    if (!tiendas || tiendas.length === 0) {
      DOM.storeBlockedAlertBanner.classList.add("hidden");
      return;
    }

    const blocked = tiendas.filter(t => t.status === "bloqueado" || t.requires_unlock);
    if (blocked.length === 0) {
      DOM.storeBlockedAlertBanner.classList.add("hidden");
      return;
    }

    const names = blocked.map(t => t.tienda).join(", ");
    if (DOM.blockedAlertTitle) {
      DOM.blockedAlertTitle.textContent = `Verificación requerida en ${names}`;
    }
    if (DOM.blockedAlertDesc) {
      DOM.blockedAlertDesc.textContent = `Se detectó protección antibot o inicio de sesión en ${names}. Los resultados de los demás portales se muestran intactos abajo. Puedes abrir la búsqueda directa en una pestaña nueva o desbloquear la sesión con tu navegador persistente.`;
    }

    if (DOM.blockedAlertActions) {
      DOM.blockedAlertActions.innerHTML = blocked.map(t => `
        <div style="display: flex; gap: 6px; align-items: center;">
          <a href="${t.search_url || '#'}" target="_blank" rel="noopener noreferrer" class="btn btn-outline btn-xs" title="Abrir búsqueda en ${t.tienda} en pestaña nueva">
            Abrir ${t.tienda} ↗
          </a>
          <button type="button" class="btn btn-warning btn-xs btn-unlock-session" data-store="${t.tienda}" title="Abre ventana con perfil persistente para resolver captcha o verificar">
            🔓 Desbloquear ${t.tienda}
          </button>
        </div>
      `).join("");
    }

    DOM.storeBlockedAlertBanner.classList.remove("hidden");
  }

  function renderStoreStatusBar(tiendas) {
    if (!DOM.storeStatusBar) return;
    if (!tiendas || tiendas.length === 0) {
      DOM.storeStatusBar.classList.add("hidden");
      DOM.storeStatusBar.innerHTML = "";
      return;
    }

    DOM.storeStatusBar.classList.remove("hidden");
    let html = `<span class="store-status-title">Diagnóstico de tiendas:</span>`;

    tiendas.forEach(t => {
      let chipClass = "empty";
      const cacheIcon = t.from_cache ? `<span title="Servido desde caché local" style="font-size:0.75rem; opacity:0.85; margin-left:2px;">⚡</span>` : "";
      let statusText = `${t.tienda}: 0 items`;

      if (t.status === "ok") {
        chipClass = "ok";
        statusText = `🟢 ${t.tienda}: ${t.items_encontrados} reales${cacheIcon}`;
      } else if (t.status === "bloqueado" || t.requires_unlock) {
        chipClass = "warning";
        statusText = `🟡 ${t.tienda}: Verificación (<a href="${t.search_url}" target="_blank" rel="noopener noreferrer" title="Verificar tienda en pestaña nueva">Abrir ↗</a> | <a href="javascript:void(0)" class="unlock-store-link" data-store="${t.tienda}" title="Abrir ventana para desbloquear y guardar sesión">🔓 Desbloquear</a>)`;
      } else if (t.status === "timeout") {
        chipClass = "warning";
        statusText = `⏱ ${t.tienda}: Timeout (<a href="${t.search_url}" target="_blank" rel="noopener noreferrer" title="Reintentar">Reintentar ↗</a>)`;
      } else if (t.status === "sin_resultados") {
        chipClass = "empty";
        statusText = `⚪ ${t.tienda}: 0 items${cacheIcon} (<a href="${t.search_url}" target="_blank" rel="noopener noreferrer" title="Consultar en tienda">Ver ↗</a>)`;
      } else if (t.status === "info") {
        chipClass = "info";
        statusText = `ℹ️ ${t.tienda}: ${t.mensaje || 'Información'} (<a href="${t.search_url}" target="_blank" rel="noopener noreferrer" title="Ver catálogo">Catálogo ↗</a>)`;
      } else if (t.status === "error") {
        chipClass = "warning";
        statusText = `⚠️ ${t.tienda}: Aviso (<a href="${t.search_url}" target="_blank" rel="noopener noreferrer" title="Consultar tienda">Abrir ↗</a>)`;
      }

      html += `
        <span class="store-chip ${chipClass}" title="${t.mensaje || ''}">
          <span class="chip-dot"></span>
          <span>${statusText}</span>
        </span>
      `;
    });

    DOM.storeStatusBar.innerHTML = html;
  }

  // Saltar al inventario si hace clic en la alerta
  DOM.btnGoToInventoryMatch.addEventListener("click", () => {
    switchTab("tab-inventory");
    if (state.currentInventoryMatch && state.currentInventoryMatch.nombre) {
      DOM.inventorySearchFilter.value = state.currentInventoryMatch.nombre;
      filterInventoryTable(state.currentInventoryMatch.nombre);
    }
  });

  DOM.sortResultsBy.addEventListener("change", () => {
    sortAndRenderResults();
  });

  function sortAndRenderResults() {
    const sortBy = DOM.sortResultsBy.value;
    state.searchResults.sort((a, b) => {
      if (sortBy === "margin_desc") return b.margen_porcentaje - a.margen_porcentaje;
      if (sortBy === "profit_desc") return b.margen_neto - a.margen_neto;
      if (sortBy === "price_asc") return a.precio_compra - b.precio_compra;
      return 0;
    });
    renderSearchResults();
  }

  function getSiteBadgeClass(sitio) {
    const s = (sitio || "").toLowerCase();
    if (s.includes("mercado")) return "badge-site-mercadolibre";
    if (s.includes("falabella")) return "badge-site-falabella";
    if (s.includes("ripley")) return "badge-site-ripley";
    if (s.includes("sodimac")) return "badge-site-sodimac";
    if (s.includes("aliexpress")) return "badge-site-aliexpress";
    if (s.includes("facebook")) return "badge-site-facebook";
    if (s.includes("temu")) return "badge-site-temu";
    if (s.includes("google") || s.includes("web")) return "badge-site-web";
    if (s.includes("plazavea")) return "badge-site-plazavea";
    if (s.includes("promart")) return "badge-site-promart";
    return "";
  }

  function renderSearchResults() {
    DOM.resultsGrid.innerHTML = "";
    const total = state.searchResults.length;
    DOM.resultsCountText.textContent = `Mostrando ${total} oportunidad${total === 1 ? '' : 'es'} encontrada${total === 1 ? '' : 's'}`;

    if (total === 0) {
      if (state.lastQuery) {
        const tiendasList = state.estadoTiendas || state.tiendasEstado || [];
        const tiendasExplicacion = tiendasList.map(t => {
          let badge = "⚪";
          let detalle = t.mensaje;
          if (t.status === "ok") badge = "🟢";
          else if (t.status === "bloqueado" || t.requires_unlock) badge = "🟡";
          else if (t.status === "timeout") badge = "⏱";
          else if (t.status === "info") badge = "ℹ️";
          else if (t.status === "error") badge = "⚠️";

          const unlockBtn = (t.status === "bloqueado" || t.requires_unlock || t.tienda === "Temu") ? `
            <button type="button" class="btn btn-warning btn-xs btn-unlock-session" data-store="${t.tienda}" title="Abre una ventana visible para verificar o iniciar sesión en ${t.tienda}">
              🔓 Desbloquear ${t.tienda}
            </button>
          ` : "";

          return `
            <li class="store-diagnostic-item">
              <div class="store-diag-header">
                <strong>${badge} ${t.tienda}:</strong> 
                <span>${detalle}</span>
              </div>
              <div class="store-diag-actions" style="display: flex; gap: 0.4rem; align-items: center;">
                ${unlockBtn}
                <a href="${t.search_url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-xs store-diag-btn" title="${t.mensaje}">
                  Ver en ${t.tienda} ↗
                </a>
              </div>
            </li>
          `;
        }).join("");

        const meta = state.searchMeta || {};
        const kayakSuggestHtml = (meta.sugerencia_tienda === "KAYAK" && (!state.selectedSites || !state.selectedSites.includes("KAYAK"))) ? `
          <div style="margin: 14px 0; padding: 12px 16px; background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 8px; text-align: left;">
            <div style="font-weight: 600; color: #60a5fa; margin-bottom: 4px; font-size: 0.9rem;">✈️ Esta búsqueda corresponde a Pasajes Aéreos o Vuelos</div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 10px 0;">Las tiendas seleccionadas son de retail físico (ropa/hogar). Activa KAYAK para cotizar vuelos reales:</p>
            <button type="button" class="btn btn-primary btn-sm" id="btnActivateKayakEmpty" style="display: inline-flex; align-items: center; gap: 6px;">
              ✈️ Activar KAYAK y Buscar Vuelos
            </button>
          </div>
        ` : '';

        const broaderHtml = meta.sugerencia_ampliada ? `
          <div style="margin: 12px 0 8px 0;">
            <button type="button" class="btn-quick-chip" data-query="${meta.sugerencia_ampliada}" style="background: #fef3c7 !important; border: 1px solid #f59e0b !important; color: #92400e !important; font-weight: 600; padding: 6px 12px; font-size: 0.85rem;">
              🔍 Probar consulta base recomendada: "${meta.sugerencia_ampliada}"
            </button>
          </div>
        ` : '';

        const popularQueries = (meta.sugerencias_rapidas && meta.sugerencias_rapidas.length)
          ? meta.sugerencias_rapidas
          : ["Taladro Percutor 20V", "Audífonos Bluetooth ANC", "Smartwatch Deportivo", "Zapatillas Urbanas", "Silla Gamer", "Aspiradora Inalámbrica"];

        const popularChipsHtml = popularQueries.map(q => `
          <button type="button" class="btn-quick-chip" data-query="${q}">${q}</button>
        `).join("");

        DOM.resultsEmptyState.innerHTML = `
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
          </div>
          <h4>Sin oportunidades reales para "${state.lastQuery}"</h4>
          <p>Ninguna de las tiendas consultadas devolvió publicaciones válidas para este término exacto.</p>

          <div class="empty-diagnostic-card">
            ${kayakSuggestHtml}
            <h5>Respuesta de las tiendas consultadas:</h5>
            <ul class="store-diagnostic-list">
              ${tiendasExplicacion || "<li>No se seleccionaron tiendas para rastrear.</li>"}
            </ul>
            <div class="empty-suggestions-tip">
              💡 <strong>Sugerencias:</strong> Prueba con un término más general (ej. <em>"zapatillas"</em> o <em>"taladro"</em> en vez de modelos largos), activa más portales en los filtros (como <strong>Falabella</strong> o <strong>Ripley</strong>), o consulta directamente usando los botones de cada tienda.
            </div>
            ${broaderHtml}
            <div style="margin-top: 14px; text-align: left;">
              <span style="font-size: 0.78rem; color: var(--text-muted); display: block; margin-bottom: 6px;">💡 Sugerencias de alta rotación para probar:</span>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${popularChipsHtml}
              </div>
            </div>
          </div>
        `;
      } else {
        DOM.resultsEmptyState.innerHTML = `
          <div class="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.3-4.3"></path>
            </svg>
          </div>
          <h4>Comienza una búsqueda de arbitraje</h4>
          <p>Ingresa una palabra clave, selecciona portales o sube una fotografía para rastrear precios y márgenes comerciales reales.</p>
        `;
      }
      DOM.resultsEmptyState.classList.remove("hidden");
      return;
    }

    DOM.resultsEmptyState.classList.add("hidden");

    state.searchResults.forEach(item => {
      const card = document.createElement("div");
      card.className = "arbitrage-card";

      const hasMatch = item.coincidencia_inventario && item.coincidencia_inventario.encontrado;
      const matchPill = hasMatch ? `
        <div class="stock-warning-pill">
          <span>⚠️ En stock propio: ${item.coincidencia_inventario.stock_actual} uds</span>
        </div>
      ` : "";

      const aiTag = item.es_relevante_ia ? `
        <span class="ai-verified-tag" title="Validado por Gemini">✨ Validado IA</span>
      ` : "";

      const storeBuyUrl = item.url_compra || item.sitio_url || "#";
      const commPct = item.comision_percent || 12.0;
      const feeCost = item.costo_comision || (item.precio_referencia_venta * (commPct / 100.0));
      const cardImg = item.foto_url ? item.foto_url : NEUTRAL_PLACEHOLDER;

      card.innerHTML = `
        <div class="card-top-thumb">
          <img src="${cardImg}" alt="${item.nombre}" loading="lazy" onerror="this.onerror=null; this.src='${NEUTRAL_PLACEHOLDER}'" />
          <span class="card-site-badge ${getSiteBadgeClass(item.sitio)}">${item.sitio}</span>
          <span class="card-margin-badge">+${item.margen_porcentaje.toFixed(1)}%</span>
        </div>
        <div class="card-content-body">
          <div class="card-title-row">
            <h4 class="card-product-name" title="${item.nombre}">${item.nombre}</h4>
            ${aiTag}
          </div>
          <div class="card-shipping-tag">
            <span>🚚 ${item.envio}</span>
            <span>★ ${item.calificacion}</span>
          </div>

          ${matchPill}

          <div class="financial-strip">
            <div class="strip-col">
              <span class="strip-lbl">Compra Proveedor</span>
              <span class="strip-val buy">${formatMoney(item.precio_compra)}</span>
            </div>
            <div class="strip-col">
              <span class="strip-lbl">Ref. Venta Sugerida</span>
              <span class="strip-val sell">${formatMoney(item.precio_referencia_venta)}</span>
            </div>
          </div>

          <div class="fee-breakdown-row">
            <span>Comisión/Envío (${commPct}%):</span>
            <span>-${formatMoney(feeCost)}</span>
          </div>

          <div class="card-profit-row">
            <span class="profit-lbl">Ganancia Neta Real:</span>
            <span class="profit-amount">+${formatMoney(item.margen_neto)}</span>
          </div>

          <div class="card-actions-row" style="display: flex; gap: 6px; flex-wrap: wrap;">
            <a href="${storeBuyUrl}" target="_blank" rel="noopener noreferrer" class="btn-store-link" title="Abrir enlace de compra directa en ${item.sitio}">
              Ver en tienda ↗
            </a>
            <button class="btn btn-secondary btn-sm btn-add-external" data-id="${item.id}" title="Sumar al lote/carrito de seguimiento sin comprar aún">
              + Sumar a la lista
            </button>
            <button class="btn btn-primary btn-sm btn-publish-store" data-id="${item.id}" title="Publicar en tienda y mostrador bajo pedido con código ENC-XXX sin comprarlo todavía">
              🏪 A Mostrador (Bajo Pedido)
            </button>
            <button class="btn btn-outline-success btn-sm btn-import-to-inventory" data-id="${item.id}" title="Registrar como producto propio en inventario físico">
              📦 Registrar como Propio
            </button>
          </div>
        </div>
      `;

      // Evento "+ Sumar a la lista"
      const btnAdd = card.querySelector(".btn-add-external");
      btnAdd.addEventListener("click", () => {
        addItemToLot({
          origen: "EXTERNO",
          nombre: item.nombre,
          tienda: item.sitio,
          foto_url: item.foto_url,
          cantidad: 1,
          costo_compra: item.precio_compra,
          precio_venta: item.precio_referencia_venta,
          url_compra: storeBuyUrl,
          tiempo_entrega: "24 a 48 hrs",
          notas: `Arbitraje desde ${item.sitio}. Margen: ${item.margen_porcentaje}%`
        });
      });

      // Evento "🏪 A Mostrador (Bajo Pedido)"
      const btnPublish = card.querySelector(".btn-publish-store");
      if (btnPublish) {
        btnPublish.addEventListener("click", async () => {
          btnPublish.disabled = true;
          btnPublish.textContent = "⏳ Publicando...";
          try {
            const res = await fetch("/api/store/publish-on-demand", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nombre: item.nombre,
                tienda: item.sitio,
                precio_compra: item.precio_compra,
                precio_venta: item.precio_referencia_venta,
                foto_url: item.foto_url,
                url_compra: storeBuyUrl,
                tiempo_entrega: "24 a 48 hrs",
                notas: `Arbitraje desde ${item.sitio}. Margen: ${item.margen_porcentaje}%`,
                agregar_a_lote: true
              })
            });
            if (!res.ok) throw new Error("Error al publicar en mostrador");
            const data = await res.json();
            btnPublish.textContent = `✓ En Mostrador (${data.sku})`;
            btnPublish.classList.remove("btn-primary");
            btnPublish.classList.add("btn-success");
            showToast(`✨ ¡Publicado con código ${data.sku}! Disponible para pedidos contraentrega en mostrador.`, "success");
            await loadLot();
            await loadInventory();
          } catch (err) {
            console.error(err);
            btnPublish.disabled = false;
            btnPublish.textContent = "🏪 A Mostrador (Bajo Pedido)";
            showToast("No se pudo publicar en el mostrador", "error");
          }
        });
      }

      // Evento "📦 Registrar como Propio"
      const btnImport = card.querySelector(".btn-import-to-inventory");
      if (btnImport) {
        btnImport.addEventListener("click", () => {
          switchTab("tab-inventory");
          if (DOM.prodName) DOM.prodName.value = item.nombre || "";
          if (DOM.prodModel) DOM.prodModel.value = item.sitio ? `Prov. ${item.sitio}` : "";
          if (DOM.prodCost) DOM.prodCost.value = (item.precio_compra || 0).toFixed(2);
          if (DOM.prodPrice) DOM.prodPrice.value = (item.precio_referencia_venta || 0).toFixed(2);
          if (DOM.prodNotes) {
            DOM.prodNotes.value = `Importado de oportunidad en ${item.sitio || 'Buscador'}. Enlace: ${item.url_compra || item.sitio_url || ''}`.trim();
          }

          if (item.foto_url) {
            setProductPhotoPreview(item.foto_url, item.nombre, "Oportunidad Buscador", item.nombre);
          }

          if (DOM.prodVisionAiCard) {
            DOM.prodVisionAiCard.classList.remove("hidden");
            if (DOM.prodVisionTitle) DOM.prodVisionTitle.textContent = item.nombre;
            if (DOM.prodVisionModel) DOM.prodVisionModel.textContent = `Proveedor: ${item.sitio || 'Comercial'}`;
            if (DOM.prodVisionCategory) DOM.prodVisionCategory.textContent = "Oportunidad de Mercadería";
            if (DOM.prodVisionPrice) DOM.prodVisionPrice.textContent = formatMoney(item.precio_referencia_venta || 0);
            if (DOM.prodVisionAiBadgeText) DOM.prodVisionAiBadgeText.textContent = "Cargado desde Buscador";
          }

          updateLiveCalc();
          if (DOM.prodStock) DOM.prodStock.focus();
          if (DOM.newProductForm) DOM.newProductForm.scrollIntoView({ behavior: "smooth" });
          showToast(`📦 "${item.nombre.substring(0, 32)}..." cargado en Registro Propio`, "success");
        });
      }

      DOM.resultsGrid.appendChild(card);
    });

    if (total < 3 && total > 0) {
      const suggestCard = document.createElement("div");
      suggestCard.style.cssText = "grid-column: 1 / -1; margin-top: 14px; padding: 12px 16px; background: rgba(255, 255, 255, 0.03); border: 1px dashed rgba(255, 255, 255, 0.12); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;";
      suggestCard.innerHTML = `
        <span style="font-size: 0.8rem; color: var(--text-muted);">
          💡 <strong>¿Pocos resultados?</strong> Prueba explorar con estas búsquedas populares de alta rotación:
        </span>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button type="button" class="btn-quick-chip" data-query="Taladro Percutor 20V">Taladro Percutor 20V</button>
          <button type="button" class="btn-quick-chip" data-query="Audífonos Bluetooth ANC">Audífonos Bluetooth ANC</button>
          <button type="button" class="btn-quick-chip" data-query="Smartwatch Deportivo">Smartwatch Deportivo</button>
          <button type="button" class="btn-quick-chip" data-query="Zapatillas Urbanas">Zapatillas Urbanas</button>
        </div>
      `;
      DOM.resultsGrid.appendChild(suggestCard);
    }
  }

  // ==========================================
  // SECCIÓN B: MERCADERÍA PROPIA (INVENTARIO)
  // ==========================================

  // Cálculo en vivo mientras se escriben montos
  function updateLiveCalc() {
    const stock = parseInt(DOM.prodStock.value) || 0;
    const cost = parseFloat(DOM.prodCost.value) || 0;
    const price = parseFloat(DOM.prodPrice.value) || 0;

    const unitMargin = Math.round((price - cost) * 100) / 100;
    const marginPct = cost > 0 ? Math.round(((price - cost) / cost) * 1000) / 10 : 0;
    const totalProfit = Math.round((unitMargin * stock) * 100) / 100;

    DOM.calcUnitMargin.textContent = formatMoney(unitMargin);
    DOM.calcMarginPct.textContent = `${marginPct >= 0 ? '+' : ''}${marginPct.toFixed(1)}%`;
    DOM.calcTotalProfit.textContent = formatMoney(totalProfit);

    if (unitMargin < 0) {
      DOM.calcUnitMargin.style.color = "var(--danger)";
      DOM.calcTotalProfit.style.color = "var(--danger)";
      DOM.calcMarginPct.style.background = "var(--danger)";
    } else {
      DOM.calcUnitMargin.style.color = "#14532d";
      DOM.calcTotalProfit.style.color = "#15803d";
      DOM.calcMarginPct.style.background = "#22c55e";
    }
  }

  [DOM.prodStock, DOM.prodCost, DOM.prodPrice].forEach(input => {
    input.addEventListener("input", updateLiveCalc);
  });

  // GESTIÓN DE VISTA PREVIA PROMINENTE DE FOTO DE PRODUCTO
  function setProductPhotoPreview(url, title = "Fotografía de Catálogo Lista", tag = "Catálogo Estudio IA", filename = "") {
    state.uploadedProdImage = url;
    if (DOM.prodLargePreviewImg) DOM.prodLargePreviewImg.src = url;
    if (DOM.prodPhotoTagChip) DOM.prodPhotoTagChip.textContent = tag;
    if (DOM.prodPhotoTitleText) DOM.prodPhotoTitleText.textContent = title;
    if (DOM.prodPhotoName) DOM.prodPhotoName.textContent = filename || url;
    if (DOM.prodPhotoBadge) {
      DOM.prodPhotoBadge.textContent = "Foto Lista";
      DOM.prodPhotoBadge.classList.add("has-photo");
    }
    if (DOM.prodPhotoLoading) DOM.prodPhotoLoading.classList.add("hidden");
    if (DOM.prodPhotoEmptyState) DOM.prodPhotoEmptyState.classList.add("hidden");
    if (DOM.prodPhotoActiveState) DOM.prodPhotoActiveState.classList.remove("hidden");
    if (DOM.prodPhotoPreviewCard) DOM.prodPhotoPreviewCard.classList.add("has-image");
  }

  function clearProductPhotoPreview() {
    state.uploadedProdImage = null;
    if (DOM.prodPhotoInput) DOM.prodPhotoInput.value = "";
    if (DOM.prodLargePreviewImg) DOM.prodLargePreviewImg.src = "";
    if (DOM.prodPhotoBadge) {
      DOM.prodPhotoBadge.textContent = "Sin archivo asignado";
      DOM.prodPhotoBadge.classList.remove("has-photo");
    }
    if (DOM.prodPhotoLoading) DOM.prodPhotoLoading.classList.add("hidden");
    if (DOM.prodPhotoActiveState) DOM.prodPhotoActiveState.classList.add("hidden");
    if (DOM.prodPhotoEmptyState) DOM.prodPhotoEmptyState.classList.remove("hidden");
    if (DOM.prodPhotoPreviewCard) DOM.prodPhotoPreviewCard.classList.remove("has-image");
    if (DOM.prodVisionAiCard) DOM.prodVisionAiCard.classList.add("hidden");
  }

  if (DOM.btnRemoveProdPhoto) {
    DOM.btnRemoveProdPhoto.addEventListener("click", () => {
      clearProductPhotoPreview();
      showToast("Archivo/foto removida del formulario", "info");
    });
  }

  /**
   * Procesa un archivo de artículo (imagen o documento PDF) para el Registro Propio:
   * 1. Despliega vista previa inmediata o indicador de documento.
   * 2. Envía al backend para análisis multimodal con Gemini Vision.
   * 3. Autocompleta nombre, marca/modelo, precio sugerido, costo estimado y notas.
   * 4. Despliega la tarjeta informativa de reconocimiento IA idéntica al Buscador.
   */
  async function handleProductArticleFile(file) {
    if (!file) return;

    const isPdf = file.type === "application/pdf" || (file.name && file.name.toLowerCase().endsWith(".pdf"));

    // Vista previa instantánea para imágenes
    if (!isPdf) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setProductPhotoPreview(event.target.result, "Foto de Artículo Cargada", "Archivo Local", file.name);
      };
      reader.readAsDataURL(file);
    } else {
      if (DOM.prodPhotoLoading) DOM.prodPhotoLoading.classList.remove("hidden");
      if (DOM.prodPhotoEmptyState) DOM.prodPhotoEmptyState.classList.add("hidden");
      if (DOM.prodPhotoActiveState) DOM.prodPhotoActiveState.classList.add("hidden");
      if (DOM.prodPhotoBadge) {
        DOM.prodPhotoBadge.textContent = "PDF en análisis...";
        DOM.prodPhotoBadge.classList.add("has-photo");
      }
    }

    if (DOM.prodPhotoLoading) DOM.prodPhotoLoading.classList.remove("hidden");
    if (DOM.prodPhotoLoadingText) {
      DOM.prodPhotoLoadingText.textContent = isPdf
        ? "Analizando documento PDF del artículo y extrayendo especificaciones con IA..."
        : "Reconociendo artículo y autocompletando datos con Gemini Vision...";
    }

    showToast(isPdf ? "📄 Analizando PDF del producto con IA..." : "🔍 Reconociendo artículo con Gemini Vision...", "info");

    if (DOM.btnAiAutocompleteProd) {
      DOM.btnAiAutocompleteProd.disabled = true;
      DOM.btnAiAutocompleteProd.textContent = "✨ Procesando con IA...";
    }

    try {
      const aiData = await analyzeImageWithVisionAI(file);

      // Si el backend devolvió URL (sea imagen guardada o primera página de PDF renderizada a PNG)
      if (aiData.url) {
        setProductPhotoPreview(
          aiData.url,
          aiData.producto_identificado || file.name,
          aiData.document_type === "pdf" ? "Ficha Técnica PDF (IA)" : "Artículo Reconocido (IA)",
          file.name
        );
      }

      // Autocompletar datos del producto para registro ultra rápido
      if (aiData.producto_identificado) {
        DOM.prodName.value = aiData.producto_identificado;
      }
      if (aiData.marca_modelo && aiData.marca_modelo !== "Genérico / No visible") {
        DOM.prodModel.value = aiData.marca_modelo;
      }
      if (aiData.precio_referencia_sugerido && aiData.precio_referencia_sugerido > 0) {
        DOM.prodPrice.value = Number(aiData.precio_referencia_sugerido).toFixed(2);
        // Costo sugerido de adquisición (margen estimado de 40%)
        const suggestedCost = (aiData.precio_referencia_sugerido * 0.6).toFixed(2);
        DOM.prodCost.value = suggestedCost;
      }
      if (aiData.categoria || aiData.notas_visuales) {
        const catPart = aiData.categoria ? `[${aiData.categoria}] ` : "";
        DOM.prodNotes.value = `${catPart}${aiData.notas_visuales || ''}`.trim();
      }

      // Desplegar tarjeta de reconocimiento visual Gemini (igual que en Buscador)
      if (DOM.prodVisionAiCard) {
        DOM.prodVisionAiCard.classList.remove("hidden");
        if (DOM.prodVisionTitle) DOM.prodVisionTitle.textContent = aiData.producto_identificado || file.name;
        if (DOM.prodVisionModel) DOM.prodVisionModel.textContent = `Marca/Modelo: ${aiData.marca_modelo || 'Genérico'}`;
        if (DOM.prodVisionCategory) DOM.prodVisionCategory.textContent = aiData.categoria || 'Mercadería';
        if (DOM.prodVisionPrice) DOM.prodVisionPrice.textContent = formatMoney(aiData.precio_referencia_sugerido || 0);
        if (DOM.prodVisionAiBadgeText) {
          DOM.prodVisionAiBadgeText.textContent = aiData.ai_status === "success" ? "Reconocimiento Gemini Vision" : "Detección Visual Local";
        }
      }

      updateLiveCalc();
      if (DOM.prodStock) DOM.prodStock.focus();
      showToast(`✨ Artículo reconocido: "${aiData.producto_identificado || file.name}". Datos ingresados.`, "success");
    } catch (err) {
      console.error("Error al procesar archivo de artículo:", err);
      showToast("Aviso: No se pudo completar el reconocimiento por IA, pero el archivo quedó registrado.", "warning");
      if (DOM.prodPhotoLoading) DOM.prodPhotoLoading.classList.add("hidden");
      if (DOM.prodPhotoActiveState && state.uploadedProdImage) {
        DOM.prodPhotoActiveState.classList.remove("hidden");
      }
    } finally {
      if (DOM.btnAiAutocompleteProd) {
        DOM.btnAiAutocompleteProd.disabled = false;
        DOM.btnAiAutocompleteProd.textContent = "✨ Reconocer con IA";
      }
      if (DOM.prodPhotoLoading) DOM.prodPhotoLoading.classList.add("hidden");
    }
  }

  // Subir Archivo o Foto mediante selector
  if (DOM.btnUploadProdPhoto) {
    DOM.btnUploadProdPhoto.addEventListener("click", () => {
      if (DOM.prodPhotoInput) DOM.prodPhotoInput.click();
    });
  }

  // Cambio en el input de archivo
  if (DOM.prodPhotoInput) {
    DOM.prodPhotoInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleProductArticleFile(e.target.files[0]);
      }
    });
  }

  // Arrastrar y Soltar (Drag & Drop) sobre la tarjeta de archivo
  if (DOM.prodPhotoPreviewCard) {
    ["dragenter", "dragover"].forEach(evtName => {
      DOM.prodPhotoPreviewCard.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        DOM.prodPhotoPreviewCard.classList.add("drag-over");
      }, false);
    });

    ["dragleave", "dragend"].forEach(evtName => {
      DOM.prodPhotoPreviewCard.addEventListener(evtName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        DOM.prodPhotoPreviewCard.classList.remove("drag-over");
      }, false);
    });

    DOM.prodPhotoPreviewCard.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      DOM.prodPhotoPreviewCard.classList.remove("drag-over");

      const files = e.dataTransfer ? e.dataTransfer.files : null;
      if (files && files.length > 0) {
        handleProductArticleFile(files[0]);
      }
    }, false);
  }

  // Pegar foto o archivo desde el portapapeles
  if (DOM.btnPasteProdPhoto) {
    DOM.btnPasteProdPhoto.addEventListener("click", async () => {
      if (navigator.clipboard && navigator.clipboard.read) {
        try {
          const clipItems = await navigator.clipboard.read();
          for (const item of clipItems) {
            for (const type of item.types) {
              if (type.startsWith("image/")) {
                const blob = await item.getType(type);
                const ext = (type.split("/")[1] || "png").replace("jpeg", "jpg");
                const file = new File([blob], `articulo_pegado_${Date.now()}.${ext}`, { type });
                handleProductArticleFile(file);
                return;
              }
            }
          }
          showToast("No se encontró una imagen en el portapapeles. Copia una imagen con Ctrl + C y presiona Ctrl + V.", "warning");
        } catch (err) {
          showToast("Presiona Ctrl + V en tu teclado para pegar la imagen o captura del artículo.", "info");
        }
      } else {
        showToast("Presiona Ctrl + V en tu teclado para pegar la imagen o captura del artículo.", "info");
      }
    });
  }

  // Botón explícito "✨ Reconocer con IA"
  if (DOM.btnAiAutocompleteProd) {
    DOM.btnAiAutocompleteProd.addEventListener("click", () => {
      if (DOM.prodPhotoInput && DOM.prodPhotoInput.files && DOM.prodPhotoInput.files.length > 0) {
        handleProductArticleFile(DOM.prodPhotoInput.files[0]);
      } else {
        DOM.prodPhotoInput.click();
      }
    });
  }

  // Generar Foto Catálogo IA desde el nombre del producto
  if (DOM.btnGenerateCatalogPhoto) {
    DOM.btnGenerateCatalogPhoto.addEventListener("click", async () => {
      const prodName = DOM.prodName.value.trim();
      if (!prodName) {
        DOM.prodName.focus();
        showToast("Escribe primero el nombre del producto para generar su foto de catálogo", "warning");
        return;
      }

      DOM.btnGenerateCatalogPhoto.disabled = true;
      DOM.btnGenerateCatalogPhoto.textContent = "🎨 Generando...";
      
      // Mostrar estado de carga en la tarjeta de previsualización
      if (DOM.prodPhotoEmptyState) DOM.prodPhotoEmptyState.classList.add("hidden");
      if (DOM.prodPhotoActiveState) DOM.prodPhotoActiveState.classList.add("hidden");
      if (DOM.prodPhotoLoading) DOM.prodPhotoLoading.classList.remove("hidden");
      if (DOM.prodPhotoBadge) DOM.prodPhotoBadge.textContent = "Generando...";

      showToast("Generando fotografía profesional de catálogo con IA...", "info");

      try {
        const res = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre_producto: prodName,
            descripcion: DOM.prodNotes.value || DOM.prodModel.value || "Catálogo web profesional",
            estilo: "estudio",
            generar_copy: false
          })
        });

        if (!res.ok) throw new Error("Error en generación de imagen");
        const data = await res.json();

        // Mostrar de inmediato la imagen en grande con su badge
        setProductPhotoPreview(data.url, "Foto de Catálogo Lista para Guardar", `Catálogo ${data.estilo.toUpperCase()} IA`, data.filename);

        showToast("✨ Foto de catálogo generada con éxito y lista para guardar", "success");
      } catch (err) {
        console.error(err);
        showToast("No se pudo generar la foto de catálogo", "error");
        if (state.uploadedProdImage) {
          if (DOM.prodPhotoActiveState) DOM.prodPhotoActiveState.classList.remove("hidden");
        } else {
          if (DOM.prodPhotoEmptyState) DOM.prodPhotoEmptyState.classList.remove("hidden");
        }
        if (DOM.prodPhotoLoading) DOM.prodPhotoLoading.classList.add("hidden");
      } finally {
        DOM.btnGenerateCatalogPhoto.disabled = false;
        DOM.btnGenerateCatalogPhoto.textContent = "🎨 Generar Foto Catálogo IA";
      }
    });
  }

  // Envío del formulario de producto propio
  DOM.newProductForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nombre = DOM.prodName.value.trim();
    if (!nombre) return;

    const payload = {
      nombre: nombre,
      modelo: DOM.prodModel.value.trim() || null,
      sku: `PROD-${Date.now().toString().slice(-4)}`,
      foto_url: state.uploadedProdImage || "https://images.unsplash.com/photo-1581783898377-1c85bf937427?auto=format&fit=crop&w=600&q=80",
      stock: parseInt(DOM.prodStock.value) || 0,
      costo_unitario: parseFloat(DOM.prodCost.value) || 0,
      precio_venta: parseFloat(DOM.prodPrice.value) || 0,
      estado: DOM.prodStatus.value,
      notas: DOM.prodNotes.value.trim() || null
    };

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Error registrando producto");
      const nuevoProd = await res.json();

      showToast(`Producto "${nuevoProd.nombre}" guardado en inventario`, "success");

      // Reset form
      DOM.prodName.value = "";
      DOM.prodModel.value = "";
      DOM.prodNotes.value = "";
      clearProductPhotoPreview();

      await loadInventory();
    } catch (err) {
      console.error(err);
      showToast("Error al guardar el producto", "error");
    }
  });

  async function loadInventory() {
    try {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("Error cargando inventario");
      state.inventory = await res.json();
      DOM.inventoryCounter.textContent = state.inventory.length;
      renderInventoryTable();
      populateInventorySalesSelect();
      populateCampaignProductSelect();
    } catch (err) {
      console.error(err);
    }
  }

  function getStatusBadgeClass(estado) {
    if (estado === "Nuevo") return "status-nuevo";
    if (estado === "Saldo") return "status-saldo";
    return "status-liquidacion";
  }

  function renderInventoryTable(itemsToRender = null) {
    const list = itemsToRender || state.inventory;
    DOM.inventoryTableBody.innerHTML = "";

    if (list.length === 0) {
      DOM.inventoryEmptyState.classList.remove("hidden");
      return;
    }
    DOM.inventoryEmptyState.classList.add("hidden");

    list.forEach(item => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>
          <div class="table-prod-cell">
            <img class="table-prod-img" src="${item.foto_url ? item.foto_url : NEUTRAL_PLACEHOLDER}" alt="" onerror="this.onerror=null; this.src='${NEUTRAL_PLACEHOLDER}'" />
            <div class="table-prod-info">
              <span class="table-prod-title">${item.nombre}</span>
              <span class="table-prod-sub">${item.modelo ? 'Mod: ' + item.modelo : ''} ${item.sku ? '• SKU: ' + item.sku : ''}</span>
            </div>
          </div>
        </td>
        <td>
          <span class="status-pill ${getStatusBadgeClass(item.estado)}">${item.estado}</span>
        </td>
        <td>
          <div class="stock-stepper">
            <button class="step-btn btn-stock-minus" data-id="${item.id}" title="Restar 1 unidad">-</button>
            <span class="step-val">${item.stock}</span>
            <button class="step-btn btn-stock-plus" data-id="${item.id}" title="Sumar 1 unidad">+</button>
          </div>
        </td>
        <td>${formatMoney(item.costo_unitario)}</td>
        <td><strong>${formatMoney(item.precio_venta)}</strong></td>
        <td>
          <span class="text-success">+${formatMoney(item.margen_unitario)}</span>
          <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">(${item.margen_porcentaje}%)</span>
        </td>
        <td>
          <strong class="text-success">${formatMoney(item.ganancia_total_potencial)}</strong>
        </td>
        <td class="text-right">
          <div class="table-actions">
            <button class="btn btn-sell-prod btn-xs btn-sell-inventory-row" data-id="${item.id}" title="Registrar venta directa y descontar stock">
              💰 Vender
            </button>
            <button class="btn btn-whatsapp btn-xs btn-wa-share-item" data-id="${item.id}" title="Compartir mensaje comercial por WhatsApp">
              📲 WhatsApp
            </button>
            <button class="btn-enhance-photo btn-xs btn-enhance-prod-photo" data-id="${item.id}" title="Mejorar y actualizar foto de catálogo con IA">
              🎨 Foto IA
            </button>
            <button class="btn btn-secondary btn-xs btn-campaign-quick" data-id="${item.id}" title="Crear Campaña y Piezas para Redes con IA">
              📢 Campaña IA
            </button>
            <button class="btn btn-secondary btn-xs btn-post-prod-social" data-id="${item.id}" title="Crear post publicitario para redes con IA">
              💬 Post
            </button>
            <button class="btn btn-secondary btn-xs btn-add-own-lot" data-id="${item.id}" title="Sumar al lote de operación">
              + Lote
            </button>
            <button class="btn btn-outline-danger btn-xs btn-delete-prod" data-id="${item.id}" title="Eliminar producto">
              &times;
            </button>
          </div>
        </td>
      `;

      // Registrar Venta Directa
      tr.querySelector(".btn-sell-inventory-row").addEventListener("click", () => openSaleForProduct(item.id));

      // Compartir por WhatsApp
      tr.querySelector(".btn-wa-share-item").addEventListener("click", () => shareProductWhatsApp(item));

      // Stepper de stock
      tr.querySelector(".btn-stock-minus").addEventListener("click", () => updateStock(item.id, Math.max(0, item.stock - 1)));
      tr.querySelector(".btn-stock-plus").addEventListener("click", () => updateStock(item.id, item.stock + 1));

      // Mejorar Foto con IA
      tr.querySelector(".btn-enhance-prod-photo").addEventListener("click", () => enhanceProductPhoto(item));

      // Campaña Multicanal con IA
      tr.querySelector(".btn-campaign-quick").addEventListener("click", () => openCampaignForProduct(item));

      // Crear Post para Redes
      tr.querySelector(".btn-post-prod-social").addEventListener("click", () => openSocialPostModal(item));

      // Sumar al lote
      tr.querySelector(".btn-add-own-lot").addEventListener("click", () => {
        addItemToLot({
          origen: "PROPIO",
          referencia_id: item.id,
          nombre: item.nombre,
          tienda: "Inventario Propio",
          foto_url: item.foto_url,
          cantidad: 1,
          costo_compra: item.costo_unitario,
          precio_venta: item.precio_venta,
          notas: `Stock en mano (${item.estado}).`
        });
      });

      // Eliminar producto
      tr.querySelector(".btn-delete-prod").addEventListener("click", () => deleteProduct(item.id, item.nombre));

      DOM.inventoryTableBody.appendChild(tr);
    });
  }

  async function updateStock(productId, newStock) {
    try {
      const res = await fetch(`/api/inventory/${productId}/stock`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock: newStock })
      });
      if (!res.ok) throw new Error("Error actualizando stock");
      await loadInventory();
    } catch (err) {
      console.error(err);
      showToast("Error al actualizar el stock", "error");
    }
  }

  async function deleteProduct(productId, nombre) {
    if (!confirm(`¿Estás seguro de eliminar "${nombre}" del inventario?`)) return;
    try {
      const res = await fetch(`/api/inventory/${productId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error eliminando producto");
      showToast(`Producto "${nombre}" eliminado`, "warning");
      await loadInventory();
    } catch (err) {
      console.error(err);
      showToast("Error al eliminar producto", "error");
    }
  }

  // Filtro de búsqueda en tiempo real sobre la tabla de inventario
  DOM.inventorySearchFilter.addEventListener("input", (e) => {
    filterInventoryTable(e.target.value);
  });

  function filterInventoryTable(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      renderInventoryTable();
      return;
    }
    const filtered = state.inventory.filter(item => {
      const text = `${item.nombre} ${item.modelo || ''} ${item.sku || ''} ${item.estado}`.toLowerCase();
      return text.includes(q);
    });
    renderInventoryTable(filtered);
  }

  // ==========================================
  // SECCIÓN C: LISTA SUMATORIA (LOTE DE OPERACIÓN)
  // ==========================================

  async function loadLot() {
    try {
      const res = await fetch("/api/lot");
      if (!res.ok) throw new Error("Error al obtener lote");
      const data = await res.json();
      state.lotItems = data.items || [];
      state.lotSummary = data.resumen || {};
      renderLotView();
    } catch (err) {
      console.error(err);
    }
  }

  async function addItemToLot(itemData) {
    try {
      const res = await fetch("/api/lot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemData)
      });
      if (!res.ok) throw new Error("Error agregando ítem al lote");
      showToast(`"${itemData.nombre}" agregado al lote de operación`, "success");
      await loadLot();
    } catch (err) {
      console.error(err);
      showToast("Error al agregar al lote", "error");
    }
  }

  async function updateLotQuantity(itemId, newQty) {
    if (newQty < 1) return;
    try {
      const res = await fetch(`/api/lot/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cantidad: newQty })
      });
      if (!res.ok) throw new Error("Error actualizando cantidad");
      await loadLot();
    } catch (err) {
      console.error(err);
      showToast("Error al actualizar cantidad", "error");
    }
  }

  async function removeLotItem(itemId, nombre) {
    try {
      const res = await fetch(`/api/lot/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error eliminando ítem");
      showToast(`"${nombre}" quitado del lote`, "warning");
      await loadLot();
    } catch (err) {
      console.error(err);
      showToast("Error al quitar ítem", "error");
    }
  }

  DOM.btnClearLot.addEventListener("click", async () => {
    if (state.lotItems.length === 0) return;
    if (!confirm("¿Deseas vaciar todos los ítems del lote de operación?")) return;
    try {
      const res = await fetch("/api/lot", { method: "DELETE" });
      if (!res.ok) throw new Error("Error vaciando lote");
      showToast("Lote vaciado completamente", "warning");
      await loadLot();
    } catch (err) {
      console.error(err);
      showToast("Error al vaciar lote", "error");
    }
  });

  function renderLotView() {
    // 1. Actualizar Contadores en Header y Tabs
    const totalItems = state.lotItems.length;
    DOM.lotBadgeCount.textContent = totalItems;
    DOM.lotCounterTab.textContent = totalItems;

    // 2. Actualizar KPIs Financieros en tiempo real
    DOM.kpiNewInvestment.textContent = formatMoney(state.lotSummary.inversion_nueva);
    DOM.kpiOwnStockValue.textContent = formatMoney(state.lotSummary.stock_propio_valor);
    DOM.kpiGrossIncome.textContent = formatMoney(state.lotSummary.ingreso_bruto_proyectado);
    DOM.kpiNetProfit.textContent = formatMoney(state.lotSummary.ganancia_neta_total);
    DOM.kpiAverageMargin.textContent = `${state.lotSummary.margen_promedio_porcentaje >= 0 ? '+' : ''}${state.lotSummary.margen_promedio_porcentaje.toFixed(1)}%`;

    // 3. Renderizar Tabla del Lote
    DOM.lotTableBody.innerHTML = "";
    if (totalItems === 0) {
      DOM.lotEmptyState.classList.remove("hidden");
      return;
    }
    DOM.lotEmptyState.classList.add("hidden");

    state.lotItems.forEach(item => {
      const tr = document.createElement("tr");
      const isPropio = item.origen.toUpperCase() === "PROPIO";

      tr.innerHTML = `
        <td>
          <span class="badge-origen ${isPropio ? 'origen-propio' : 'origen-externo'}">
            ${isPropio ? '🏠 Propio' : '🌐 Externo'} • ${item.tienda}
          </span>
        </td>
        <td>
          <div class="table-prod-cell">
            <img class="table-prod-img" src="${item.foto_url ? item.foto_url : NEUTRAL_PLACEHOLDER}" alt="" onerror="this.onerror=null; this.src='${NEUTRAL_PLACEHOLDER}'" />
            <div class="table-prod-info">
              <span class="table-prod-title">${item.nombre}</span>
              ${item.notas ? `<span class="table-prod-sub">${item.notas}</span>` : ''}
            </div>
          </div>
        </td>
        <td>${formatMoney(item.costo_compra)}</td>
        <td>${formatMoney(item.precio_venta)}</td>
        <td>
          <div class="stock-stepper">
            <button class="step-btn btn-qty-minus" data-id="${item.id}">-</button>
            <span class="step-val">${item.cantidad}</span>
            <button class="step-btn btn-qty-plus" data-id="${item.id}">+</button>
          </div>
        </td>
        <td><strong>${formatMoney(item.subtotal_costo)}</strong></td>
        <td><strong>${formatMoney(item.subtotal_venta)}</strong></td>
        <td>
          <strong class="text-success">+${formatMoney(item.ganancia_estimada)}</strong>
        </td>
        <td class="text-right">
          <div class="table-actions">
            ${!isPropio ? `
              <button class="btn btn-outline-primary btn-xs btn-pub-lot" data-id="${item.id}" title="Publicar en catálogo/mostrador con código ENC-XXX bajo pedido sin comprarlo aún">
                🏪 Mostrador
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-xs btn-campaign-lot" data-id="${item.id}" title="Crear Campaña con IA para este producto de arbitraje">
              📢 Campaña
            </button>
            <button class="btn btn-sell-prod btn-xs btn-sell-lot-row" data-id="${item.id}" title="Registrar venta de este ítem y liquidarlo del lote">
              💰 Vender
            </button>
            <button class="btn btn-whatsapp btn-xs btn-wa-share-lot" data-id="${item.id}" title="Compartir este ítem por WhatsApp">
              📲 WhatsApp
            </button>
            <button class="btn btn-outline-danger btn-xs btn-remove-item" data-id="${item.id}" title="Quitar del lote">
              &times;
            </button>
          </div>
        </td>
      `;

      const btnPubLot = tr.querySelector(".btn-pub-lot");
      if (btnPubLot) {
        btnPubLot.addEventListener("click", async () => {
          btnPubLot.disabled = true;
          btnPubLot.textContent = "⏳...";
          try {
            const res = await fetch(`/api/lot/${item.id}/publish-to-store`, { method: "POST" });
            if (!res.ok) throw new Error("Error al publicar");
            const data = await res.json();
            btnPubLot.textContent = `✓ ${data.sku}`;
            btnPubLot.classList.remove("btn-outline-primary");
            btnPubLot.classList.add("btn-success");
            showToast(`✨ ¡Publicado con código ${data.sku}! En mostrador bajo pedido.`, "success");
            await loadLot();
            await loadInventory();
          } catch (e) {
            btnPubLot.disabled = false;
            btnPubLot.textContent = "🏪 Mostrador";
            showToast("No se pudo publicar", "error");
          }
        });
      }

      const btnCampLot = tr.querySelector(".btn-campaign-lot");
      if (btnCampLot) {
        btnCampLot.addEventListener("click", () => openCampaignForProduct(item, true));
      }

      tr.querySelector(".btn-qty-minus").addEventListener("click", () => updateLotQuantity(item.id, Math.max(1, item.cantidad - 1)));
      tr.querySelector(".btn-qty-plus").addEventListener("click", () => updateLotQuantity(item.id, item.cantidad + 1));
      tr.querySelector(".btn-sell-lot-row").addEventListener("click", () => sellLotItem(item.id, item.nombre));
      tr.querySelector(".btn-wa-share-lot").addEventListener("click", () => shareProductWhatsApp(item));
      tr.querySelector(".btn-remove-item").addEventListener("click", () => removeLotItem(item.id, item.nombre));

      DOM.lotTableBody.appendChild(tr);
    });

    populateCampaignProductSelect();
  }

  // ==========================================
  // EXPORTAR RESUMEN DEL LOTE
  // ==========================================
  DOM.btnExportLotSummary.addEventListener("click", () => {
    if (state.lotItems.length === 0) {
      showToast("Agrega productos al lote antes de exportar", "warning");
      return;
    }
    const reportText = generateLotReportText();
    DOM.exportSummaryContent.textContent = reportText;
    DOM.exportModal.classList.remove("hidden");
  });

  DOM.btnCloseExportModal.addEventListener("click", () => {
    DOM.exportModal.classList.add("hidden");
  });

  DOM.btnCopyExportText.addEventListener("click", () => {
    const text = DOM.exportSummaryContent.textContent;
    navigator.clipboard.writeText(text).then(() => {
      showToast("Resumen copiado al portapapeles", "success");
    }).catch(err => {
      console.error(err);
      showToast("Error al copiar texto", "error");
    });
  });

  DOM.btnDownloadExportFile.addEventListener("click", () => {
    const text = DOM.exportSummaryContent.textContent;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Kipustock_Lote_Operacion_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Archivo de lote descargado", "success");
  });

  // ==========================================
  // MEJORAR FOTO DE PRODUCTO PROPIO CON IA
  // ==========================================
  async function enhanceProductPhoto(item) {
    showToast(`Generando y mejorando foto de catálogo para: ${item.nombre}...`, "info");
    try {
      const res = await fetch("/api/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_producto: item.nombre,
          descripcion: item.notas || item.modelo || "Fotografía de catálogo web",
          estilo: "estudio",
          generar_copy: false,
          producto_propio_id: item.id
        })
      });

      if (!res.ok) throw new Error("Error al mejorar foto");
      const data = await res.json();
      showToast("✨ Foto de catálogo actualizada en SQLite", "success");
      await loadInventory();
    } catch (err) {
      console.error(err);
      showToast("Error al mejorar foto con IA", "error");
    }
  }

  // ==========================================
  // MODAL CREAR POST PUBLICITARIO REDES CON IA
  // ==========================================
  if (DOM.btnOpenSocialPostModal) {
    DOM.btnOpenSocialPostModal.addEventListener("click", () => openSocialPostModal());
  }

  function closeSocialPostModal() {
    if (DOM.socialPostModal) {
      DOM.socialPostModal.classList.add("hidden");
    }
  }

  if (DOM.btnCloseSocialPostModal) {
    DOM.btnCloseSocialPostModal.addEventListener("click", closeSocialPostModal);
  }

  if (DOM.btnCancelSocialPostModal) {
    DOM.btnCancelSocialPostModal.addEventListener("click", closeSocialPostModal);
  }

  function openSocialPostModal(prefillItem = null) {
    // Poblar selector de productos con ítems de inventario y lote
    DOM.postProdSelect.innerHTML = `<option value="">-- Elige un producto o escribe abajo --</option>`;
    
    const combinedProducts = [];
    const seenNames = new Set();

    state.lotItems.forEach(it => {
      if (!seenNames.has(it.nombre)) {
        seenNames.add(it.nombre);
        combinedProducts.push({ nombre: it.nombre, notas: it.notas || `Origen: ${it.tienda}` });
      }
    });

    state.inventory.forEach(p => {
      if (!seenNames.has(p.nombre)) {
        seenNames.add(p.nombre);
        combinedProducts.push({ nombre: p.nombre, notas: p.notas || `Modelo: ${p.modelo || ''}` });
      }
    });

    combinedProducts.forEach(prod => {
      const opt = document.createElement("option");
      opt.value = prod.nombre;
      opt.dataset.desc = prod.notas;
      opt.textContent = `${prod.nombre}`;
      DOM.postProdSelect.appendChild(opt);
    });

    if (prefillItem) {
      DOM.postProdSelect.value = prefillItem.nombre;
      DOM.postProdName.value = prefillItem.nombre;
      DOM.postProdDesc.value = prefillItem.notas || prefillItem.modelo || "";
    } else if (combinedProducts.length > 0) {
      DOM.postProdSelect.value = combinedProducts[0].nombre;
      DOM.postProdName.value = combinedProducts[0].nombre;
      DOM.postProdDesc.value = combinedProducts[0].notas;
    } else {
      DOM.postProdName.value = "";
      DOM.postProdDesc.value = "";
    }

    DOM.socialPostModal.classList.remove("hidden");
  }

  if (DOM.postProdSelect) {
    DOM.postProdSelect.addEventListener("change", () => {
      const selectedOpt = DOM.postProdSelect.selectedOptions[0];
      if (selectedOpt && selectedOpt.value) {
        DOM.postProdName.value = selectedOpt.value;
        DOM.postProdDesc.value = selectedOpt.dataset.desc || "";
      }
    });
  }

  // Selector de estilo visual de post
  if (DOM.postStyleCards) {
    DOM.postStyleCards.forEach(card => {
      card.addEventListener("click", () => {
        DOM.postStyleCards.forEach(c => c.classList.remove("active"));
        card.classList.add("active");
        const radio = card.querySelector("input[type='radio']");
        if (radio) radio.checked = true;
      });
    });
  }

  // Envío para generar post
  if (DOM.btnSubmitGeneratePost) {
    DOM.btnSubmitGeneratePost.addEventListener("click", async () => {
      const prodName = DOM.postProdName.value.trim();
      if (!prodName) {
        DOM.postProdName.focus();
        showToast("Ingresa el nombre del producto", "warning");
        return;
      }

      const activeStyleCard = document.querySelector(".style-option-card.active");
      const chosenStyle = activeStyleCard ? activeStyleCard.dataset.style : "marketing";
      const wantCopy = DOM.postGenerateCopy ? DOM.postGenerateCopy.checked : true;

      DOM.btnSubmitGeneratePost.disabled = true;
      DOM.btnSubmitGeneratePost.textContent = "✨ Generando Contenido IA...";
      DOM.postEmptyState.classList.add("hidden");
      DOM.postResultContainer.classList.add("hidden");
      DOM.postLoadingIndicator.classList.remove("hidden");

      try {
        const res = await fetch("/api/images/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre_producto: prodName,
            descripcion: DOM.postProdDesc.value.trim() || undefined,
            estilo: chosenStyle,
            generar_copy: wantCopy
          })
        });

        if (!res.ok) throw new Error("Error en generación de post");
        const data = await res.json();

        DOM.postResultImage.src = data.url;
        DOM.btnDownloadPostImage.href = data.url;
        DOM.btnDownloadPostImage.download = `post_${prodName.slice(0, 15).replace(/\s+/g, '_')}.png`;

        if (data.copy_redes) {
          DOM.postResultCopy.value = data.copy_redes;
        } else {
          DOM.postResultCopy.value = `🔥 ¡Nuevo ${prodName} disponible!\n\nConsulta precio y stock por WhatsApp.`;
        }

        DOM.postResultContainer.classList.remove("hidden");
        showToast("✨ Post publicitario generado exitosamente", "success");
      } catch (err) {
        console.error(err);
        showToast("Error al generar contenido con IA", "error");
        DOM.postEmptyState.classList.remove("hidden");
      } finally {
        DOM.postLoadingIndicator.classList.add("hidden");
        DOM.btnSubmitGeneratePost.disabled = false;
        DOM.btnSubmitGeneratePost.textContent = "✨ Generar Imagen y Copy con IA";
      }
    });
  }

  if (DOM.btnCopyPostText) {
    DOM.btnCopyPostText.addEventListener("click", () => {
      const text = DOM.postResultCopy.value;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        showToast("Copy promocional copiado al portapapeles", "success");
      }).catch(err => {
        console.error(err);
        showToast("Error al copiar texto", "error");
      });
    });
  }

  // ==========================================
  // SEGURIDAD DE ENLACES EXTERNOS (TIENDAS)
  // ==========================================
  let currentTargetStoreUrl = "";

  function openStoreSafetyModal(url, storeName) {
    if (!url) return;
    currentTargetStoreUrl = url;
    if (DOM.storeModalTitle) {
      DOM.storeModalTitle.textContent = storeName ? `Visitar ${storeName}` : "Visitar Tienda Oficial";
    }
    if (DOM.storeModalUrlInput) {
      DOM.storeModalUrlInput.value = url;
    }
    if (DOM.storeLinkModal) {
      DOM.storeLinkModal.classList.remove("hidden");
    }
  }

  function closeStoreSafetyModal() {
    if (DOM.storeLinkModal) {
      DOM.storeLinkModal.classList.add("hidden");
    }
    currentTargetStoreUrl = "";
  }

  if (DOM.btnCloseStoreModal) {
    DOM.btnCloseStoreModal.addEventListener("click", closeStoreSafetyModal);
  }
  if (DOM.btnStayInKipu) {
    DOM.btnStayInKipu.addEventListener("click", closeStoreSafetyModal);
  }

  if (DOM.btnCopyStoreModalUrl) {
    DOM.btnCopyStoreModalUrl.addEventListener("click", () => {
      if (!currentTargetStoreUrl) return;
      navigator.clipboard.writeText(currentTargetStoreUrl).then(() => {
        showToast("Enlace de la tienda copiado al portapapeles 📋", "success");
      }).catch(() => {
        showToast("Error al copiar enlace", "error");
      });
    });
  }

  if (DOM.btnOpenStoreExternal) {
    DOM.btnOpenStoreExternal.addEventListener("click", () => {
      if (!currentTargetStoreUrl) return;
      window.open(currentTargetStoreUrl, "_blank", "noopener,noreferrer");
      closeStoreSafetyModal();
    });
  }

  // Interceptor global para cualquier clic a links de tiendas (evita salir de KipuStock)
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    if (href.startsWith("http://") || href.startsWith("https://")) {
      if (!href.includes("127.0.0.1") && !href.includes("localhost")) {
        e.preventDefault();
        e.stopPropagation();
        const storeName = link.dataset.store || link.title || link.innerText.trim();
        openStoreSafetyModal(href, storeName);
      }
    }
  });

  function generateLotReportText() {
    const now = new Date().toLocaleString("es-PE");
    const sym = getCurrencySymbol();
    let txt = `======================================================\n`;
    txt += `  KIPUSTOCK - INFORME EJECUTIVO DE LOTE DE OPERACIÓN  \n`;
    txt += `  Fecha: ${now} | Moneda: ${state.currency} (${sym})\n`;
    txt += `======================================================\n\n`;

    txt += `1. RESUMEN FINANCIERO CONSOLIDADO:\n`;
    txt += `------------------------------------------------------\n`;
    txt += `• Inversión Nueva Requerida (Externos): ${formatMoney(state.lotSummary.inversion_nueva)}\n`;
    txt += `• Valor de Stock Propio Asignado:       ${formatMoney(state.lotSummary.stock_propio_valor)}\n`;
    txt += `• Costo Total de la Operación:          ${formatMoney(state.lotSummary.inversion_nueva + state.lotSummary.stock_propio_valor)}\n`;
    txt += `• Ingreso Bruto Proyectado de Venta:    ${formatMoney(state.lotSummary.ingreso_bruto_proyectado)}\n`;
    txt += `• GANANCIA NETA TOTAL ESTIMADA:         ${formatMoney(state.lotSummary.ganancia_neta_total)}\n`;
    txt += `• Margen Promedio Consolidado:          +${state.lotSummary.margen_promedio_porcentaje.toFixed(1)}%\n`;
    txt += `• Total Ítems: ${state.lotSummary.total_items} líneas | ${state.lotSummary.total_unidades} unidades físicas\n\n`;

    txt += `2. DESGLOSE DETALLADO DE ÍTEMS DEL LOTE:\n`;
    txt += `------------------------------------------------------\n`;
    state.lotItems.forEach((item, idx) => {
      txt += `[#${idx + 1}] ${item.nombre}\n`;
      txt += `    - Origen: [${item.origen}] Tienda: ${item.tienda}\n`;
      txt += `    - Cantidad: ${item.cantidad} uds | Costo Unit: ${formatMoney(item.costo_compra)} | Venta Unit: ${formatMoney(item.precio_venta)}\n`;
      txt += `    - Subtotal Costo: ${formatMoney(item.subtotal_costo)} | Subtotal Venta: ${formatMoney(item.subtotal_venta)}\n`;
      txt += `    - Ganancia Estimada: +${formatMoney(item.ganancia_estimada)}\n\n`;
    });

    txt += `======================================================\n`;
    txt += `Generado por Kipustock - Sistema Modular de Arbitraje Comercial\n`;
    return txt;
  }

  // ==========================================
  // SUBIDA DE ARCHIVOS AL SERVIDOR
  // ==========================================
  async function uploadImageToServer(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    });

    if (!res.ok) throw new Error("Error en upload");
    const data = await res.json();
    return data.url;
  }

  // ==========================================
  // RECONOCIMIENTO VISUAL CON GEMINI VISION
  // ==========================================
  async function analyzeImageWithVisionAI(file) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/vision/analyze", {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error en análisis visual");
    }

    return await res.json();
  }

  // ==========================================
  // SECCIÓN D: REGISTRO DE VENTAS & CONTROL DE STOCK
  // ==========================================

  async function loadSales() {
    try {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Error obteniendo registro de ventas");
      const data = await res.json();
      state.sales = data.ventas || [];
      state.salesSummary = data.resumen || {
        total_ventas_monto: 0,
        total_costos_monto: 0,
        total_comisiones_envio: 0,
        ganancia_neta_acumulada: 0,
        total_unidades_vendidas: 0,
        total_operaciones: 0,
        margen_promedio_porcentaje: 0
      };
      renderSales();
    } catch (err) {
      console.error("Error al cargar ventas:", err);
    }
  }

  function getChannelBadge(canal) {
    const c = (canal || "Venta Directa").toLowerCase();
    if (c.includes("whatsapp")) {
      return `<span class="badge-channel badge-channel-whatsapp">📱 WhatsApp</span>`;
    } else if (c.includes("marketplace")) {
      return `<span class="badge-channel badge-channel-marketplace">👥 Marketplace</span>`;
    } else if (c.includes("web")) {
      return `<span class="badge-channel badge-channel-tienda-web">🌐 Tienda Web</span>`;
    } else if (c.includes("mercado")) {
      return `<span class="badge-channel badge-channel-mercado-libre">📦 Mercado Libre</span>`;
    } else if (c.includes("instagram") || c.includes("tiktok")) {
      return `<span class="badge-channel badge-channel-instagram">📸 Redes</span>`;
    }
    return `<span class="badge-channel badge-channel-venta-directa">🤝 Directa</span>`;
  }

  function renderSales(itemsToRender = null) {
    const list = itemsToRender || state.sales;

    // 1. Actualizar KPIs de Ventas
    if (DOM.kpiSalesRevenue) DOM.kpiSalesRevenue.textContent = formatMoney(state.salesSummary.total_ventas_monto);
    if (DOM.kpiSalesCost) DOM.kpiSalesCost.textContent = formatMoney(state.salesSummary.total_costos_monto);
    if (DOM.kpiSalesProfit) DOM.kpiSalesProfit.textContent = formatMoney(state.salesSummary.ganancia_neta_acumulada);
    if (DOM.kpiSalesMargin) {
      DOM.kpiSalesMargin.textContent = `${state.salesSummary.margen_promedio_porcentaje >= 0 ? '+' : ''}${state.salesSummary.margen_promedio_porcentaje.toFixed(1)}%`;
      if (state.salesSummary.margen_promedio_porcentaje < 0) {
        DOM.kpiSalesMargin.style.background = "var(--danger)";
      } else {
        DOM.kpiSalesMargin.style.background = "#10b981";
      }
    }
    if (DOM.kpiSalesCount) DOM.kpiSalesCount.textContent = state.salesSummary.total_operaciones;
    if (DOM.kpiSalesUnits) DOM.kpiSalesUnits.textContent = `${state.salesSummary.total_unidades_vendidas} unidades entregadas`;
    if (DOM.salesCounterTab) DOM.salesCounterTab.textContent = state.sales.length;

    // 2. Renderizar Tabla de Ventas
    if (!DOM.salesTableBody) return;
    DOM.salesTableBody.innerHTML = "";

    if (list.length === 0) {
      if (DOM.salesEmptyState) DOM.salesEmptyState.classList.remove("hidden");
      return;
    }
    if (DOM.salesEmptyState) DOM.salesEmptyState.classList.add("hidden");

    list.forEach(sale => {
      const tr = document.createElement("tr");

      // Formatear fecha
      const fechaObj = new Date(sale.fecha_venta);
      const fechaTxt = isNaN(fechaObj.getTime())
        ? "Hoy"
        : `${fechaObj.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" })} ${fechaObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;

      const totalVenta = sale.precio_venta_unitario * sale.cantidad_vendida;
      const isPropio = !!sale.producto_propio_id;

      tr.innerHTML = `
        <td class="td-date">
          ${fechaTxt}
        </td>
        <td class="td-product">
          <div class="table-prod-info">
            <span class="table-prod-title" title="${sale.nombre_producto}">${sale.nombre_producto}</span>
            <span class="sale-source-badge ${isPropio ? '' : 'manual'}">
              ${isPropio ? '🏠 Mercadería Propia' : '✍️ Venta Libre'}
            </span>
            ${sale.notas ? `<span class="table-prod-sub" title="${sale.notas}">${sale.notas}</span>` : ''}
          </div>
        </td>
        <td class="td-channel">
          ${getChannelBadge(sale.canal_venta)}
        </td>
        <td class="td-qty text-center">
          <strong>${sale.cantidad_vendida}</strong>
        </td>
        <td class="td-price text-right td-num">${formatMoney(sale.precio_venta_unitario)}</td>
        <td class="td-total text-right td-num"><strong>${formatMoney(totalVenta)}</strong></td>
        <td class="td-fee text-right td-num">${sale.comision_envio_monto > 0 ? `<span class="fee-negative">-${formatMoney(sale.comision_envio_monto)}</span>` : '<span class="text-muted">-</span>'}</td>
        <td class="td-profit text-right td-num">
          <strong class="${sale.ganancia_neta_real >= 0 ? 'text-success' : 'text-danger'}">
            ${sale.ganancia_neta_real >= 0 ? '+' : ''}${formatMoney(sale.ganancia_neta_real)}
          </strong>
        </td>
        <td class="td-action text-right">
          <div class="table-actions" style="justify-content: flex-end;">
            <button class="btn btn-whatsapp btn-xs btn-wa-receipt" data-id="${sale.id}" title="Enviar comprobante por WhatsApp">
              📲 Recibo
            </button>
            <button class="btn btn-outline-danger btn-xs btn-cancel-sale" data-id="${sale.id}" title="Anular venta y reponer stock">
              &times;
            </button>
          </div>
        </td>
      `;

      tr.querySelector(".btn-wa-receipt").addEventListener("click", () => {
        sendSaleReceiptWhatsApp(sale);
      });

      tr.querySelector(".btn-cancel-sale").addEventListener("click", () => {
        cancelSale(sale.id, sale.nombre_producto);
      });

      DOM.salesTableBody.appendChild(tr);
    });
  }

  function populateInventorySalesSelect() {
    if (!DOM.saleInventoryProductSelect) return;
    const currentVal = DOM.saleInventoryProductSelect.value;
    DOM.saleInventoryProductSelect.innerHTML = `<option value="">-- Elige un producto en mano --</option>`;

    state.inventory.forEach(prod => {
      const opt = document.createElement("option");
      opt.value = prod.id;
      const shortName = prod.nombre.length > 42 ? prod.nombre.substring(0, 39) + "..." : prod.nombre;
      opt.textContent = `${shortName} (Stock: ${prod.stock} un. | Costo: S/ ${prod.costo_unitario.toFixed(2)})`;
      opt.title = `${prod.nombre} - Stock disponible: ${prod.stock} un.`;
      DOM.saleInventoryProductSelect.appendChild(opt);
    });

    if (currentVal) {
      DOM.saleInventoryProductSelect.value = currentVal;
    }
  }

  // Toggle entre Mercadería Propia vs Venta Manual
  const saleRadioPills = document.querySelectorAll("input[name='saleProductSourceRadio']");
  saleRadioPills.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const isInventory = e.target.value === "inventory";
      document.querySelectorAll(".source-radio-pill").forEach(p => p.classList.remove("active"));
      e.target.closest(".source-radio-pill").classList.add("active");

      if (isInventory) {
        DOM.groupSaleInventorySelect.classList.remove("hidden");
        DOM.saleProductName.readOnly = true;
        DOM.saleProductName.placeholder = "Se completará al elegir el producto";
        if (DOM.saleInventoryProductSelect.value) {
          syncSelectedInventoryProduct();
        }
      } else {
        DOM.groupSaleInventorySelect.classList.add("hidden");
        DOM.saleProductName.readOnly = false;
        DOM.saleProductName.placeholder = "Ej. Cable USB-C Carga Rápida";
        DOM.saleProductName.value = "";
        DOM.saleUnitCost.value = "";
        DOM.saleUnitPrice.value = "";
        DOM.saleStockAlert.classList.add("hidden");
        updateSaleLiveCalc();
      }
    });
  });

  if (DOM.saleInventoryProductSelect) {
    DOM.saleInventoryProductSelect.addEventListener("change", syncSelectedInventoryProduct);
  }

  function syncSelectedInventoryProduct() {
    const prodId = parseInt(DOM.saleInventoryProductSelect.value);
    if (!prodId) {
      DOM.saleStockAlert.classList.add("hidden");
      DOM.saleProductName.value = "";
      DOM.saleUnitCost.value = "";
      DOM.saleUnitPrice.value = "";
      updateSaleLiveCalc();
      return;
    }

    const prod = state.inventory.find(p => p.id === prodId);
    if (!prod) return;

    DOM.saleProductName.value = prod.nombre;
    DOM.saleUnitCost.value = prod.costo_unitario.toFixed(2);
    DOM.saleUnitPrice.value = prod.precio_venta.toFixed(2);

    // Alerta de stock visual
    DOM.saleStockAlert.classList.remove("hidden", "warning", "danger");
    if (prod.stock > 3) {
      DOM.saleStockAlert.className = "stock-live-alert";
      DOM.saleStockAlertText.textContent = `Stock disponible: ${prod.stock} unidades en almacén`;
    } else if (prod.stock > 0) {
      DOM.saleStockAlert.className = "stock-live-alert warning";
      DOM.saleStockAlertText.textContent = `⚠️ ¡Últimas ${prod.stock} unidades en almacén!`;
    } else {
      DOM.saleStockAlert.className = "stock-live-alert danger";
      DOM.saleStockAlertText.textContent = `✕ Agotado (0 unidades en almacén). Reponer stock.`;
    }

    updateSaleLiveCalc();
  }

  function updateSaleLiveCalc() {
    if (!DOM.saleQuantity || !DOM.saleUnitPrice || !DOM.saleUnitCost) return;

    const qty = parseInt(DOM.saleQuantity.value) || 0;
    const unitPrice = parseFloat(DOM.saleUnitPrice.value) || 0;
    const unitCost = parseFloat(DOM.saleUnitCost.value) || 0;
    const fee = parseFloat(DOM.saleCommissionDelivery ? DOM.saleCommissionDelivery.value : 0) || 0;

    const gross = round2(unitPrice * qty);
    const totalCost = round2(unitCost * qty);
    const netProfit = round2(gross - totalCost - fee);
    const marginPct = totalCost > 0 ? Math.round(((netProfit / totalCost) * 1000) / 10) : 0;

    if (DOM.saleCalcGross) DOM.saleCalcGross.textContent = formatMoney(gross);
    if (DOM.saleCalcCost) DOM.saleCalcCost.textContent = formatMoney(totalCost);
    if (DOM.saleCalcFees) DOM.saleCalcFees.textContent = `-${formatMoney(fee)}`;
    if (DOM.saleCalcNetProfit) {
      DOM.saleCalcNetProfit.textContent = `${netProfit >= 0 ? '+' : ''}${formatMoney(netProfit)}`;
      DOM.saleCalcNetProfit.className = netProfit >= 0 ? "calc-val text-success" : "calc-val text-danger";
    }
    if (DOM.saleCalcMarginPct) {
      DOM.saleCalcMarginPct.textContent = `${marginPct >= 0 ? '+' : ''}${marginPct.toFixed(1)}%`;
      DOM.saleCalcMarginPct.className = marginPct >= 0 ? "badge-profit" : "badge-profit negative";
    }
  }

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  [DOM.saleQuantity, DOM.saleUnitPrice, DOM.saleUnitCost, DOM.saleCommissionDelivery].forEach(input => {
    if (input) input.addEventListener("input", updateSaleLiveCalc);
  });

  // Envío del Formulario de Registro de Venta
  if (DOM.formNewSale) {
    DOM.formNewSale.addEventListener("submit", async (e) => {
      e.preventDefault();

      const sourceRadio = document.querySelector("input[name='saleProductSourceRadio']:checked");
      const isInventory = sourceRadio ? sourceRadio.value === "inventory" : true;
      const prodId = isInventory ? (parseInt(DOM.saleInventoryProductSelect.value) || null) : null;

      if (isInventory && !prodId) {
        showToast("Selecciona un producto de tu mercadería propia", "warning");
        return;
      }

      const prodName = DOM.saleProductName.value.trim();
      const qty = parseInt(DOM.saleQuantity.value) || 1;
      const unitCost = parseFloat(DOM.saleUnitCost.value) || 0;
      const unitPrice = parseFloat(DOM.saleUnitPrice.value) || 0;
      const fee = parseFloat(DOM.saleCommissionDelivery ? DOM.saleCommissionDelivery.value : 0) || 0;
      const channel = DOM.saleChannel ? DOM.saleChannel.value : "Venta Directa";
      const notes = DOM.saleNotes ? DOM.saleNotes.value.trim() : "";
      const customerPhone = DOM.saleCustomerPhone ? DOM.saleCustomerPhone.value.trim() : null;
      const customerName = document.getElementById("saleCustomerName") ? document.getElementById("saleCustomerName").value.trim() : null;
      const customerDistrict = document.getElementById("saleCustomerDistrict") ? document.getElementById("saleCustomerDistrict").value.trim() : null;
      const shippingRateId = document.getElementById("saleShippingRateSelect") ? parseInt(document.getElementById("saleShippingRateSelect").value) || null : null;

      if (!prodName) {
        showToast("Indica el nombre del producto vendido", "warning");
        return;
      }

      // Validar stock si proviene de mercadería propia
      if (isInventory && prodId) {
        const prod = state.inventory.find(p => p.id === prodId);
        if (prod && prod.stock < qty) {
          showToast(`Stock insuficiente. Solo quedan ${prod.stock} unidades de "${prod.nombre}"`, "warning");
          return;
        }
      }

      DOM.btnSubmitSale.disabled = true;
      DOM.btnSubmitSale.innerHTML = `<span>Registrando venta...</span>`;

      try {
        const res = await fetch("/api/sales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            producto_propio_id: prodId,
            nombre_producto: prodName,
            cantidad_vendida: qty,
            precio_venta_unitario: unitPrice,
            costo_unitario: unitCost,
            comision_envio_monto: fee,
            canal_venta: channel,
            telefono_cliente: customerPhone,
            cliente_nombre: customerName,
            distrito_cliente: customerDistrict,
            tarifa_envio_id: shippingRateId,
            notas: notes
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Error al registrar la venta");
        }

        const saleData = await res.json();
        showToast(`✓ Venta registrada: +${formatMoney(saleData.ganancia_neta_real)} ganancia neta`, "success");

        // Resetear formulario
        DOM.saleQuantity.value = 1;
        DOM.saleCommissionDelivery.value = "0.00";
        if (DOM.saleNotes) DOM.saleNotes.value = "";
        if (DOM.saleCustomerPhone) DOM.saleCustomerPhone.value = "";
        if (document.getElementById("saleCustomerName")) document.getElementById("saleCustomerName").value = "";
        if (document.getElementById("saleCustomerDistrict")) document.getElementById("saleCustomerDistrict").value = "";
        if (document.getElementById("saleShippingRateSelect")) document.getElementById("saleShippingRateSelect").value = "";
        if (!isInventory) {
          DOM.saleProductName.value = "";
          DOM.saleUnitCost.value = "";
          DOM.saleUnitPrice.value = "";
        }

        // Recargar inventario y ventas
        await loadInventory();
        await loadSales();
        if (typeof loadCrmClients === "function") await loadCrmClients();
        updateSaleLiveCalc();

        // Si se ingresó teléfono, sugerir enviar comprobante de inmediato
        if (customerPhone) {
          if (confirm(`¿Deseas enviar el comprobante de compra por WhatsApp a ${customerPhone} ahora?`)) {
            sendSaleReceiptWhatsApp(saleData);
          }
        }
      } catch (err) {
        console.error(err);
        showToast(err.message || "Error al procesar la venta", "error");
      } finally {
        DOM.btnSubmitSale.disabled = false;
        DOM.btnSubmitSale.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Registrar Venta & Descontar Stock</span>
        `;
      }
    });
  }

  // Anulación de Venta
  async function cancelSale(saleId, productName) {
    if (!confirm(`¿Deseas anular la venta de "${productName}"? El stock vendido será retornado al inventario de almacén.`)) return;

    try {
      const res = await fetch(`/api/sales/${saleId}?revert_stock=true`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Error anulando la venta");

      showToast(`Venta de "${productName}" anulada y stock devuelto`, "warning");
      await loadInventory();
      await loadSales();
    } catch (err) {
      console.error(err);
      showToast("Error al anular la venta", "error");
    }
  }

  // Apertura rápida de venta para un producto específico desde Inventario
  function openSaleForProduct(productId) {
    switchTab("tab-sales");

    // Seleccionar radio Mercadería Propia
    const radioInv = document.querySelector("input[name='saleProductSourceRadio'][value='inventory']");
    if (radioInv) {
      radioInv.checked = true;
      document.querySelectorAll(".source-radio-pill").forEach(p => p.classList.remove("active"));
      if (DOM.labelSourceInventory) DOM.labelSourceInventory.classList.add("active");
    }
    DOM.groupSaleInventorySelect.classList.remove("hidden");
    DOM.saleProductName.readOnly = true;

    // Seleccionar producto en el dropdown
    if (DOM.saleInventoryProductSelect) {
      DOM.saleInventoryProductSelect.value = productId;
      syncSelectedInventoryProduct();
    }

    // Scroll suave hacia el formulario
    if (DOM.formNewSale) {
      DOM.formNewSale.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Registrar venta directa desde un ítem del Lote
  async function sellLotItem(lotItemId, nombre) {
    if (!confirm(`¿Deseas registrar la venta de "${nombre}" cerrando este ítem del lote?`)) return;

    try {
      const res = await fetch(`/api/sales/from-lot/${lotItemId}`, {
        method: "POST"
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error al liquidar venta desde lote");
      }

      const sale = await res.json();
      showToast(`✓ Venta liquidada desde Lote: +${formatMoney(sale.ganancia_neta_real)} ganancia neta`, "success");

      await loadLot();
      await loadInventory();
      await loadSales();
    } catch (err) {
      console.error(err);
      showToast(err.message || "Error al liquidar ítem del lote", "error");
    }
  }

  // Filtro de búsqueda en tiempo real de la tabla de ventas
  if (DOM.salesSearchFilter) {
    DOM.salesSearchFilter.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) {
        renderSales();
        return;
      }
      const filtered = state.sales.filter(s => {
        const text = `${s.nombre_producto} ${s.canal_venta} ${s.notas || ''}`.toLowerCase();
        return text.includes(q);
      });
      renderSales(filtered);
    });
  }

  // ==========================================
  // EXPORTACIÓN LIMPIA A CSV (EXCEL / SHEETS CON BOM \ufeff)
  // ==========================================

  function escapeCsvCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  function downloadCsvFile(filename, csvContent) {
    // \ufeff es el Byte Order Mark (BOM) UTF-8 para que Excel y Sheets abran tildes y S/ perfectamente
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Exportar CSV del Lote de Operación
  if (DOM.btnExportLotCsv) {
    DOM.btnExportLotCsv.addEventListener("click", () => {
      if (state.lotItems.length === 0) {
        showToast("El lote de operación está vacío para exportar", "warning");
        return;
      }

      const headers = [
        "ID",
        "Origen",
        "Tienda / Proveedor",
        "Nombre Producto",
        "Cantidad",
        `Costo Unitario (${state.currency})`,
        `Precio Venta (${state.currency})`,
        `Subtotal Costo (${state.currency})`,
        `Subtotal Venta (${state.currency})`,
        `Ganancia Estimada (${state.currency})`,
        "Notas"
      ];

      const factor = state.currency === "USD" ? (1 / state.exchangeRate) : 1;

      const rows = state.lotItems.map(item => {
        const isPropio = item.origen.toUpperCase() === "PROPIO";
        const costoUnit = (item.costo_compra * factor).toFixed(2);
        const precioVenta = (item.precio_venta * factor).toFixed(2);
        const subtotalCosto = (item.subtotal_costo * factor).toFixed(2);
        const subtotalVenta = (item.subtotal_venta * factor).toFixed(2);
        const ganancia = (item.ganancia_estimada * factor).toFixed(2);

        return [
          item.id,
          isPropio ? "Mercadería Propia" : "Externo",
          item.tienda,
          item.nombre,
          item.cantidad,
          costoUnit,
          precioVenta,
          subtotalCosto,
          subtotalVenta,
          ganancia,
          item.notas || ""
        ].map(escapeCsvCell).join(",");
      });

      // Fila de Resumen Consolidado
      const totalInv = (state.lotSummary.inversion_nueva * factor).toFixed(2);
      const totalPropio = (state.lotSummary.stock_propio_valor * factor).toFixed(2);
      const totalCosto = ((state.lotSummary.inversion_nueva + state.lotSummary.stock_propio_valor) * factor).toFixed(2);
      const totalIngreso = (state.lotSummary.ingreso_bruto_proyectado * factor).toFixed(2);
      const totalGanancia = (state.lotSummary.ganancia_neta_total * factor).toFixed(2);

      rows.push("");
      rows.push([
        "TOTALES LOTE",
        `Moneda: ${state.currency}`,
        `Ítems: ${state.lotSummary.total_items}`,
        `Unidades: ${state.lotSummary.total_unidades}`,
        "",
        "",
        "",
        totalCosto,
        totalIngreso,
        totalGanancia,
        `Margen Promedio: ${state.lotSummary.margen_promedio_porcentaje.toFixed(1)}%`
      ].map(escapeCsvCell).join(","));

      const csvContent = [headers.join(","), ...rows].join("\r\n");
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadCsvFile(`KipuStock_Lote_${dateStr}_${state.currency}.csv`, csvContent);
      showToast("✓ Archivo CSV del Lote descargado con codificación UTF-8", "success");
    });
  }

  // Exportar CSV del Historial de Ventas
  if (DOM.btnExportSalesCsv) {
    DOM.btnExportSalesCsv.addEventListener("click", () => {
      if (state.sales.length === 0) {
        showToast("No hay registros de ventas para exportar", "warning");
        return;
      }

      const headers = [
        "ID Venta",
        "Fecha",
        "Producto",
        "Origen",
        "Canal de Venta",
        "Cantidad Vendida",
        `Precio Unitario (${state.currency})`,
        `Costo Unitario (${state.currency})`,
        `Ingreso Bruto Total (${state.currency})`,
        `Costo Total (${state.currency})`,
        `Comisión / Flete (${state.currency})`,
        `Ganancia Neta Real (${state.currency})`,
        "Margen (%)",
        "Notas"
      ];

      const factor = state.currency === "USD" ? (1 / state.exchangeRate) : 1;

      const rows = state.sales.map(s => {
        const isPropio = !!s.producto_propio_id;
        const pUnit = (s.precio_venta_unitario * factor).toFixed(2);
        const cUnit = (s.costo_unitario * factor).toFixed(2);
        const totVenta = (s.precio_venta_unitario * s.cantidad_vendida * factor).toFixed(2);
        const totCosto = (s.costo_unitario * s.cantidad_vendida * factor).toFixed(2);
        const comision = (s.comision_envio_monto * factor).toFixed(2);
        const ganancia = (s.ganancia_neta_real * factor).toFixed(2);
        const fecha = new Date(s.fecha_venta).toLocaleString("es-PE");

        return [
          s.id,
          fecha,
          s.nombre_producto,
          isPropio ? "Mercadería Propia" : "Venta Libre",
          s.canal_venta,
          s.cantidad_vendida,
          pUnit,
          cUnit,
          totVenta,
          totCosto,
          comision,
          ganancia,
          `${s.margen_porcentaje.toFixed(1)}%`,
          s.notas || ""
        ].map(escapeCsvCell).join(",");
      });

      // Fila de resumen de ventas
      const totVentasMonto = (state.salesSummary.total_ventas_monto * factor).toFixed(2);
      const totCostosMonto = (state.salesSummary.total_costos_monto * factor).toFixed(2);
      const totComisiones = (state.salesSummary.total_comisiones_envio * factor).toFixed(2);
      const totGananciaAcum = (state.salesSummary.ganancia_neta_acumulada * factor).toFixed(2);

      rows.push("");
      rows.push([
        "RESUMEN VENTAS",
        `Moneda: ${state.currency}`,
        `Operaciones: ${state.salesSummary.total_operaciones}`,
        `Unidades: ${state.salesSummary.total_unidades_vendidas}`,
        "",
        "",
        "",
        "",
        totVentasMonto,
        totCostosMonto,
        totComisiones,
        totGananciaAcum,
        `Margen Prom: ${state.salesSummary.margen_promedio_porcentaje.toFixed(1)}%`,
        ""
      ].map(escapeCsvCell).join(","));

      const csvContent = [headers.join(","), ...rows].join("\r\n");
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadCsvFile(`KipuStock_Ventas_${dateStr}_${state.currency}.csv`, csvContent);
      showToast("✓ Archivo CSV de Ventas descargado con codificación UTF-8", "success");
    });
  }

  // ==========================================
  // CONFIRMACIÓN Y REGISTRO DE VENTAS DEL LOTE COMPLETO
  // ==========================================

  function openConfirmLotSalesModal() {
    if (state.lotItems.length === 0) {
      showToast("Agrega al menos un ítem al lote para registrar ventas", "warning");
      return;
    }

    if (!DOM.confirmLotSalesModal || !DOM.lotSalesModalPreview) return;

    // Generar vista previa con detalle de stock propio y totales
    let itemsHtml = "";
    let hayPropioSinStock = false;
    let totalUnidades = 0;

    state.lotItems.forEach(item => {
      const isPropio = item.origen.toUpperCase() === "PROPIO";
      totalUnidades += item.cantidad;

      let stockWarning = "";
      if (isPropio && item.referencia_id) {
        const prod = state.inventory.find(p => p.id === item.referencia_id);
        if (prod) {
          if (prod.stock < item.cantidad) {
            hayPropioSinStock = true;
            stockWarning = `<span style="color: var(--danger); font-size: 0.72rem;"> (⚠️ Stock insuficiente: ${prod.stock} disp.)</span>`;
          } else {
            stockWarning = `<span style="color: var(--success); font-size: 0.72rem;"> (Quedarán ${prod.stock - item.cantidad} un.)</span>`;
          }
        }
      }

      itemsHtml += `
        <div class="lot-sales-preview-row">
          <div style="min-width: 0;">
            <span class="item-name" title="${item.nombre}">${item.nombre}</span>
            <span class="item-stock-tag ${isPropio ? 'propio' : 'externo'}">${isPropio ? 'Propio' : 'Externo'} x ${item.cantidad}</span>
            ${stockWarning}
          </div>
          <div style="font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums;">
            ${formatMoney(item.subtotal_venta)}
          </div>
        </div>
      `;
    });

    DOM.lotSalesModalPreview.innerHTML = `
      <h4>Resumen Financiero del Lote</h4>
      <div class="lot-sales-summary-grid">
        <div class="lot-sales-summary-item">
          <span class="lbl">Total Cobrado (Ingreso):</span>
          <span class="val" style="color: var(--primary);">${formatMoney(state.lotSummary.ingreso_bruto_proyectado)}</span>
        </div>
        <div class="lot-sales-summary-item">
          <span class="lbl">Costo Total Comprometido:</span>
          <span class="val">${formatMoney(state.lotSummary.inversion_nueva + state.lotSummary.stock_propio_valor)}</span>
        </div>
        <div class="lot-sales-summary-item">
          <span class="lbl">Ganancia Neta Estimada:</span>
          <span class="val text-success">+${formatMoney(state.lotSummary.ganancia_neta_total)}</span>
        </div>
        <div class="lot-sales-summary-item">
          <span class="lbl">Operaciones a Generar:</span>
          <span class="val">${state.lotItems.length} ventas (${totalUnidades} uds)</span>
        </div>
      </div>
      <div class="lot-sales-items-preview">
        ${itemsHtml}
      </div>
    `;

    if (hayPropioSinStock) {
      DOM.btnExecuteLotSales.disabled = true;
      DOM.btnExecuteLotSales.textContent = "⚠️ Corrige el stock antes de continuar";
    } else {
      DOM.btnExecuteLotSales.disabled = false;
      DOM.btnExecuteLotSales.textContent = "✓ Confirmar y Registrar Ventas";
    }

    DOM.confirmLotSalesModal.classList.remove("hidden");
  }

  function closeConfirmLotSalesModal() {
    if (DOM.confirmLotSalesModal) {
      DOM.confirmLotSalesModal.classList.add("hidden");
    }
  }

  if (DOM.btnOpenConfirmLotSalesModal) {
    DOM.btnOpenConfirmLotSalesModal.addEventListener("click", openConfirmLotSalesModal);
  }
  if (DOM.btnCloseConfirmLotSalesModal) {
    DOM.btnCloseConfirmLotSalesModal.addEventListener("click", closeConfirmLotSalesModal);
  }
  if (DOM.btnCancelConfirmLotSales) {
    DOM.btnCancelConfirmLotSales.addEventListener("click", closeConfirmLotSalesModal);
  }

  if (DOM.btnExecuteLotSales) {
    DOM.btnExecuteLotSales.addEventListener("click", async () => {
      const channel = DOM.lotSaleChannel ? DOM.lotSaleChannel.value : "Venta Directa";
      const globalFee = parseFloat(DOM.lotSaleGlobalCommission ? DOM.lotSaleGlobalCommission.value : 0) || 0;
      const clearLot = DOM.lotSaleClearCheck ? DOM.lotSaleClearCheck.checked : true;

      DOM.btnExecuteLotSales.disabled = true;
      DOM.btnExecuteLotSales.innerHTML = `<span>Procesando ventas...</span>`;

      try {
        const res = await fetch("/api/sales/from-lot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            canal_venta: channel,
            comision_global_monto: globalFee,
            limpiar_lote: clearLot
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || "Error al procesar ventas del lote");
        }

        const resData = await res.json();
        showToast(`✓ ${resData.message}`, "success");
        closeConfirmLotSalesModal();

        // Actualizar todos los estados en simultáneo
        await loadLot();
        await loadInventory();
        await loadSales();

        // Cambiar a la pestaña de ventas para ver el resultado
        switchTab("tab-sales");
      } catch (err) {
        console.error(err);
        showToast(err.message || "Error al registrar ventas del lote", "error");
      } finally {
        DOM.btnExecuteLotSales.disabled = false;
        DOM.btnExecuteLotSales.textContent = "✓ Confirmar y Registrar Ventas";
      }
    });
  }

  // ==========================================
  // WHATSAPP: COMPARTIR PRODUCTO Y COMPROBANTES
  // ==========================================

  function shareProductWhatsApp(item) {
    const priceStr = formatMoney(item.precio_venta || item.precio_compra);
    const estadoStr = item.estado ? `Estado: *${item.estado}*` : 'Estado: *Excelente condición*';
    const storeLink = getActiveStorePublicUrl();
    const linkStr = storeLink ? `🌐 *Catálogo Online:* ${storeLink}\n` : '';
    const msg = `🛍️ *KIPUSTOCK - MERCADERÍA DISPONIBLE*\n\n` +
      `📦 *Producto:* ${item.nombre}\n` +
      `💰 *Precio especial:* ${priceStr}\n` +
      `⚡ *Disponibilidad:* Stock disponible en almacén\n` +
      `✨ ${estadoStr}\n` +
      `🚚 *Entrega:* Despacho rápido y seguro\n` +
      linkStr +
      `\n¿Te gustaría separarlo o coordinar el envío? Escríbeme y lo coordinamos de inmediato.`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  function sendSaleReceiptWhatsApp(sale) {
    const cleanPhone = (sale.telefono_cliente || "").replace(/[^0-9]/g, "");
    const totalStr = formatMoney(sale.total_ingreso || (sale.precio_venta_unitario * sale.cantidad_vendida));
    const unitStr = formatMoney(sale.precio_venta_unitario);
    const fechaObj = new Date(sale.fecha_venta);
    const fechaStr = isNaN(fechaObj.getTime())
      ? "Hoy"
      : `${fechaObj.toLocaleDateString("es-PE")} ${fechaObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;

    const msg = `🧾 *COMPROBANTE DE COMPRA - KIPUSTOCK*\n\n` +
      `¡Hola! Muchas gracias por tu preferencia. Aquí tienes el detalle de tu compra:\n\n` +
      `📦 *Producto:* ${sale.nombre_producto}\n` +
      `🔢 *Cantidad:* ${sale.cantidad_vendida} unidad(es)\n` +
      `💵 *Precio Unitario:* ${unitStr}\n` +
      `💰 *Total Abonado:* ${totalStr}\n` +
      `📅 *Fecha de Operación:* ${fechaStr}\n` +
      (sale.notas ? `📝 *Detalles de entrega:* ${sale.notas}\n\n` : `\n`) +
      `✅ ¡Venta confirmada exitosamente! Estamos a tu servicio para cualquier duda o consulta.`;

    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  }

  // ==========================================
  // MONITOR DE OPORTUNIDADES & WATCHLIST
  // ==========================================

  async function loadAlerts() {
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        state.alerts = await res.json();
        renderAlerts();
      }
    } catch (err) {
      console.warn("No se pudieron cargar las alertas:", err);
    }
  }

  function renderAlerts() {
    if (!DOM.alertsContainer) return;
    DOM.alertsContainer.innerHTML = "";

    if (!state.alerts || state.alerts.length === 0) {
      DOM.alertsContainer.innerHTML = `
        <div style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 1rem; border: 1px dashed var(--border-color); border-radius: 8px;">
          No tienes alertas guardadas aún. Haz clic en "+ Nueva Alerta" para monitorear productos estratégicos.
        </div>
      `;
      return;
    }

    state.alerts.forEach(alert => {
      const card = document.createElement("div");
      card.className = `alert-card-item ${alert.activo ? '' : 'disabled'}`;

      const priceMaxTxt = alert.precio_maximo ? `Máx: ${formatMoney(alert.precio_maximo)}` : 'Sin límite';
      const marginTxt = `Mín: ${alert.margen_minimo_pct}% margen`;

      card.innerHTML = `
        <div class="alert-item-header">
          <span class="alert-item-term">${alert.termino_busqueda}</span>
          <button class="btn btn-outline-danger btn-xs btn-delete-alert" data-id="${alert.id}" title="Eliminar alerta">&times;</button>
        </div>
        <div class="alert-item-meta">
          <span class="alert-meta-tag">💰 ${priceMaxTxt}</span>
          <span class="alert-meta-tag">📈 ${marginTxt}</span>
          <span class="alert-meta-tag">🏬 ${alert.tiendas_objetivo}</span>
        </div>
        <div class="alert-item-actions">
          <label class="alert-toggle-label">
            <input type="checkbox" class="toggle-alert-active" data-id="${alert.id}" ${alert.activo ? 'checked' : ''}>
            <span>${alert.activo ? 'Activa' : 'Pausada'}</span>
          </label>
          <button class="btn btn-xs btn-secondary btn-quick-search-alert" data-term="${alert.termino_busqueda}" title="Buscar término en el formulario">
            🔍 Buscar ahora
          </button>
        </div>
      `;

      card.querySelector(".btn-delete-alert").addEventListener("click", () => deleteAlert(alert.id, alert.termino_busqueda));
      card.querySelector(".toggle-alert-active").addEventListener("change", () => toggleAlert(alert.id));
      card.querySelector(".btn-quick-search-alert").addEventListener("click", () => {
        if (DOM.searchQuery) {
          DOM.searchQuery.value = alert.termino_busqueda;
          if (DOM.filterMinMargin) DOM.filterMinMargin.value = alert.margen_minimo_pct;
          if (DOM.filterMaxPrice && alert.precio_maximo) DOM.filterMaxPrice.value = alert.precio_maximo;
          if (DOM.searchForm) DOM.searchForm.requestSubmit();
        }
      });

      DOM.alertsContainer.appendChild(card);
    });
  }

  async function toggleAlert(alertId) {
    try {
      const res = await fetch(`/api/alerts/${alertId}/toggle`, { method: "PUT" });
      if (res.ok) {
        await loadAlerts();
      }
    } catch (e) {
      console.error(e);
      showToast("Error al alternar estado de la alerta", "error");
    }
  }

  async function deleteAlert(alertId, term) {
    if (!confirm(`¿Eliminar la alerta para "${term}"?`)) return;
    try {
      const res = await fetch(`/api/alerts/${alertId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Alerta eliminada", "info");
        await loadAlerts();
      }
    } catch (e) {
      console.error(e);
      showToast("Error al eliminar la alerta", "error");
    }
  }

  // Toggle y Submit de Nueva Alerta
  if (DOM.btnToggleNewAlertForm) {
    DOM.btnToggleNewAlertForm.addEventListener("click", () => {
      if (DOM.newAlertFormWrap) {
        DOM.newAlertFormWrap.classList.toggle("hidden");
        if (!DOM.newAlertFormWrap.classList.contains("hidden") && DOM.alertTerm) {
          DOM.alertTerm.focus();
        }
      }
    });
  }

  if (DOM.btnCancelAlert) {
    DOM.btnCancelAlert.addEventListener("click", () => {
      if (DOM.newAlertFormWrap) DOM.newAlertFormWrap.classList.add("hidden");
    });
  }

  if (DOM.formNewAlert) {
    DOM.formNewAlert.addEventListener("submit", async (e) => {
      e.preventDefault();
      const term = DOM.alertTerm.value.trim();
      const maxP = parseFloat(DOM.alertMaxPrice.value) || null;
      const minM = parseFloat(DOM.alertMinMargin.value) || 20.0;

      if (!term) {
        showToast("Ingresa un término de búsqueda", "warning");
        return;
      }

      try {
        const res = await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            termino_busqueda: term,
            precio_maximo: maxP,
            margen_minimo_pct: minM,
            tiendas_objetivo: "Falabella,Ripley,Sodimac"
          })
        });

        if (!res.ok) throw new Error("Error al guardar alerta");
        showToast(`✓ Alerta creada para "${term}"`, "success");
        DOM.alertTerm.value = "";
        DOM.alertMaxPrice.value = "";
        if (DOM.newAlertFormWrap) DOM.newAlertFormWrap.classList.add("hidden");
        await loadAlerts();
      } catch (err) {
        console.error(err);
        showToast("No se pudo guardar la alerta", "error");
      }
    });
  }

  // Ejecución del Rastreo de Alertas
  if (DOM.btnRunAlertsScan) {
    DOM.btnRunAlertsScan.addEventListener("click", async () => {
      const activeCount = state.alerts.filter(a => a.activo).length;
      if (activeCount === 0) {
        showToast("No tienes alertas activas. Activa una alerta o crea una nueva.", "warning");
        return;
      }

      DOM.btnRunAlertsScan.classList.add("scanning");
      DOM.btnRunAlertsScan.innerHTML = `<span>⚡ Rastreador escaneando tiendas...</span>`;

      try {
        const res = await fetch("/api/alerts/run", { method: "POST" });
        if (!res.ok) throw new Error("Error en rastreo");
        const scanData = await res.json();

        showToast(scanData.message, "success");

        // Mostrar resultados
        renderAlertsScanResults(scanData);
      } catch (err) {
        console.error(err);
        showToast("Error al ejecutar el rastreo de alertas", "error");
      } finally {
        DOM.btnRunAlertsScan.classList.remove("scanning");
        DOM.btnRunAlertsScan.innerHTML = `<span>⚡ Ejecutar Rastreo de Alertas Ahora</span>`;
      }
    });
  }

  if (DOM.btnCloseAlertsResults) {
    DOM.btnCloseAlertsResults.addEventListener("click", () => {
      if (DOM.alertsResultsContainer) DOM.alertsResultsContainer.classList.add("hidden");
    });
  }

  function renderAlertsScanResults(scanData) {
    if (!DOM.alertsResultsContainer || !DOM.alertsMatchesGrid) return;

    DOM.alertsResultsContainer.classList.remove("hidden");
    DOM.alertsMatchesGrid.innerHTML = "";

    const allMatches = [];
    (scanData.resultados || []).forEach(r => {
      (r.oportunidades || []).forEach(op => {
        allMatches.push({ ...op, alertaTerm: r.termino_busqueda });
      });
    });

    if (DOM.alertsResultsTitle) {
      DOM.alertsResultsTitle.textContent = `⚡ ${allMatches.length} Oportunidades Detectadas por tus Alertas`;
    }

    if (allMatches.length === 0) {
      DOM.alertsMatchesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 1.5rem; text-align: center; color: var(--text-muted); background: rgba(11, 15, 25, 0.5); border-radius: 8px;">
          Se rastrearon las tiendas pero ningún producto cumplió con el margen o precio límite en este momento. Intenta ajustar los márgenes o ampliar portales.
        </div>
      `;
      return;
    }

    allMatches.forEach(item => {
      const card = document.createElement("div");
      card.className = "result-card";
      const buyPrice = formatMoney(item.precio_compra);
      const sellPrice = formatMoney(item.precio_referencia_venta);
      const profit = formatMoney(item.margen_neto);

      card.innerHTML = `
        <div class="card-img-wrap">
          <span class="store-badge">${item.sitio}</span>
          <img class="card-img" src="${item.foto_url ? item.foto_url : NEUTRAL_PLACEHOLDER}" alt="${item.nombre}" onerror="this.onerror=null; this.src='${NEUTRAL_PLACEHOLDER}'" />
          <span class="margin-badge">+${item.margen_porcentaje.toFixed(1)}% MARGEN</span>
        </div>
        <div class="card-body">
          <div style="font-size: 0.72rem; color: #38bdf8; font-weight: 600; margin-bottom: 0.25rem;">Alerta: "${item.alertaTerm}"</div>
          <h4 class="card-title" title="${item.nombre}">${item.nombre}</h4>
          
          <div class="price-comparison-grid">
            <div class="price-box">
              <span class="price-lbl">Compra en ${item.sitio}:</span>
              <span class="price-val">${buyPrice}</span>
            </div>
            <div class="price-box">
              <span class="price-lbl">Venta Ref.:</span>
              <span class="price-val sell-val">${sellPrice}</span>
            </div>
          </div>

          <div class="profit-highlight">
            <span class="profit-lbl">Ganancia Neta Real:</span>
            <span class="profit-val">+${profit}</span>
          </div>

          <div class="card-actions" style="margin-top: 0.75rem; display: flex; gap: 6px;">
            <button class="btn btn-primary btn-sm btn-block btn-add-alert-to-lot" title="Sumar esta oportunidad a la Lista Sumatoria">
              + Sumar al Lote
            </button>
            <button class="btn btn-whatsapp btn-sm btn-wa-share-alert" title="Compartir por WhatsApp">
              📲
            </button>
          </div>
        </div>
      `;

      card.querySelector(".btn-add-alert-to-lot").addEventListener("click", () => {
        addItemToLot({
          origen: "EXTERNO",
          referencia_id: null,
          nombre: item.nombre,
          tienda: item.sitio,
          foto_url: item.foto_url,
          cantidad: 1,
          costo_compra: item.precio_compra,
          precio_venta: item.precio_referencia_venta,
          notas: `Detectado por Alerta "${item.alertaTerm}".`
        });
      });

      card.querySelector(".btn-wa-share-alert").addEventListener("click", () => {
        shareProductWhatsApp(item);
      });

      DOM.alertsMatchesGrid.appendChild(card);
    });
  }

  // ==========================================
  // ADMINISTRACIÓN DE TIENDA WEB & PEDIDOS
  // ==========================================

  async function loadAdminStoreConfig() {
    try {
      const res = await fetch("/api/store/config");
      if (res.ok) {
        state.storeConfig = await res.json();
        if (DOM.storeCfgName) DOM.storeCfgName.value = state.storeConfig.nombre_tienda || "";
        if (DOM.storeCfgPhone) DOM.storeCfgPhone.value = state.storeConfig.whatsapp_ventas || "";
        if (DOM.storeCfgWelcome) DOM.storeCfgWelcome.value = state.storeConfig.mensaje_bienvenida || "";
        if (DOM.storeCfgInstructions) DOM.storeCfgInstructions.value = state.storeConfig.instrucciones_pago || "";

        if (state.storeConfig.qr_yape_url && DOM.storeCfgQrYapePreview) {
          DOM.storeCfgQrYapePreview.src = state.storeConfig.qr_yape_url;
          DOM.storeCfgQrYapePreview.style.display = "block";
        }
        if (state.storeConfig.qr_plin_url && DOM.storeCfgQrPlinPreview) {
          DOM.storeCfgQrPlinPreview.src = state.storeConfig.qr_plin_url;
          DOM.storeCfgQrPlinPreview.style.display = "block";
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar la configuración de tienda:", e);
    }
  }

  // Guardar configuración de tienda
  if (DOM.formStoreConfig) {
    DOM.formStoreConfig.addEventListener("submit", async (e) => {
      e.preventDefault();
      DOM.btnSaveStoreConfig.disabled = true;
      DOM.btnSaveStoreConfig.innerHTML = `<span>Guardando...</span>`;

      try {
        const payload = {
          nombre_tienda: DOM.storeCfgName.value.trim(),
          whatsapp_ventas: DOM.storeCfgPhone.value.trim(),
          mensaje_bienvenida: DOM.storeCfgWelcome.value.trim(),
          instrucciones_pago: DOM.storeCfgInstructions.value.trim(),
          qr_yape_url: state.storeConfig.qr_yape_url || null,
          qr_plin_url: state.storeConfig.qr_plin_url || null
        };

        const res = await fetch("/api/store/config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Error al guardar configuración");
        state.storeConfig = await res.json();
        showToast("✓ Configuración de Tienda Web guardada con éxito", "success");
      } catch (err) {
        console.error(err);
        showToast("Error al guardar configuración", "error");
      } finally {
        DOM.btnSaveStoreConfig.disabled = false;
        DOM.btnSaveStoreConfig.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Guardar Configuración de Tienda</span>
        `;
      }
    });
  }

  // Subir QR Yape
  if (DOM.storeCfgQrYapeFile) {
    DOM.storeCfgQrYapeFile.addEventListener("change", async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (DOM.storeCfgQrYapeStatus) DOM.storeCfgQrYapeStatus.textContent = "Subiendo QR Yape...";
        const fd = new FormData();
        fd.append("tipo", "yape");
        fd.append("file", file);

        try {
          const res = await fetch("/api/store/upload-qr", { method: "POST", body: fd });
          if (!res.ok) throw new Error("Error al subir QR");
          const data = await res.json();
          state.storeConfig.qr_yape_url = data.url;
          if (DOM.storeCfgQrYapePreview) {
            DOM.storeCfgQrYapePreview.src = data.url;
            DOM.storeCfgQrYapePreview.style.display = "block";
          }
          if (DOM.storeCfgQrYapeStatus) DOM.storeCfgQrYapeStatus.textContent = "✓ QR Yape subido. Haz clic en Guardar.";
          showToast("✓ QR Yape cargado", "info");
        } catch (err) {
          console.error(err);
          if (DOM.storeCfgQrYapeStatus) DOM.storeCfgQrYapeStatus.textContent = "Error al subir QR";
          showToast("Error al subir QR Yape", "error");
        }
      }
    });
  }

  // Subir QR Plin
  if (DOM.storeCfgQrPlinFile) {
    DOM.storeCfgQrPlinFile.addEventListener("change", async (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (DOM.storeCfgQrPlinStatus) DOM.storeCfgQrPlinStatus.textContent = "Subiendo QR Plin...";
        const fd = new FormData();
        fd.append("tipo", "plin");
        fd.append("file", file);

        try {
          const res = await fetch("/api/store/upload-qr", { method: "POST", body: fd });
          if (!res.ok) throw new Error("Error al subir QR");
          const data = await res.json();
          state.storeConfig.qr_plin_url = data.url;
          if (DOM.storeCfgQrPlinPreview) {
            DOM.storeCfgQrPlinPreview.src = data.url;
            DOM.storeCfgQrPlinPreview.style.display = "block";
          }
          if (DOM.storeCfgQrPlinStatus) DOM.storeCfgQrPlinStatus.textContent = "✓ QR Plin subido. Haz clic en Guardar.";
          showToast("✓ QR Plin cargado", "info");
        } catch (err) {
          console.error(err);
          if (DOM.storeCfgQrPlinStatus) DOM.storeCfgQrPlinStatus.textContent = "Error al subir QR";
          showToast("Error al subir QR Plin", "error");
        }
      }
    });
  }

  // Cargar Pedidos Web
  async function loadWebOrders() {
    try {
      const res = await fetch("/api/store/orders");
      if (res.ok) {
        state.webOrders = await res.json();
        renderWebOrders();
      }
    } catch (e) {
      console.warn("No se pudieron cargar pedidos web:", e);
    }
  }

  function renderWebOrders() {
    if (!DOM.webOrdersTableBody) return;
    DOM.webOrdersTableBody.innerHTML = "";

    const pending = state.webOrders.filter(o => o.estado === "Pendiente");
    const approved = state.webOrders.filter(o => o.estado === "Aprobado");
    const totalRev = approved.reduce((sum, o) => sum + (o.total_monto || 0), 0);

    // Actualizar KPIs
    if (DOM.kpiWebPendingOrders) DOM.kpiWebPendingOrders.textContent = pending.length;
    if (DOM.kpiWebTotalOrders) DOM.kpiWebTotalOrders.textContent = state.webOrders.length;
    if (DOM.kpiWebApprovedOrders) DOM.kpiWebApprovedOrders.textContent = `${approved.length} aprobados`;
    if (DOM.kpiWebTotalRevenue) DOM.kpiWebTotalRevenue.textContent = formatMoney(totalRev);
    if (DOM.webOrdersPendingBadge) DOM.webOrdersPendingBadge.textContent = pending.length;

    const q = (DOM.webOrdersFilter ? DOM.webOrdersFilter.value.trim().toLowerCase() : "");
    const filtered = state.webOrders.filter(o => {
      if (!q) return true;
      return o.codigo_pedido.toLowerCase().includes(q) ||
             o.nombre_cliente.toLowerCase().includes(q) ||
             o.telefono_cliente.toLowerCase().includes(q) ||
             o.direccion_distrito.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
      if (DOM.webOrdersEmptyState) DOM.webOrdersEmptyState.classList.remove("hidden");
      return;
    }
    if (DOM.webOrdersEmptyState) DOM.webOrdersEmptyState.classList.add("hidden");

    filtered.forEach(order => {
      const tr = document.createElement("tr");

      const fechaObj = new Date(order.fecha_pedido);
      const fechaTxt = isNaN(fechaObj.getTime())
        ? "Hoy"
        : `${fechaObj.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit" })} ${fechaObj.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`;

      let badgeState = `<span class="status-pill status-nuevo" style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);">⏳ Pendiente</span>`;
      if (order.estado === "Por Comprar en Proveedor") {
        badgeState = `<span class="status-pill" style="background: rgba(234, 88, 12, 0.2); color: #fb923c; border: 1px solid rgba(234, 88, 12, 0.4); font-weight:700;">🛒 Comprar en Prov.</span>`;
      } else if (order.estado === "Comprado en Proveedor") {
        badgeState = `<span class="status-pill" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); font-weight:700;">📦 En Camino</span>`;
      } else if (order.estado === "En Reparto al Cliente") {
        badgeState = `<span class="status-pill" style="background: rgba(14, 165, 233, 0.2); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.4); font-weight:700;">🛵 En Reparto</span>`;
      } else if (order.estado === "Aprobado") {
        badgeState = `<span class="status-pill status-nuevo" style="background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4);">✓ Entregado</span>`;
      } else if (order.estado === "Rechazado") {
        badgeState = `<span class="status-pill status-liquidacion" style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">✕ Rechazado</span>`;
      }

      let badgePay = `<span style="font-size: 0.75rem; font-weight: 700; color: #4ade80;">🤝 Contraentrega</span>`;
      if (order.metodo_pago === "WhatsApp") badgePay = `<span style="font-size: 0.75rem; font-weight: 700; color: #25d366;">📱 WA</span>`;
      if (order.metodo_pago === "Yape") badgePay = `<span style="font-size: 0.75rem; font-weight: 700; color: #d946ef;">💜 Yape</span>`;
      if (order.metodo_pago === "Plin") badgePay = `<span style="font-size: 0.75rem; font-weight: 700; color: #38bdf8;">💙 Plin</span>`;

      tr.innerHTML = `
        <td><strong style="color: #93c5fd; font-family: monospace;">${order.codigo_pedido}</strong></td>
        <td style="font-size: 0.82rem; color: var(--text-muted);">${fechaTxt}</td>
        <td>
          <div style="font-weight: 700; color: #ffffff;">${order.nombre_cliente}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${order.telefono_cliente}</div>
        </td>
        <td style="font-size: 0.82rem; max-width: 160px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${order.direccion_distrito}">
          ${order.direccion_distrito}
        </td>
        <td>${badgePay}</td>
        <td class="text-right"><strong style="color: #ffffff;">${formatMoney(order.total_monto)}</strong></td>
        <td class="text-center">${badgeState}</td>
        <td class="text-right">
          <div class="table-actions" style="justify-content: flex-end;">
            ${order.estado === "Por Comprar en Proveedor" ? `
              <button class="btn btn-warning btn-xs btn-action-purchased" data-id="${order.id}" title="Marcar como comprado al proveedor en la web">
                📦 Comprado
              </button>
            ` : ''}
            ${order.estado === "Comprado en Proveedor" ? `
              <button class="btn btn-outline-primary btn-xs btn-action-delivery" data-id="${order.id}" title="Marcar en reparto para contraentrega">
                🛵 En Reparto
              </button>
            ` : ''}
            ${(order.estado === "En Reparto al Cliente" || order.estado === "Pendiente") ? `
              <button class="btn btn-success btn-xs btn-action-cod-complete" data-id="${order.id}" title="Confirmar cobro y entrega al cliente">
                💰 Cobrado
              </button>
            ` : ''}
            <button class="btn btn-secondary btn-xs btn-view-order-detail" data-id="${order.id}" title="Ver detalle completo">
              👁 Ver
            </button>
            <button class="btn btn-whatsapp btn-xs btn-wa-contact-cust" data-id="${order.id}" title="Abrir chat de WhatsApp con el cliente">
              📲
            </button>
          </div>
        </td>
      `;

      const btnPurchased = tr.querySelector(".btn-action-purchased");
      if (btnPurchased) btnPurchased.addEventListener("click", () => markOrderPurchased(order.id, order.codigo_pedido));

      const btnDelivery = tr.querySelector(".btn-action-delivery");
      if (btnDelivery) btnDelivery.addEventListener("click", () => markOrderInDelivery(order.id, order.codigo_pedido));

      const btnCod = tr.querySelector(".btn-action-cod-complete");
      if (btnCod) btnCod.addEventListener("click", () => completeOrderCashOnDelivery(order.id, order.codigo_pedido));

      tr.querySelector(".btn-view-order-detail").addEventListener("click", () => openWebOrderDetail(order));
      tr.querySelector(".btn-wa-contact-cust").addEventListener("click", () => {
        const cleanPhone = (order.telefono_cliente || "").replace(/[^0-9]/g, "");
        const waUrl = `https://wa.me/${cleanPhone}?text=¡Hola%20${encodeURIComponent(order.nombre_cliente)}!%20Te%20escribimos%20de%20KipuStock%20respecto%20a%20tu%20pedido%20web%20*${order.codigo_pedido}*.`;
        window.open(waUrl, "_blank");
      });

      DOM.webOrdersTableBody.appendChild(tr);
    });
  }

  if (DOM.webOrdersFilter) {
    DOM.webOrdersFilter.addEventListener("input", renderWebOrders);
  }

  if (DOM.btnRefreshWebOrders) {
    DOM.btnRefreshWebOrders.addEventListener("click", async () => {
      await loadWebOrders();
      showToast("Bandeja de pedidos actualizada", "info");
    });
  }

  // Aprobar Pedido
  async function approveWebOrder(orderId, orderCode) {
    if (!confirm(`¿Deseas aprobar el pedido ${orderCode}? Se descontará automáticamente el stock de almacén y se registrarán las ventas.`)) return;

    try {
      const res = await fetch(`/api/store/orders/${orderId}/approve`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error al aprobar pedido");
      }
      const data = await res.json();
      showToast(`✓ ${data.message}`, "success");

      // Actualizar todo
      await loadWebOrders();
      await loadInventory();
      await loadSales();

      // Cerrar modal si estaba abierto
      if (DOM.webOrderDetailModal) DOM.webOrderDetailModal.classList.add("hidden");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Error al aprobar pedido", "error");
    }
  }

  // Rechazar Pedido
  async function rejectWebOrder(orderId, orderCode) {
    if (!confirm(`¿Deseas rechazar el pedido ${orderCode}?`)) return;

    try {
      const res = await fetch(`/api/store/orders/${orderId}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("Error al rechazar pedido");
      showToast(`Pedido ${orderCode} rechazado.`, "info");

      await loadWebOrders();
      if (DOM.webOrderDetailModal) DOM.webOrderDetailModal.classList.add("hidden");
    } catch (err) {
      console.error(err);
      showToast("Error al rechazar pedido", "error");
    }
  }

  // Modal de Detalle de Pedido
  function openWebOrderDetail(order) {
    if (!DOM.webOrderDetailModal) return;

    if (DOM.webOrderModalTitle) DOM.webOrderModalTitle.textContent = `Pedido #${order.codigo_pedido}`;
    if (DOM.webModalCustName) DOM.webModalCustName.textContent = `Cliente: ${order.nombre_cliente}`;

    let statusHtml = `<span style="color: #fbbf24; font-weight: 700;">⏳ Pendiente</span>`;
    if (order.estado === "Aprobado") statusHtml = `<span style="color: #34d399; font-weight: 700;">✓ Aprobado</span>`;
    if (order.estado === "Rechazado") statusHtml = `<span style="color: #f87171; font-weight: 700;">✕ Rechazado</span>`;
    if (DOM.webModalStatusBadge) DOM.webModalStatusBadge.innerHTML = statusHtml;

    if (DOM.webModalCustDetails) {
      DOM.webModalCustDetails.innerHTML = `
        📱 <strong>WhatsApp:</strong> ${order.telefono_cliente}<br>
        📍 <strong>Entrega:</strong> ${order.direccion_distrito}<br>
        💳 <strong>Método de Pago:</strong> ${order.metodo_pago}<br>
        ${order.notas ? `📝 <strong>Notas:</strong> ${order.notas}` : ''}
      `;
    }

    if (DOM.webModalTotalAmount) {
      DOM.webModalTotalAmount.textContent = formatMoney(order.total_monto);
    }

    // Renderizar ítems
    let items = [];
    try {
      items = JSON.parse(order.items_json);
    } catch (e) {
      items = [];
    }

    if (DOM.webModalItemsList) {
      DOM.webModalItemsList.innerHTML = items.map(item => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(11, 15, 25, 0.5); padding: 0.5rem 0.75rem; border-radius: 6px; border: 1px solid var(--border-color);">
          <div>
            <span style="font-weight: 700; color: #ffffff;">${item.cantidad}x ${item.nombre}</span>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${formatMoney(item.precio_unitario)} c/u</div>
          </div>
          <span style="font-weight: 800; color: var(--accent);">${formatMoney(item.subtotal || (item.precio_unitario * item.cantidad))}</span>
        </div>
      `).join("");
    }

    // Comprobante
    if (order.comprobante_url && DOM.webModalProofWrap) {
      DOM.webModalProofWrap.style.display = "block";
      if (DOM.webModalProofImg) DOM.webModalProofImg.src = order.comprobante_url;
      if (DOM.webModalProofLink) DOM.webModalProofLink.href = order.comprobante_url;
    } else if (DOM.webModalProofWrap) {
      DOM.webModalProofWrap.style.display = "none";
    }

    // Botones de acción del modal
    if (DOM.btnWebModalApprove) {
      DOM.btnWebModalApprove.style.display = order.estado === "Pendiente" ? "inline-flex" : "none";
      DOM.btnWebModalApprove.onclick = () => approveWebOrder(order.id, order.codigo_pedido);
    }

    if (DOM.btnWebModalReject) {
      DOM.btnWebModalReject.style.display = order.estado === "Pendiente" ? "inline-flex" : "none";
      DOM.btnWebModalReject.onclick = () => rejectWebOrder(order.id, order.codigo_pedido);
    }

    if (DOM.btnWebModalWa) {
      DOM.btnWebModalWa.onclick = () => {
        const cleanPhone = (order.telefono_cliente || "").replace(/[^0-9]/g, "");
        const waUrl = `https://wa.me/${cleanPhone}?text=¡Hola%20${encodeURIComponent(order.nombre_cliente)}!%20Te%20escribimos%20de%20KipuStock%20respecto%20a%20tu%20pedido%20web%20*${order.codigo_pedido}*.`;
        window.open(waUrl, "_blank");
      };
    }

    DOM.webOrderDetailModal.classList.remove("hidden");
  }

  if (DOM.btnCloseWebOrderModal) {
    DOM.btnCloseWebOrderModal.addEventListener("click", () => {
      if (DOM.webOrderDetailModal) DOM.webOrderDetailModal.classList.add("hidden");
    });
  }

  // ==========================================
  // ESTADO DE BASE DE DATOS ($0 CLOUD / LOCAL)
  // ==========================================
  function updateDatabaseStatus(db) {
    const badge = document.getElementById("headerDbBadge");
    const textEl = document.getElementById("headerDbText");
    if (!badge || !textEl || !db) return;

    if (db.is_cloud || db.mode === "cloud") {
      badge.className = "db-status-badge cloud";
      textEl.textContent = "☁️ Nube Conectada";
      badge.title = `Base de datos en la nube ($0) activa: ${db.database_display || 'PostgreSQL'}. Haz clic para ver detalles.`;
    } else {
      badge.className = "db-status-badge local";
      textEl.textContent = "💾 Modo Local";
      badge.title = `Base de datos SQLite local activa (${db.url_masked || 'sistema.db'}). Haz clic para ver detalles.`;
    }

    badge.onclick = () => {
      const infoMsg = (db.is_cloud || db.mode === "cloud")
        ? `☁️ BASE DE DATOS EN LA NUBE ($0) CONECTADA:\n\n• Motor: ${db.dialect || 'postgresql'}\n• Estado: 🟢 Operativo y sincronizado en tiempo real.\n• Origen: ${db.url_masked || 'PostgreSQL Nube'}\n\nLos cambios realizados en inventario, ventas y catálogo se sincronizan automáticamente con la nube.`
        : `💾 BASE DE DATOS LOCAL (SQLITE):\n\n• Archivo: ${db.url_masked || 'data/sistema.db'}\n• Estado: 🟢 Operativo en almacenamiento local.\n\nPara conectar a PostgreSQL en la nube ($0 en Supabase o Neon), configura DATABASE_URL en tu archivo .env o ejecuta 'python migrate_to_cloud.py'.`;
      alert(infoMsg);
    };
  }

  // ==========================================
  // INICIALIZACIÓN
  // ==========================================
  async function init() {
    updateLiveCalc();
    await loadCustomStores();
    renderSelectedSitesUI();

    // Consultar estado de configuración de Gemini, Playwright y Base de Datos
    try {
      const configRes = await fetch("/api/config/status");
      if (configRes.ok) {
        const configData = await configRes.json();
        if (DOM.filterCommission && configData.default_commission) {
          DOM.filterCommission.value = configData.default_commission;
        }
        if (DOM.aiStatusBadge && DOM.aiStatusBadgeText) {
          if (configData.gemini_configured) {
            DOM.aiStatusBadge.className = "ai-status-badge";
            DOM.aiStatusBadgeText.textContent = "Gemini 2.5 Flash Online";
          } else {
            DOM.aiStatusBadge.className = "ai-status-badge fallback";
            DOM.aiStatusBadgeText.textContent = "Modo Fallback Heurístico";
          }
        }
        if (configData.db_status) {
          updateDatabaseStatus(configData.db_status);
        }
      }
    } catch (e) {
      console.warn("No se pudo verificar estado de configuración:", e);
    }

    // Consulta directa de estado de base de datos
    try {
      const dbRes = await fetch("/api/system/db-status");
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        updateDatabaseStatus(dbData);
      }
    } catch (e_db) {
      console.debug("Error consultando estado de base de datos:", e_db);
    }

    // Carga paralela de datos iniciales para máxima velocidad y evitar cuelgues de interfaz
    await Promise.allSettled([
      loadInventory(),
      loadLot(),
      loadSales(),
      loadAlerts(),
      loadAdminStoreConfig(),
      loadWebOrders(),
      loadShippingRates(),
      loadCrmClients()
    ]);
    initCampaignModule();
    initCrmModule();
    initTunnelModule();
  }

  // ==========================================
  // CLOUDFLARE TUNNEL: TIENDA PÚBLICA GRATUITA ($0)
  // ==========================================

  function getActiveStorePublicUrl() {
    if (state.tunnel && state.tunnel.active && state.tunnel.store_url) {
      return state.tunnel.store_url;
    }
    return `${window.location.origin}/tienda`;
  }

  async function fetchTunnelStatus() {
    try {
      const res = await fetch("/api/tienda/public-status");
      if (!res.ok) return;
      const data = await res.json();
      state.tunnel = data;
      updateTunnelUI();
    } catch (e) {
      console.warn("No se pudo obtener estado del túnel:", e);
    }
  }

  function updateTunnelUI() {
    const t = state.tunnel;
    const isActive = t && t.active && t.store_url;
    const currentUrl = isActive ? t.store_url : `${window.location.origin}/tienda`;

    // 1. Header Navbar Pill
    if (DOM.headerTunnelDot) {
      DOM.headerTunnelDot.style.background = isActive ? "#10b981" : "#94a3b8";
    }
    if (DOM.headerTunnelLabel) {
      DOM.headerTunnelLabel.textContent = isActive ? "🌐 Tienda Online Activa" : "🌐 Publicar Tienda ($0)";
    }
    if (DOM.btnHeaderTunnel) {
      DOM.btnHeaderTunnel.style.borderColor = isActive ? "rgba(16, 185, 129, 0.5)" : "rgba(59, 130, 246, 0.4)";
      DOM.btnHeaderTunnel.style.color = isActive ? "#10b981" : "#60a5fa";
      DOM.btnHeaderTunnel.style.background = isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(59, 130, 246, 0.15)";
    }

    // 2. Links a Tienda en toda la app
    if (DOM.headerStoreLink) DOM.headerStoreLink.href = currentUrl;
    if (DOM.storeTabOpenStoreBtn) DOM.storeTabOpenStoreBtn.href = currentUrl;
    if (DOM.campaignViewStoreLink) DOM.campaignViewStoreLink.href = currentUrl;
    if (DOM.storeTabTunnelStatusHint) {
      DOM.storeTabTunnelStatusHint.innerHTML = isActive
        ? `🟢 En vivo: <a href="${currentUrl}" target="_blank" style="color: #34d399; text-decoration: underline;">${t.public_url.replace("https://", "")}</a>`
        : `Local: 127.0.0.1:8000`;
    }

    // Actualizar input de tienda en Campañas si está vacío o con localhost
    if (DOM.campaignInputStoreUrl) {
      const val = DOM.campaignInputStoreUrl.value.trim();
      if (!val || val.includes("localhost") || val.includes("127.0.0.1")) {
        DOM.campaignInputStoreUrl.value = currentUrl;
      }
    }

    // 3. Modal de Publicación
    if (DOM.tunnelStatusDot) {
      DOM.tunnelStatusDot.style.background = isActive ? "#10b981" : "#94a3b8";
    }
    if (DOM.tunnelStatusText) {
      if (isActive) {
        DOM.tunnelStatusText.textContent = t.is_named_tunnel ? "Tienda Publicada (Subdominio Fijo)" : "Tienda Publicada en Internet";
      } else {
        DOM.tunnelStatusText.textContent = "Tienda Sin Publicar";
      }
      DOM.tunnelStatusText.style.color = isActive ? "#10b981" : "#ffffff";
    }
    if (DOM.tunnelStatusSub) {
      if (isActive) {
        DOM.tunnelStatusSub.textContent = t.is_named_tunnel
          ? `En vivo en ${t.store_url} mediante Cloudflare Named Tunnel`
          : "Conexión SSL encriptada activa mediante Cloudflare Tunnel";
      } else {
        DOM.tunnelStatusSub.textContent = "Solo visible en tu computadora (localhost:8000)";
      }
    }

    if (DOM.badgeFixedConfigActive) {
      const hasToken = (t && t.config && t.config.has_token) || (t && t.is_named_tunnel);
      if (hasToken) {
        DOM.badgeFixedConfigActive.classList.remove("hidden");
      } else {
        DOM.badgeFixedConfigActive.classList.add("hidden");
      }
    }

    if (DOM.btnStartTunnel) {
      if (isActive) DOM.btnStartTunnel.classList.add("hidden");
      else DOM.btnStartTunnel.classList.remove("hidden");
    }
    if (DOM.btnStopTunnel) {
      if (isActive) DOM.btnStopTunnel.classList.remove("hidden");
      else DOM.btnStopTunnel.classList.add("hidden");
    }

    if (DOM.tunnelActiveInfoBox) {
      if (isActive) {
        DOM.tunnelActiveInfoBox.classList.remove("hidden");
        if (DOM.tunnelPublicUrlInput) DOM.tunnelPublicUrlInput.value = currentUrl;
        if (DOM.btnOpenTunnelExternal) {
          DOM.btnOpenTunnelExternal.href = currentUrl;
          DOM.btnOpenTunnelExternal.target = "_blank";
          DOM.btnOpenTunnelExternal.rel = "noopener noreferrer";
        }

        // Generar QR dinámico
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentUrl)}`;
        if (DOM.tunnelQrCodeImg) DOM.tunnelQrCodeImg.src = qrApiUrl;
        if (DOM.btnDownloadTunnelQr) DOM.btnDownloadTunnelQr.href = qrApiUrl;
      } else {
        DOM.tunnelActiveInfoBox.classList.add("hidden");
      }
    }

    // 4. Panel de Control Inline en la Tienda
    if (DOM.tunnelCardStatusBadge) {
      if (isActive) {
        DOM.tunnelCardStatusBadge.textContent = t.is_named_tunnel ? "● Subdominio Fijo En Vivo" : "● En Vivo en Internet";
      } else {
        DOM.tunnelCardStatusBadge.textContent = "● Local (Sin publicar)";
      }
      DOM.tunnelCardStatusBadge.style.background = isActive ? "rgba(16, 185, 129, 0.2)" : "rgba(148, 163, 184, 0.2)";
      DOM.tunnelCardStatusBadge.style.color = isActive ? "#10b981" : "#94a3b8";
    }
    if (DOM.tunnelCardDesc) {
      if (isActive) {
        DOM.tunnelCardDesc.textContent = t.is_named_tunnel
          ? `Tu catálogo está en línea en tu subdominio fijo ${currentUrl} mediante Cloudflare Named Tunnel.`
          : `Tu catálogo está en línea en ${currentUrl} recibiendo pedidos en vivo por Cloudflare Tunnel.`;
      } else {
        DOM.tunnelCardDesc.textContent = `Conecta tu catálogo web a internet con Cloudflare Tunnel gratuito. Comparte el enlace público o código QR con clientes para recibir pedidos en vivo.`;
      }
    }
    if (DOM.btnTunnelInlineStart) {
      if (isActive) DOM.btnTunnelInlineStart.classList.add("hidden");
      else DOM.btnTunnelInlineStart.classList.remove("hidden");
    }
    if (DOM.btnTunnelInlineStop) {
      if (isActive) DOM.btnTunnelInlineStop.classList.remove("hidden");
      else DOM.btnTunnelInlineStop.classList.add("hidden");
    }
    if (DOM.tunnelInlineActiveRow) {
      if (isActive) {
        DOM.tunnelInlineActiveRow.classList.remove("hidden");
        if (DOM.tunnelInlineUrlInput) DOM.tunnelInlineUrlInput.value = currentUrl;
        if (DOM.btnTunnelInlineVisit) DOM.btnTunnelInlineVisit.href = currentUrl;
      } else {
        DOM.tunnelInlineActiveRow.classList.add("hidden");
      }
    }
  }

  async function startTunnel() {
    if (DOM.tunnelLoadingBox) DOM.tunnelLoadingBox.classList.remove("hidden");
    if (DOM.btnStartTunnel) DOM.btnStartTunnel.disabled = true;

    try {
      const isNamed = (state.tunnel && state.tunnel.config && state.tunnel.config.has_token);
      showToast(isNamed ? "Iniciando Cloudflare Tunnel con subdominio fijo..." : "Iniciando túnel seguro de Cloudflare... Puede tardar unos segundos.", "info");
      const res = await fetch("/api/tienda/publish", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.mensaje || "Error al iniciar túnel");

      state.tunnel = {
        active: true,
        public_url: data.public_url,
        store_url: data.store_url,
        is_named_tunnel: data.is_named_tunnel || isNamed,
        is_starting: false
      };
      updateTunnelUI();
      showToast(`✓ ¡Tienda publicada en internet! Enlace listo: ${data.store_url}`, "success");
    } catch (err) {
      console.error(err);
      showToast(`Error publicando tienda: ${err.message}`, "error");
    } finally {
      if (DOM.tunnelLoadingBox) DOM.tunnelLoadingBox.classList.add("hidden");
      if (DOM.btnStartTunnel) DOM.btnStartTunnel.disabled = false;
    }
  }

  async function stopTunnel() {
    if (DOM.btnStopTunnel) DOM.btnStopTunnel.disabled = true;
    try {
      showToast("Deteniendo publicación externa...", "info");
      const res = await fetch("/api/tienda/unpublish", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al detener túnel");

      state.tunnel = { active: false, public_url: null, store_url: null, is_starting: false };
      updateTunnelUI();
      showToast("Túnel de Cloudflare detenido. La tienda vuelve a ser local.", "warning");
    } catch (err) {
      console.error(err);
      showToast(`Error al detener túnel: ${err.message}`, "error");
    } finally {
      if (DOM.btnStopTunnel) DOM.btnStopTunnel.disabled = false;
    }
  }

  async function fetchTunnelConfig() {
    try {
      const res = await fetch("/api/tienda/tunnel-config");
      if (!res.ok) return;
      const data = await res.json();
      if (DOM.tunnelFixedDomainInput && document.activeElement !== DOM.tunnelFixedDomainInput) {
        DOM.tunnelFixedDomainInput.value = data.fixed_domain || "";
      }
      if (DOM.tunnelTokenInput && document.activeElement !== DOM.tunnelTokenInput) {
        DOM.tunnelTokenInput.value = data.token || "";
      }
      if (DOM.badgeFixedConfigActive) {
        if (data.has_token) {
          DOM.badgeFixedConfigActive.classList.remove("hidden");
        } else {
          DOM.badgeFixedConfigActive.classList.add("hidden");
        }
      }
    } catch (e) {
      console.warn("No se pudo cargar configuración de Named Tunnel:", e);
    }
  }

  async function saveTunnelConfig() {
    const fixedDomain = DOM.tunnelFixedDomainInput ? DOM.tunnelFixedDomainInput.value.trim() : "";
    const token = DOM.tunnelTokenInput ? DOM.tunnelTokenInput.value.trim() : "";

    if (DOM.btnSaveTunnelConfig) DOM.btnSaveTunnelConfig.disabled = true;
    try {
      showToast("Guardando configuración de subdominio fijo...", "info");
      const res = await fetch("/api/tienda/tunnel-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token, fixed_domain: fixedDomain })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al guardar configuración");

      showToast("Configuración guardada exitosamente.", "success");
      if (DOM.tunnelConfigFeedback) {
        DOM.tunnelConfigFeedback.textContent = data.config && data.config.has_token
          ? `✓ Subdominio fijo guardado (${data.config.fixed_domain || "Sin dominio especificado"}). Se usará en la próxima publicación.`
          : `✓ Modo rápido seleccionado. Se asignará una URL automática .trycloudflare.com al publicar.`;
        DOM.tunnelConfigFeedback.style.background = "rgba(16, 185, 129, 0.15)";
        DOM.tunnelConfigFeedback.style.color = "#34d399";
        DOM.tunnelConfigFeedback.classList.remove("hidden");
      }
      if (DOM.badgeFixedConfigActive) {
        if (data.config && data.config.has_token) {
          DOM.badgeFixedConfigActive.classList.remove("hidden");
        } else {
          DOM.badgeFixedConfigActive.classList.add("hidden");
        }
      }
      fetchTunnelStatus();
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`, "error");
      if (DOM.tunnelConfigFeedback) {
        DOM.tunnelConfigFeedback.textContent = `❌ ${err.message}`;
        DOM.tunnelConfigFeedback.style.background = "rgba(239, 68, 68, 0.15)";
        DOM.tunnelConfigFeedback.style.color = "#f87171";
        DOM.tunnelConfigFeedback.classList.remove("hidden");
      }
    } finally {
      if (DOM.btnSaveTunnelConfig) DOM.btnSaveTunnelConfig.disabled = false;
    }
  }

  async function resetTunnelConfig() {
    if (DOM.btnResetTunnelConfig) DOM.btnResetTunnelConfig.disabled = true;
    try {
      showToast("Restableciendo a modo rápido gratuito...", "info");
      const res = await fetch("/api/tienda/tunnel-config", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al restablecer");

      if (DOM.tunnelFixedDomainInput) DOM.tunnelFixedDomainInput.value = "";
      if (DOM.tunnelTokenInput) DOM.tunnelTokenInput.value = "";
      if (DOM.badgeFixedConfigActive) DOM.badgeFixedConfigActive.classList.add("hidden");

      if (DOM.tunnelConfigFeedback) {
        DOM.tunnelConfigFeedback.textContent = "✓ Configuración eliminada. Ahora se usará el modo rápido gratuito.";
        DOM.tunnelConfigFeedback.style.background = "rgba(59, 130, 246, 0.15)";
        DOM.tunnelConfigFeedback.style.color = "#93c5fd";
        DOM.tunnelConfigFeedback.classList.remove("hidden");
      }
      showToast("Modo rápido gratuito activado como respaldo.", "info");
      fetchTunnelStatus();
    } catch (err) {
      console.error(err);
      showToast(`Error: ${err.message}`, "error");
    } finally {
      if (DOM.btnResetTunnelConfig) DOM.btnResetTunnelConfig.disabled = false;
    }
  }

  function initTunnelModule() {
    // Abrir modal desde cualquier botón disparador
    document.querySelectorAll(".btn-publish-tunnel-trigger").forEach(btn => {
      btn.addEventListener("click", () => {
        if (DOM.tunnelModal) {
          DOM.tunnelModal.classList.remove("hidden");
          fetchTunnelStatus();
          fetchTunnelConfig();
        }
      });
    });

    if (DOM.btnCloseTunnelModal) {
      DOM.btnCloseTunnelModal.addEventListener("click", () => {
        if (DOM.tunnelModal) DOM.tunnelModal.classList.add("hidden");
      });
    }
    if (DOM.btnCloseTunnelModalFooter) {
      DOM.btnCloseTunnelModalFooter.addEventListener("click", () => {
        if (DOM.tunnelModal) DOM.tunnelModal.classList.add("hidden");
      });
    }

    if (DOM.btnStartTunnel) {
      DOM.btnStartTunnel.addEventListener("click", startTunnel);
    }
    if (DOM.btnStopTunnel) {
      DOM.btnStopTunnel.addEventListener("click", stopTunnel);
    }
    if (DOM.btnTunnelInlineStart) {
      DOM.btnTunnelInlineStart.addEventListener("click", startTunnel);
    }
    if (DOM.btnTunnelInlineStop) {
      DOM.btnTunnelInlineStop.addEventListener("click", stopTunnel);
    }

    // Toggle de bloque colapsable de subdominio fijo
    if (DOM.btnToggleFixedDomainConfig) {
      DOM.btnToggleFixedDomainConfig.addEventListener("click", () => {
        if (DOM.fixedDomainConfigBody) {
          const isHidden = DOM.fixedDomainConfigBody.classList.toggle("hidden");
          if (DOM.fixedConfigChevron) {
            DOM.fixedConfigChevron.textContent = isHidden ? "▼" : "▲";
          }
          if (!isHidden) {
            fetchTunnelConfig();
          }
        }
      });
    }

    // Guardar y Resetear configuración de Named Tunnel
    if (DOM.btnSaveTunnelConfig) {
      DOM.btnSaveTunnelConfig.addEventListener("click", saveTunnelConfig);
    }
    if (DOM.btnResetTunnelConfig) {
      DOM.btnResetTunnelConfig.addEventListener("click", resetTunnelConfig);
    }

    if (DOM.btnTunnelInlineCopy) {
      DOM.btnTunnelInlineCopy.addEventListener("click", () => {
        if (DOM.tunnelInlineUrlInput && DOM.tunnelInlineUrlInput.value) {
          navigator.clipboard.writeText(DOM.tunnelInlineUrlInput.value).then(() => {
            const oldTxt = DOM.btnTunnelInlineCopy.textContent;
            DOM.btnTunnelInlineCopy.textContent = "✓ ¡Copiado!";
            setTimeout(() => { DOM.btnTunnelInlineCopy.textContent = oldTxt; }, 1800);
          }).catch(() => {
            DOM.tunnelInlineUrlInput.select();
            document.execCommand("copy");
            DOM.btnTunnelInlineCopy.textContent = "✓ ¡Copiado!";
            setTimeout(() => { DOM.btnTunnelInlineCopy.textContent = "📋 Copiar Enlace"; }, 1800);
          });
        }
      });
    }

    if (DOM.btnCopyTunnelUrl) {
      DOM.btnCopyTunnelUrl.addEventListener("click", () => {
        if (DOM.tunnelPublicUrlInput && DOM.tunnelPublicUrlInput.value) {
          navigator.clipboard.writeText(DOM.tunnelPublicUrlInput.value).then(() => {
            const oldTxt = DOM.btnCopyTunnelUrl.textContent;
            DOM.btnCopyTunnelUrl.textContent = "✓ ¡Copiado!";
            setTimeout(() => { DOM.btnCopyTunnelUrl.textContent = oldTxt; }, 1800);
          }).catch(() => {
            DOM.tunnelPublicUrlInput.select();
            document.execCommand("copy");
            DOM.btnCopyTunnelUrl.textContent = "✓ ¡Copiado!";
            setTimeout(() => { DOM.btnCopyTunnelUrl.textContent = "📋 Copiar Enlace"; }, 1800);
          });
        }
      });
    }

    // Botón "Abrir ↗" del modal y vista inline
    if (DOM.btnOpenTunnelExternal) {
      DOM.btnOpenTunnelExternal.addEventListener("click", (e) => {
        const targetUrl = (state.tunnel && state.tunnel.store_url)
          ? state.tunnel.store_url
          : (DOM.tunnelPublicUrlInput && DOM.tunnelPublicUrlInput.value
              ? DOM.tunnelPublicUrlInput.value.trim()
              : `${window.location.origin}/tienda`);
        if (targetUrl && targetUrl.startsWith("http")) {
          e.preventDefault();
          window.open(targetUrl, "_blank", "noopener,noreferrer");
        }
      });
    }

    if (DOM.btnTunnelInlineVisit) {
      DOM.btnTunnelInlineVisit.addEventListener("click", (e) => {
        const targetUrl = (state.tunnel && state.tunnel.store_url)
          ? state.tunnel.store_url
          : (DOM.tunnelInlineUrlInput && DOM.tunnelInlineUrlInput.value
              ? DOM.tunnelInlineUrlInput.value.trim()
              : `${window.location.origin}/tienda`);
        if (targetUrl && targetUrl.startsWith("http")) {
          e.preventDefault();
          window.open(targetUrl, "_blank", "noopener,noreferrer");
        }
      });
    }

    // Consultar estado inicial y mantener sincronizado
    fetchTunnelStatus();
    fetchTunnelConfig();
    setInterval(fetchTunnelStatus, 10000);
  }

  // ==============================================================
  // MÓDULO DE CAMPAÑAS PUBLICITARIAS Y REDES SOCIALES (COSTO $0)
  // ==============================================================

  function populateCampaignProductSelect() {
    if (!DOM.campaignSelectProduct) return;
    const currentVal = DOM.campaignSelectProduct.value;
    DOM.campaignSelectProduct.innerHTML = `<option value="">-- Seleccionar producto de inventario o arbitraje --</option>`;

    // 1. Mercadería Propia (Almacén)
    if (state.inventory && state.inventory.length > 0) {
      const optGroupInv = document.createElement("optgroup");
      optGroupInv.label = "📦 Inventario Propio (Almacén)";
      state.inventory.forEach(prod => {
        const opt = document.createElement("option");
        opt.value = `inv_${prod.id}`;
        const shortName = prod.nombre.length > 40 ? prod.nombre.substring(0, 37) + "..." : prod.nombre;
        opt.textContent = `${shortName} (Stock: ${prod.stock} un. | S/ ${prod.precio_venta.toFixed(2)})`;
        opt.title = `${prod.nombre} - Precio Venta: S/ ${prod.precio_venta.toFixed(2)}`;
        optGroupInv.appendChild(opt);
      });
      DOM.campaignSelectProduct.appendChild(optGroupInv);
    }

    // 2. Arbitraje y Oportunidades (Lote de Operación)
    if (state.lotItems && state.lotItems.length > 0) {
      const optGroupLot = document.createElement("optgroup");
      optGroupLot.label = "🎯 Arbitraje y Oportunidades (Lote)";
      state.lotItems.forEach(item => {
        const opt = document.createElement("option");
        opt.value = `lot_${item.id}`;
        const shortName = item.nombre.length > 40 ? item.nombre.substring(0, 37) + "..." : item.nombre;
        opt.textContent = `[${item.tienda}] ${shortName} (S/ ${item.precio_venta.toFixed(2)})`;
        opt.title = `${item.nombre} (${item.tienda}) - Venta: S/ ${item.precio_venta.toFixed(2)}`;
        optGroupLot.appendChild(opt);
      });
      DOM.campaignSelectProduct.appendChild(optGroupLot);
    }

    if (currentVal) {
      DOM.campaignSelectProduct.value = currentVal;
    }
  }

  function fillCampaignFormWithProduct(item, isLot = false) {
    if (!item) return;
    if (DOM.campaignSelectProduct) {
      DOM.campaignSelectProduct.value = isLot ? `lot_${item.id}` : `inv_${item.id}`;
    }
    if (DOM.campaignInputTitle) DOM.campaignInputTitle.value = item.nombre || "";
    if (DOM.campaignInputModel) {
      DOM.campaignInputModel.value = isLot ? (item.tienda || "") : (item.modelo || "");
    }
    if (DOM.campaignSelectEstado) {
      DOM.campaignSelectEstado.value = isLot ? "Arbitraje Ocasión" : (item.estado || "Nuevo");
    }
    if (DOM.campaignInputPrice) DOM.campaignInputPrice.value = item.precio_venta || "";
    if (DOM.campaignInputOfferPrice) {
      const suggestedOffer = Math.round(item.precio_venta * 0.85);
      DOM.campaignInputOfferPrice.value = suggestedOffer > 0 ? suggestedOffer : "";
    }
    if (DOM.campaignInputMargin) {
      let marginVal = "";
      if (item.precio_venta > 0) {
        const cost = isLot ? (item.costo_compra || 0) : (item.costo_unitario || 0);
        if (cost > 0) {
          marginVal = (((item.precio_venta - cost) / item.precio_venta) * 100).toFixed(1);
        }
      }
      DOM.campaignInputMargin.value = marginVal;
    }
    if (DOM.campaignInputStock) {
      DOM.campaignInputStock.value = isLot ? (item.cantidad || 1) : (item.stock || 0);
    }
    if (DOM.campaignInputStoreUrl) {
      if (item.url_compra && isLot) {
        DOM.campaignInputStoreUrl.value = item.url_compra;
      } else if (!DOM.campaignInputStoreUrl.value || DOM.campaignInputStoreUrl.value.includes("localhost") || DOM.campaignInputStoreUrl.value.includes("127.0.0.1")) {
        DOM.campaignInputStoreUrl.value = getActiveStorePublicUrl();
      }
    }
    if (DOM.campaignHiddenPhotoUrl) DOM.campaignHiddenPhotoUrl.value = item.foto_url || "";
    if (DOM.campaignHiddenProdId) DOM.campaignHiddenProdId.value = isLot ? "" : item.id;
    if (DOM.campaignHiddenItemLoteId) DOM.campaignHiddenItemLoteId.value = isLot ? item.id : "";
  }

  function openCampaignForProduct(item, isLot = false) {
    if (!item) return;
    switchTab("tab-campaigns");
    fillCampaignFormWithProduct(item, isLot);

    // Prellenar URL de tienda y WhatsApp si están vacíos
    if (DOM.campaignInputStoreUrl && (!DOM.campaignInputStoreUrl.value || DOM.campaignInputStoreUrl.value.includes("localhost") || DOM.campaignInputStoreUrl.value.includes("127.0.0.1"))) {
      DOM.campaignInputStoreUrl.value = (isLot && item.url_compra) ? item.url_compra : getActiveStorePublicUrl();
    }
    if (DOM.campaignInputWa && !DOM.campaignInputWa.value && state.storeConfig) {
      DOM.campaignInputWa.value = state.storeConfig.whatsapp_ventas || "51944830586";
    }

    const formEl = document.getElementById("formCampaignGenerator");
    if (formEl) {
      formEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function renderCampaignResults(data, tone) {
    if (!DOM.campaignResultsContainer) return;
    DOM.campaignResultsContainer.classList.remove("hidden");

    if (DOM.resCampaignProdTitle) DOM.resCampaignProdTitle.textContent = data.producto_nombre || "Campaña Generada";
    if (DOM.resCampaignToneSub) DOM.resCampaignToneSub.textContent = `Tono: ${tone} • Piezas y copys multicanal listos para publicar`;

    // Cache-buster para refrescar inmediatamente
    const t = Date.now();
    const card1x1 = document.getElementById("cardCampaignFeed1x1");
    const card9x16 = document.getElementById("cardCampaignStory9x16");

    if (data.feed_1x1_url) {
      if (DOM.imgCampaignFeed1x1) DOM.imgCampaignFeed1x1.src = `${data.feed_1x1_url}?t=${t}`;
      if (DOM.linkDownloadFeedSingle) DOM.linkDownloadFeedSingle.href = data.feed_1x1_url;
      if (card1x1) card1x1.style.display = "";
    } else {
      if (card1x1) card1x1.style.display = "none";
    }

    if (data.story_9x16_url) {
      if (DOM.imgCampaignStory9x16) DOM.imgCampaignStory9x16.src = `${data.story_9x16_url}?t=${t}`;
      if (DOM.linkDownloadStorySingle) DOM.linkDownloadStorySingle.href = data.story_9x16_url;
      if (card9x16) card9x16.style.display = "";
    } else {
      if (card9x16) card9x16.style.display = "none";
    }

    if (DOM.btnDownloadCampaignZip) DOM.btnDownloadCampaignZip.href = data.download_pack_url;

    // Llenar Textareas de los 4 canales comerciales
    const copys = data.copys || {};
    const marketplaceCopy = copys.marketplace || "";
    const storiesCopy = copys.stories_reels || copys.tiktok_reels_script || "";
    const waCopy = copys.whatsapp_broadcast || copys.whatsapp_status || "";
    const emailCopy = copys.email_promo || "";

    if (DOM.copyTextMarketplace) DOM.copyTextMarketplace.value = marketplaceCopy;
    if (DOM.copyTextStoriesReels) DOM.copyTextStoriesReels.value = storiesCopy;
    if (DOM.copyTextWaBroadcast) DOM.copyTextWaBroadcast.value = waCopy;
    if (DOM.copyTextEmailPromo) DOM.copyTextEmailPromo.value = emailCopy;

    // Compatibilidad retroactiva
    if (DOM.copyTextFbIg) DOM.copyTextFbIg.value = copys.facebook_instagram || marketplaceCopy;
    if (DOM.copyTextWaStatus) DOM.copyTextWaStatus.value = waCopy;
    if (DOM.copyTextTikTok) DOM.copyTextTikTok.value = storiesCopy;

    // Botón directo para compartir copy por WhatsApp
    if (DOM.btnCampaignShareDirectWa) {
      const shareText = waCopy || marketplaceCopy;
      const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      DOM.btnCampaignShareDirectWa.onclick = () => window.open(waUrl, "_blank");
    }

    // Scroll suave a los resultados
    DOM.campaignResultsContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function initCampaignModule() {
    // 1. Cambio de producto en el selector
    if (DOM.campaignSelectProduct) {
      DOM.campaignSelectProduct.addEventListener("change", () => {
        const val = DOM.campaignSelectProduct.value;
        if (!val) {
          if (DOM.campaignHiddenProdId) DOM.campaignHiddenProdId.value = "";
          if (DOM.campaignHiddenItemLoteId) DOM.campaignHiddenItemLoteId.value = "";
          return;
        }
        if (val.startsWith("inv_")) {
          const prodId = parseInt(val.replace("inv_", ""), 10);
          const prod = state.inventory.find(p => p.id === prodId);
          if (prod) fillCampaignFormWithProduct(prod, false);
        } else if (val.startsWith("lot_")) {
          const itemId = parseInt(val.replace("lot_", ""), 10);
          const item = state.lotItems.find(p => p.id === itemId);
          if (item) fillCampaignFormWithProduct(item, true);
        } else {
          const prodId = parseInt(val, 10);
          const prod = state.inventory.find(p => p.id === prodId);
          if (prod) fillCampaignFormWithProduct(prod, false);
        }
      });
    }

    // Prellenar URL de tienda y WhatsApp si están vacíos
    if (DOM.campaignInputStoreUrl && !DOM.campaignInputStoreUrl.value) {
      DOM.campaignInputStoreUrl.value = getActiveStorePublicUrl();
    }
    if (DOM.campaignInputWa && !DOM.campaignInputWa.value && state.storeConfig) {
      DOM.campaignInputWa.value = state.storeConfig.whatsapp_ventas || "51944830586";
    }

    // 2. Envío del formulario de generación
    if (DOM.formCampaignGenerator) {
      DOM.formCampaignGenerator.addEventListener("submit", async (e) => {
        e.preventDefault();

        const title = DOM.campaignInputTitle.value.trim();
        const price = parseFloat(DOM.campaignInputPrice.value);
        if (!title || isNaN(price)) {
          showToast("Indica al menos el nombre y precio de venta del producto", "error");
          return;
        }

        // Formatos seleccionados
        const formatos = [];
        if (DOM.campaignFmt1x1 && DOM.campaignFmt1x1.checked) formatos.push("1:1");
        if (DOM.campaignFmt9x16 && DOM.campaignFmt9x16.checked) formatos.push("9:16");
        if (formatos.length === 0) {
          showToast("Selecciona al menos un formato gráfico de imagen (1:1 o 9:16)", "warning");
          return;
        }

        // Canales seleccionados
        const canales = [];
        if (DOM.campaignChanMarketplace && DOM.campaignChanMarketplace.checked) canales.push("marketplace");
        if (DOM.campaignChanStories && DOM.campaignChanStories.checked) canales.push("stories_reels");
        if (DOM.campaignChanWaBroadcast && DOM.campaignChanWaBroadcast.checked) canales.push("whatsapp_broadcast");
        if (DOM.campaignChanEmail && DOM.campaignChanEmail.checked) canales.push("email_promo");

        const model = DOM.campaignInputModel ? DOM.campaignInputModel.value.trim() : "";
        const estado = DOM.campaignSelectEstado ? DOM.campaignSelectEstado.value : "Nuevo";
        const offerPrice = DOM.campaignInputOfferPrice && DOM.campaignInputOfferPrice.value ? parseFloat(DOM.campaignInputOfferPrice.value) : null;
        const margin = DOM.campaignInputMargin && DOM.campaignInputMargin.value ? parseFloat(DOM.campaignInputMargin.value) : null;
        const stock = DOM.campaignInputStock && DOM.campaignInputStock.value ? parseInt(DOM.campaignInputStock.value, 10) : null;
        const tone = DOM.campaignSelectTone ? DOM.campaignSelectTone.value : "Urgencia / Oferta Flash";
        const storeUrl = DOM.campaignInputStoreUrl ? DOM.campaignInputStoreUrl.value.trim() : getActiveStorePublicUrl();
        const waPhone = DOM.campaignInputWa ? DOM.campaignInputWa.value.trim() : "51944830586";
        const prodId = DOM.campaignHiddenProdId && DOM.campaignHiddenProdId.value ? parseInt(DOM.campaignHiddenProdId.value, 10) : null;
        const itemLoteId = DOM.campaignHiddenItemLoteId && DOM.campaignHiddenItemLoteId.value ? parseInt(DOM.campaignHiddenItemLoteId.value, 10) : null;
        const photoUrl = DOM.campaignHiddenPhotoUrl ? DOM.campaignHiddenPhotoUrl.value : null;

        DOM.btnSubmitCampaign.disabled = true;
        DOM.campaignBtnIcon.textContent = "⏳";
        DOM.campaignBtnText.textContent = "Generando piezas y copys con IA...";

        try {
          const res = await fetch("/api/campaigns/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              producto_propio_id: prodId,
              item_lote_id: itemLoteId,
              nombre: title,
              modelo: model,
              estado: estado,
              precio_venta: price,
              precio_oferta: offerPrice,
              margen_beneficio: margin,
              stock: stock,
              enlace: storeUrl,
              foto_url: photoUrl,
              tono: tone,
              url_publica_tienda: storeUrl,
              whatsapp_contacto: waPhone,
              moneda: state.currency,
              formatos: formatos,
              canales: canales
            })
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Error al generar la campaña");
          }

          const data = await res.json();

          // Renderizar resultados
          renderCampaignResults(data, tone);
          showToast("✓ ¡Campaña publicitaria generada con éxito!", "success");

        } catch (err) {
          console.error("Error en campaña:", err);
          showToast(err.message || "Error al generar piezas de campaña", "error");
        } finally {
          DOM.btnSubmitCampaign.disabled = false;
          DOM.campaignBtnIcon.textContent = "✨";
          DOM.campaignBtnText.textContent = "Generar Campaña Completa con IA (Imágenes + Copys)";
        }
      });
    }

    // 3. Botones para copiar texto
    document.querySelectorAll(".btn-copy-text").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetId = btn.dataset.copyId;
        const textarea = document.getElementById(targetId);
        if (textarea && textarea.value) {
          navigator.clipboard.writeText(textarea.value).then(() => {
            const prevText = btn.textContent;
            btn.textContent = "✓ ¡Copiado!";
            btn.classList.add("copied");
            setTimeout(() => {
              btn.textContent = prevText;
              btn.classList.remove("copied");
            }, 1800);
          }).catch(err => {
            console.warn("Clipboard falló, usando fallback de selección:", err);
            textarea.select();
            document.execCommand("copy");
            btn.textContent = "✓ ¡Copiado!";
            btn.classList.add("copied");
            setTimeout(() => {
              btn.textContent = "📋 Copiar Texto";
              btn.classList.remove("copied");
            }, 1800);
          });
        }
      });
    });
  }

  // Cierre universal de modales: clic fuera del contenedor o tecla Escape
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.add("hidden");
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(modal => {
        modal.classList.add("hidden");
      });
    }
  });

  // Desbloqueo interactivo de sesiones de tiendas (Temu, Mercado Libre)
  async function triggerStoreUnlock(storeName) {
    showToast(`Abriendo ventana de navegador para ${storeName}... Si Temu te pide iniciar sesión, ingresa con tu cuenta (Google/Email). Al cerrar la ventana, tu sesión quedará guardada en KipuStock.`, "info");
    try {
      const res = await fetch(`/api/browser-session/unlock?tienda=${encodeURIComponent(storeName)}`, {
        method: "POST"
      });

      // Verificar si la respuesta HTTP indica error antes de intentar parsear
      if (!res.ok) {
        let errorDetail = `Error del servidor (${res.status})`;
        try {
          const errData = await res.json();
          errorDetail = errData.error || errData.mensaje || errorDetail;
        } catch (_) {
          const errText = await res.text().catch(() => "");
          if (errText) errorDetail = errText;
        }
        showToast(`Fallo al desbloquear ${storeName}: ${errorDetail}`, "error");
        return;
      }

      const data = await res.json();
      if (data && (data.status === "ok" || data.ok)) {
        showToast(data.mensaje || `Sesión de ${storeName} sincronizada con éxito en data/browser_profile.`, "success");
      } else {
        const warningMsg = data?.mensaje || data?.error || `Aviso al sincronizar sesión de ${storeName}.`;
        showToast(warningMsg, "warning");
      }
    } catch (e) {
      showToast("Error conectando con el servicio de desbloqueo: " + e.message, "error");
    }
  }

  document.addEventListener("click", (e) => {
    const unlockBtn = e.target.closest(".btn-unlock-session, .unlock-store-link");
    if (unlockBtn) {
      e.preventDefault();
      const store = unlockBtn.getAttribute("data-store") || "Temu";
      triggerStoreUnlock(store);
      return;
    }

    const quickChip = e.target.closest(".btn-quick-chip");
    if (quickChip) {
      e.preventDefault();
      const q = quickChip.getAttribute("data-query");
      if (q && DOM.searchQuery) {
        DOM.searchQuery.value = q;
        performSearch();
      }
      return;
    }

    const activateKayakBtn = e.target.closest("#btnActivateKayakEmpty");
    if (activateKayakBtn) {
      e.preventDefault();
      if (!state.selectedSites.includes("KAYAK")) {
        state.selectedSites.push("KAYAK");
        renderActiveSites();
        showToast("✈️ KAYAK activado. Rastreando tarifas de vuelo...", "info");
      }
      performSearch();
      return;
    }
  });

  // ==============================================================
  // MÓDULO CRM DE CLIENTES, CALCULADORA DE ENVÍOS & COTIZADOR PDF
  // ==============================================================

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 1. Cargar y renderizar tarifas de envío
  async function loadShippingRates() {
    try {
      const res = await fetch("/api/shipping-rates");
      if (!res.ok) return;
      state.shippingRates = await res.json();
      renderShippingRatesOptions();
      renderShippingRatesTable();
    } catch (e) {
      console.warn("Error cargando tarifas de envío:", e);
    }
  }

  function renderShippingRatesOptions() {
    const quoteSelect = document.getElementById("quoteShippingRateSelect");
    const saleSelect = document.getElementById("saleShippingRateSelect");

    const buildOptions = () => {
      let html = "";
      state.shippingRates.forEach(r => {
        html += `<option value="${r.id}" data-cost="${r.costo}" data-name="${escapeHtml(r.nombre)}">
          ${escapeHtml(r.nombre)} (${r.costo > 0 ? "S/ " + r.costo.toFixed(2) : "S/ 0.00 - Gratis"}) - ${escapeHtml(r.tiempo_entrega)}
        </option>`;
      });
      return html;
    };

    if (quoteSelect) {
      quoteSelect.innerHTML = buildOptions();
      updateQuoteFinancialSummary();
    }

    if (saleSelect) {
      saleSelect.innerHTML = `<option value="" data-cost="0">📦 Sin envío / Recojo en mano (S/ 0.00)</option>` + buildOptions();
    }
  }

  function renderShippingRatesTable() {
    const tbody = document.getElementById("shippingRatesTableBody");
    if (!tbody) return;

    if (!state.shippingRates || state.shippingRates.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:1rem;">No hay tarifas registradas.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.shippingRates.map(r => `
      <tr>
        <td>
          <strong style="color:#ffffff;">${escapeHtml(r.nombre)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(r.tipo)} ${r.notas ? '• ' + escapeHtml(r.notas) : ''}</div>
        </td>
        <td><span style="font-size:0.8rem; color:#cbd5e1;">${escapeHtml(r.tiempo_entrega)}</span></td>
        <td style="text-align:right; font-weight:700; color:#4ade80;">S/ ${r.costo.toFixed(2)}</td>
        <td style="text-align:center;">
          <button type="button" class="btn-crm-action btn-edit-rate" data-id="${r.id}" title="Editar">✏️</button>
          <button type="button" class="btn-crm-action btn-delete-rate" data-id="${r.id}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join("");
  }

  // 2. Cargar y renderizar CRM Clientes
  async function loadCrmClients(searchQuery = "") {
    try {
      const url = searchQuery ? `/api/clients?q=${encodeURIComponent(searchQuery)}` : "/api/clients";
      const res = await fetch(url);
      if (!res.ok) return;
      state.crmClients = await res.json();
      renderCrmClientsTable(state.crmClients);
      renderCrmClientsSelect(state.crmClients);

      const countBadge = document.getElementById("crmClientsCountBadge");
      const totalBadge = document.getElementById("crmTotalClientsBadge");
      if (countBadge) countBadge.textContent = state.crmClients.length;
      if (totalBadge) totalBadge.textContent = `${state.crmClients.length} clientes`;
    } catch (e) {
      console.warn("Error cargando clientes del CRM:", e);
    }
  }

  function renderCrmClientsTable(clients) {
    const tbody = document.getElementById("crmClientsTableBody");
    const emptyState = document.getElementById("crmClientsEmptyState");
    if (!tbody) return;

    if (!clients || clients.length === 0) {
      tbody.innerHTML = "";
      if (emptyState) emptyState.classList.remove("hidden");
      return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    tbody.innerHTML = clients.map(c => {
      const initials = (c.nombre || "CL").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
      const phoneClean = (c.telefono_whatsapp || "").replace(/\D/g, "");
      const waUrl = phoneClean ? `https://wa.me/${phoneClean.startsWith('51') ? phoneClean : '51' + phoneClean}?text=${encodeURIComponent(`Hola ${c.nombre}, te saludamos de ${state.storeConfig.nombre_tienda || 'KipuStock Store'}. Tenemos novedades y nuevos productos en stock.`)}` : null;

      return `
        <tr>
          <td>
            <div class="client-name-cell">
              <span class="client-row-avatar">${initials}</span>
              <div>
                <strong style="color:#ffffff;">${escapeHtml(c.nombre)}</strong>
                ${c.telefono_whatsapp ? `
                  <div>
                    <a href="${waUrl || '#'}" target="_blank" class="client-phone-link">
                      📱 ${escapeHtml(c.telefono_whatsapp)} ↗
                    </a>
                  </div>
                ` : '<div style="font-size:0.75rem; color:var(--text-muted);">Sin WhatsApp</div>'}
              </div>
            </div>
          </td>
          <td>
            <div style="font-size:0.85rem; color:#e2e8f0;">${escapeHtml(c.distrito_ciudad || 'Lima')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(c.direccion || '-')}</div>
          </td>
          <td style="text-align:right;">
            <div style="font-weight:700; color:#4ade80;">S/ ${(c.total_compras || 0).toFixed(2)}</div>
            <div style="font-size:0.72rem; color:var(--text-muted);">
              ${c.ultima_compra ? 'Última: ' + new Date(c.ultima_compra).toLocaleDateString() : 'Sin compras'}
            </div>
          </td>
          <td style="text-align:center;">
            <div style="display:flex; gap:4px; justify-content:center;">
              <button type="button" class="btn-crm-action action-quote btn-select-client-quote" data-id="${c.id}" title="Cotizar a este cliente">
                📄 Cotizar
              </button>
              ${waUrl ? `
                <a href="${waUrl}" target="_blank" class="btn-crm-action action-wa" title="Escribir por WhatsApp">
                  💬 Chat
                </a>
              ` : ''}
              <button type="button" class="btn-crm-action btn-edit-client" data-id="${c.id}" title="Editar ficha">✏️</button>
              <button type="button" class="btn-crm-action btn-delete-client" data-id="${c.id}" title="Eliminar">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  function renderCrmClientsSelect(clients) {
    const select = document.getElementById("quoteClientSelect");
    if (!select) return;

    let html = `<option value="">Seleccionar cliente del directorio...</option>`;
    clients.forEach(c => {
      html += `<option value="${c.id}" data-name="${escapeHtml(c.nombre)}" data-phone="${escapeHtml(c.telefono_whatsapp || '')}" data-dist="${escapeHtml(c.distrito_ciudad || '')}" data-address="${escapeHtml(c.direccion || '')}">
        👤 ${escapeHtml(c.nombre)} ${c.distrito_ciudad ? '• ' + escapeHtml(c.distrito_ciudad) : ''}
      </option>`;
    });
    select.innerHTML = html;
  }

  // 3. Productos y Cotizador PDF
  function populateQuoteProductSelect() {
    const select = document.getElementById("quoteProductSelect");
    if (!select) return;

    if (!state.inventory || state.inventory.length === 0) {
      select.innerHTML = `<option value="">No hay productos en Mercadería Propia</option>`;
      return;
    }

    let html = `<option value="">Selecciona un producto de Mercadería Propia...</option>`;
    state.inventory.forEach(p => {
      if (p.stock > 0) {
        html += `<option value="${p.id}" data-name="${escapeHtml(p.nombre)}" data-price="${p.precio_venta}">
          📦 ${escapeHtml(p.nombre)} (Stock: ${p.stock} | S/ ${p.precio_venta.toFixed(2)})
        </option>`;
      }
    });
    select.innerHTML = html;
  }

  function renderQuoteItemsTable() {
    const tbody = document.getElementById("quoteItemsTableBody");
    if (!tbody) return;

    if (!state.quoteItems || state.quoteItems.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:var(--text-muted); padding:1rem;">
            No has añadido productos. Selecciona arriba para armar la cotización.
          </td>
        </tr>
      `;
      updateQuoteFinancialSummary();
      return;
    }

    tbody.innerHTML = state.quoteItems.map((it, idx) => `
      <tr>
        <td>
          <strong style="color:#ffffff;">${escapeHtml(it.nombre)}</strong>
        </td>
        <td style="text-align:center;">
          <input type="number" class="form-control quote-item-qty" data-index="${idx}" min="1" value="${it.cantidad}" style="padding:0.25rem; font-size:0.8rem; text-align:center; width:50px;">
        </td>
        <td style="text-align:right;">
          <input type="number" class="form-control quote-item-price" data-index="${idx}" step="0.50" min="0" value="${it.precio_unitario.toFixed(2)}" style="padding:0.25rem; font-size:0.8rem; text-align:right; width:75px;">
        </td>
        <td style="text-align:right; font-weight:700; color:#e2e8f0;">
          <span class="quote-item-subtotal">S/ ${(it.cantidad * it.precio_unitario).toFixed(2)}</span>
        </td>
        <td style="text-align:center;">
          <button type="button" class="btn-crm-action btn-remove-quote-item" data-index="${idx}" style="color:#f87171;" title="Quitar">✕</button>
        </td>
      </tr>
    `).join("");

    updateQuoteFinancialSummary();
  }

  function updateQuoteFinancialSummary() {
    let subtotalProds = 0;
    if (state.quoteItems) {
      state.quoteItems.forEach(it => {
        subtotalProds += (it.cantidad * it.precio_unitario);
      });
    }

    const shipSelect = document.getElementById("quoteShippingRateSelect");
    let shipCost = 0;
    if (shipSelect && shipSelect.selectedOptions && shipSelect.selectedOptions[0]) {
      shipCost = parseFloat(shipSelect.selectedOptions[0].dataset.cost) || 0;
    }

    const currSelect = document.getElementById("quoteCurrencySelect");
    const sym = (currSelect && currSelect.value === "USD") ? "$" : "S/";

    const total = subtotalProds + shipCost;

    const elSub = document.getElementById("quoteSummarySubtotal");
    const elShip = document.getElementById("quoteSummaryShipping");
    const elTot = document.getElementById("quoteSummaryTotal");

    if (elSub) elSub.textContent = `${sym} ${subtotalProds.toFixed(2)}`;
    if (elShip) elShip.textContent = `+${sym} ${shipCost.toFixed(2)}`;
    if (elTot) elTot.textContent = `${sym} ${total.toFixed(2)}`;
  }

  // 4. Inicialización y Eventos del Módulo CRM
  function initCrmModule() {
    // A. Búsqueda de clientes
    const crmSearch = document.getElementById("crmSearchInput");
    let searchTimer = null;
    if (crmSearch) {
      crmSearch.addEventListener("input", (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          loadCrmClients(e.target.value.trim());
        }, 300);
      });
    }

    // B. Modal Nuevo / Editar Cliente
    const newClientModal = document.getElementById("newClientModal");
    const btnOpenNewClient = document.getElementById("btnOpenNewClientModal");
    const btnCloseNewClient = document.getElementById("btnCloseNewClientModal");
    const btnCancelNewClient = document.getElementById("btnCancelNewClient");
    const formNewClient = document.getElementById("formNewClient");

    const openClientModal = (client = null) => {
      document.getElementById("editClientId").value = client ? client.id : "";
      document.getElementById("clientModalTitle").textContent = client ? "Editar Ficha de Cliente" : "Registrar Nuevo Cliente";
      document.getElementById("clientModalName").value = client ? client.nombre : "";
      document.getElementById("clientModalPhone").value = client ? (client.telefono_whatsapp || "") : "";
      document.getElementById("clientModalDistrict").value = client ? (client.distrito_ciudad || "") : "";
      document.getElementById("clientModalAddress").value = client ? (client.direccion || "") : "";
      document.getElementById("clientModalNotes").value = client ? (client.notas || "") : "";
      if (newClientModal) newClientModal.classList.remove("hidden");
    };

    if (btnOpenNewClient) btnOpenNewClient.addEventListener("click", () => openClientModal());
    if (btnCloseNewClient) btnCloseNewClient.addEventListener("click", () => newClientModal.classList.add("hidden"));
    if (btnCancelNewClient) btnCancelNewClient.addEventListener("click", () => newClientModal.classList.add("hidden"));

    if (formNewClient) {
      formNewClient.addEventListener("submit", async (e) => {
        e.preventDefault();
        const editId = document.getElementById("editClientId").value;
        const payload = {
          nombre: document.getElementById("clientModalName").value.trim(),
          telefono_whatsapp: document.getElementById("clientModalPhone").value.trim() || null,
          distrito_ciudad: document.getElementById("clientModalDistrict").value.trim() || null,
          direccion: document.getElementById("clientModalAddress").value.trim() || null,
          notas: document.getElementById("clientModalNotes").value.trim() || null
        };

        try {
          const url = editId ? `/api/clients/${editId}` : "/api/clients";
          const method = editId ? "PUT" : "POST";
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Error guardando cliente");
          }

          showToast(`✓ Cliente ${editId ? "actualizado" : "registrado"} con éxito`, "success");
          if (newClientModal) newClientModal.classList.add("hidden");
          await loadCrmClients();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    }

    // C. Modal Tarifas de Envío
    const shippingModal = document.getElementById("shippingRatesModal");
    const btnOpenShipping = document.getElementById("btnOpenShippingRatesModal");
    const btnCloseShipping = document.getElementById("btnCloseShippingRatesModal");
    const formShippingRate = document.getElementById("formShippingRate");
    const btnCancelEditRate = document.getElementById("btnCancelEditShippingRate");

    if (btnOpenShipping) btnOpenShipping.addEventListener("click", () => {
      if (shippingModal) shippingModal.classList.remove("hidden");
      renderShippingRatesTable();
    });
    if (btnCloseShipping) btnCloseShipping.addEventListener("click", () => shippingModal.classList.add("hidden"));

    if (btnCancelEditRate) {
      btnCancelEditRate.addEventListener("click", () => {
        document.getElementById("editShippingRateId").value = "";
        document.getElementById("shippingRateFormTitle").textContent = "+ Agregar Nueva Tarifa";
        formShippingRate.reset();
        btnCancelEditRate.style.display = "none";
      });
    }

    if (formShippingRate) {
      formShippingRate.addEventListener("submit", async (e) => {
        e.preventDefault();
        const editId = document.getElementById("editShippingRateId").value;
        const payload = {
          nombre: document.getElementById("shippingRateName").value.trim(),
          costo: parseFloat(document.getElementById("shippingRateCost").value) || 0,
          tiempo_entrega: document.getElementById("shippingRateDeliveryTime").value.trim() || "24 a 48 hrs",
          tipo: document.getElementById("shippingRateType").value,
          activo: true
        };

        try {
          const url = editId ? `/api/shipping-rates/${editId}` : "/api/shipping-rates";
          const method = editId ? "PUT" : "POST";
          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Error al guardar tarifa");
          }

          showToast(`✓ Tarifa de envío ${editId ? "actualizada" : "creada"} correctamente`, "success");
          document.getElementById("editShippingRateId").value = "";
          document.getElementById("shippingRateFormTitle").textContent = "+ Agregar Nueva Tarifa";
          formShippingRate.reset();
          if (btnCancelEditRate) btnCancelEditRate.style.display = "none";
          await loadShippingRates();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    }

    // Delegación de clics en tablas de tarifas y clientes
    document.addEventListener("click", async (e) => {
      // Editar tarifa
      const editRateBtn = e.target.closest(".btn-edit-rate");
      if (editRateBtn) {
        const id = parseInt(editRateBtn.dataset.id);
        const rate = state.shippingRates.find(r => r.id === id);
        if (rate) {
          document.getElementById("editShippingRateId").value = rate.id;
          document.getElementById("shippingRateFormTitle").textContent = `✏️ Editar Tarifa: ${rate.nombre}`;
          document.getElementById("shippingRateName").value = rate.nombre;
          document.getElementById("shippingRateCost").value = rate.costo;
          document.getElementById("shippingRateDeliveryTime").value = rate.tiempo_entrega;
          document.getElementById("shippingRateType").value = rate.tipo;
          if (btnCancelEditRate) btnCancelEditRate.style.display = "inline-block";
        }
      }

      // Eliminar tarifa
      const delRateBtn = e.target.closest(".btn-delete-rate");
      if (delRateBtn) {
        const id = parseInt(delRateBtn.dataset.id);
        if (confirm("¿Estás seguro de eliminar esta tarifa de despacho?")) {
          try {
            const res = await fetch(`/api/shipping-rates/${id}`, { method: "DELETE" });
            if (res.ok) {
              showToast("Tarifa eliminada", "info");
              await loadShippingRates();
            }
          } catch (err) {
            showToast("Error al eliminar tarifa: " + err.message, "error");
          }
        }
      }

      // Editar cliente
      const editClientBtn = e.target.closest(".btn-edit-client");
      if (editClientBtn) {
        const id = parseInt(editClientBtn.dataset.id);
        const cli = state.crmClients.find(c => c.id === id);
        if (cli) openClientModal(cli);
      }

      // Eliminar cliente
      const delClientBtn = e.target.closest(".btn-delete-client");
      if (delClientBtn) {
        const id = parseInt(delClientBtn.dataset.id);
        const cli = state.crmClients.find(c => c.id === id);
        if (confirm(`¿Deseas eliminar la ficha de "${cli ? cli.nombre : 'cliente'}" del CRM?`)) {
          try {
            const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
            if (res.ok) {
              showToast("Cliente eliminado del CRM", "info");
              await loadCrmClients();
            }
          } catch (err) {
            showToast("Error al eliminar cliente: " + err.message, "error");
          }
        }
      }

      // Seleccionar cliente para cotización rápida
      const quoteClientBtn = e.target.closest(".btn-select-client-quote");
      if (quoteClientBtn) {
        const id = parseInt(quoteClientBtn.dataset.id);
        const clientSelect = document.getElementById("quoteClientSelect");
        if (clientSelect) {
          clientSelect.value = id;
          clientSelect.dispatchEvent(new Event("change"));
          document.querySelector(".crm-quote-card")?.scrollIntoView({ behavior: "smooth" });
          showToast("Cliente cargado en el cotizador", "info");
        }
      }

      // Quitar ítem de cotización
      const removeQuoteItemBtn = e.target.closest(".btn-remove-quote-item");
      if (removeQuoteItemBtn) {
        const index = parseInt(removeQuoteItemBtn.dataset.index);
        state.quoteItems.splice(index, 1);
        renderQuoteItemsTable();
      }
    });

    // D. Cotizador: Selección de cliente
    const quoteClientSelect = document.getElementById("quoteClientSelect");
    if (quoteClientSelect) {
      quoteClientSelect.addEventListener("change", () => {
        const opt = quoteClientSelect.selectedOptions[0];
        if (opt && opt.value) {
          document.getElementById("quoteClientName").value = opt.dataset.name || "";
          document.getElementById("quoteClientPhone").value = opt.dataset.phone || "";
          document.getElementById("quoteClientDist").value = opt.dataset.dist || "";
          document.getElementById("quoteClientAddress").value = opt.dataset.address || "";
        }
      });
    }

    const btnToggleManualClient = document.getElementById("btnToggleManualClient");
    if (btnToggleManualClient) {
      btnToggleManualClient.addEventListener("click", () => {
        if (quoteClientSelect) quoteClientSelect.value = "";
        document.getElementById("quoteClientName").value = "";
        document.getElementById("quoteClientPhone").value = "";
        document.getElementById("quoteClientDist").value = "";
        document.getElementById("quoteClientAddress").value = "";
        document.getElementById("quoteClientName").focus();
        showToast("Ingresa los datos del cliente manualmente", "info");
      });
    }

    // E. Cotizador: Agregar producto de inventario
    const btnAddProdQuote = document.getElementById("btnAddProductToQuote");
    if (btnAddProdQuote) {
      btnAddProdQuote.addEventListener("click", () => {
        const prodSelect = document.getElementById("quoteProductSelect");
        const qtyInput = document.getElementById("quoteProductQty");
        const opt = prodSelect.selectedOptions[0];

        if (!opt || !opt.value) {
          showToast("Selecciona un producto de tu inventario", "warning");
          return;
        }

        const prodId = parseInt(opt.value);
        const prodName = opt.dataset.name;
        const price = parseFloat(opt.dataset.price) || 0;
        const qty = parseInt(qtyInput.value) || 1;

        // Si ya está en la lista, sumar cantidad
        const existing = state.quoteItems.find(it => it.producto_id === prodId);
        if (existing) {
          existing.cantidad += qty;
        } else {
          state.quoteItems.push({
            producto_id: prodId,
            nombre: prodName,
            cantidad: qty,
            precio_unitario: price
          });
        }

        renderQuoteItemsTable();
        showToast(`✓ Añadido: ${prodName} (x${qty})`, "success");
      });
    }

    // F. Cotizador: Agregar ítem manual libre
    const btnOpenManualItem = document.getElementById("btnOpenManualItemRow");
    const manualItemWrap = document.getElementById("quoteManualItemWrap");
    if (btnOpenManualItem && manualItemWrap) {
      btnOpenManualItem.addEventListener("click", () => {
        manualItemWrap.classList.toggle("hidden");
        if (!manualItemWrap.classList.contains("hidden")) {
          document.getElementById("quoteManualItemName").focus();
        }
      });
    }

    const btnAddManualItem = document.getElementById("btnAddManualItemBtn");
    if (btnAddManualItem) {
      btnAddManualItem.addEventListener("click", () => {
        const nameInput = document.getElementById("quoteManualItemName");
        const qtyInput = document.getElementById("quoteManualItemQty");
        const priceInput = document.getElementById("quoteManualItemPrice");

        const name = nameInput.value.trim();
        const qty = parseInt(qtyInput.value) || 1;
        const price = parseFloat(priceInput.value) || 0;

        if (!name) {
          showToast("Indica el nombre del producto o concepto", "warning");
          return;
        }
        if (price <= 0) {
          showToast("Ingresa un precio unitario mayor a 0", "warning");
          return;
        }

        state.quoteItems.push({
          producto_id: null,
          nombre: name,
          cantidad: qty,
          precio_unitario: price
        });

        renderQuoteItemsTable();
        nameInput.value = "";
        priceInput.value = "";
        if (manualItemWrap) manualItemWrap.classList.add("hidden");
        showToast(`✓ Ítem manual añadido: ${name}`, "success");
      });
    }

    // Modificar cantidad o precio en la tabla
    const quoteTable = document.getElementById("quoteItemsTableBody");
    if (quoteTable) {
      quoteTable.addEventListener("input", (e) => {
        const qtyInput = e.target.closest(".quote-item-qty");
        if (qtyInput) {
          const idx = parseInt(qtyInput.dataset.index);
          const val = parseInt(qtyInput.value) || 1;
          if (state.quoteItems[idx]) {
            state.quoteItems[idx].cantidad = val;
            const subSpan = qtyInput.closest("tr").querySelector(".quote-item-subtotal");
            if (subSpan) subSpan.textContent = `S/ ${(val * state.quoteItems[idx].precio_unitario).toFixed(2)}`;
            updateQuoteFinancialSummary();
          }
        }

        const priceInput = e.target.closest(".quote-item-price");
        if (priceInput) {
          const idx = parseInt(priceInput.dataset.index);
          const val = parseFloat(priceInput.value) || 0;
          if (state.quoteItems[idx]) {
            state.quoteItems[idx].precio_unitario = val;
            const subSpan = priceInput.closest("tr").querySelector(".quote-item-subtotal");
            if (subSpan) subSpan.textContent = `S/ ${(state.quoteItems[idx].cantidad * val).toFixed(2)}`;
            updateQuoteFinancialSummary();
          }
        }
      });
    }

    // Cambio de tarifa o moneda
    const quoteShippingSelect = document.getElementById("quoteShippingRateSelect");
    if (quoteShippingSelect) {
      quoteShippingSelect.addEventListener("change", () => updateQuoteFinancialSummary());
    }

    const quoteCurrSelect = document.getElementById("quoteCurrencySelect");
    if (quoteCurrSelect) {
      quoteCurrSelect.addEventListener("change", () => updateQuoteFinancialSummary());
    }

    // Tarifa de envío en formulario Registrar Venta
    const saleShippingRateSelect = document.getElementById("saleShippingRateSelect");
    if (saleShippingRateSelect) {
      saleShippingRateSelect.addEventListener("change", () => {
        const opt = saleShippingRateSelect.selectedOptions[0];
        if (opt && opt.dataset.cost) {
          if (DOM.saleCommissionDelivery) {
            DOM.saleCommissionDelivery.value = parseFloat(opt.dataset.cost).toFixed(2);
            updateSaleLiveCalc();
          }
        }
      });
    }

    // G. Formulario Generar Cotización PDF
    const formQuote = document.getElementById("formQuoteGenerator");
    const quoteResultCard = document.getElementById("quoteResultCard");
    const btnDownloadQuote = document.getElementById("btnDownloadQuotePdf");
    const btnShareQuoteWa = document.getElementById("btnShareQuoteWhatsApp");
    const btnSubmitQuote = document.getElementById("btnGenerateQuotePdf");

    if (formQuote) {
      formQuote.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!state.quoteItems || state.quoteItems.length === 0) {
          showToast("Añade al menos un producto a la cotización", "warning");
          return;
        }

        const cliName = document.getElementById("quoteClientName").value.trim() || "Cliente Particular";
        const cliPhone = document.getElementById("quoteClientPhone").value.trim() || "";
        const cliDist = document.getElementById("quoteClientDist").value.trim() || "Lima";
        const cliAddress = document.getElementById("quoteClientAddress").value.trim() || "";

        const clientSelectVal = quoteClientSelect ? parseInt(quoteClientSelect.value) || null : null;
        const shippingSelectVal = quoteShippingSelect ? parseInt(quoteShippingSelect.value) || null : null;
        const currencyVal = quoteCurrSelect ? quoteCurrSelect.value : "PEN";
        const validityVal = parseInt(document.getElementById("quoteValidityDays")?.value) || 2;
        const notesVal = document.getElementById("quoteNotesInput")?.value.trim() || null;

        btnSubmitQuote.disabled = true;
        btnSubmitQuote.innerHTML = `<span>⏳ Generando Cotización PDF...</span>`;

        try {
          const res = await fetch("/api/quotes/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cliente_id: clientSelectVal,
              cliente_nombre: cliName,
              cliente_telefono: cliPhone,
              cliente_distrito: cliDist,
              cliente_direccion: cliAddress,
              items: state.quoteItems,
              tarifa_envio_id: shippingSelectVal,
              moneda: currencyVal,
              validez_dias: validityVal,
              notas: notesVal
            })
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || "Error al generar cotización en PDF");
          }

          const quoteData = await res.json();
          state.currentQuote = quoteData;

          // Mostrar tarjeta de resultado
          if (quoteResultCard) {
            quoteResultCard.classList.remove("hidden");
            document.getElementById("quoteResultCorrelativo").textContent = `📄 ${quoteData.correlativo} (Total: ${quoteData.moneda === 'USD' ? '$' : 'S/'} ${quoteData.total.toFixed(2)})`;
            if (btnDownloadQuote) {
              btnDownloadQuote.href = quoteData.pdf_url;
              btnDownloadQuote.setAttribute("download", quoteData.download_filename);
            }
            if (btnShareQuoteWa) {
              const phoneClean = cliPhone.replace(/\D/g, "");
              const waUrl = `https://wa.me/${phoneClean.startsWith('51') ? phoneClean : '51' + phoneClean}?text=${encodeURIComponent(quoteData.whatsapp_message)}`;
              btnShareQuoteWa.onclick = () => window.open(waUrl, "_blank");
            }
            quoteResultCard.scrollIntoView({ behavior: "smooth", block: "center" });
          }

          showToast(`✓ Cotización ${quoteData.correlativo} creada exitosamente en PDF`, "success");
          await loadCrmClients();
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          btnSubmitQuote.disabled = false;
          btnSubmitQuote.innerHTML = `<span>📄</span> Generar Cotización en PDF Oficial`;
        }
      });
    }
  }

  init();
});
