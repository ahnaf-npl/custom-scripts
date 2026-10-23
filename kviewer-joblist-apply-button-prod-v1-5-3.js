
/**
 * ============================================================
 * KViewer Job Apply Buttons v1.5.3
 * ============================================================
 *
 * Features:
 * - DETAIL dan DAFTAR pada daftar pekerjaan
 * - DAFTAR pada halaman detail
 * - WhatsApp / Telegram / Both
 * - Default: Telegram
 * - Panduan terpisah sesuai channel
 * - Telegram Job Code prefill (?text=)
 * - Copy Job Code
 * - Download PDF Google Drive
 * - Countdown sebelum pendaftaran
 * - Responsive desktop/mobile
 * - Validasi Job ID dan cleanup tombol salah tempat
 * - Optional IP restriction
 */

(function () {
  "use strict";

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    name: "KViewer Job Apply Buttons",
    version: "1.5.3",
    debug: false,

    host: "e-bridge-id.viewer.kintoneapp.com",
    listPath: "/public/sswjoblist",
    detailPathPart: "/public/sswjoblist/detail/",

    jobIdFieldCode: "求人票ID",
    jobIdLabels: [
      "求人票ID",
      "Job ID",
      "Job Id",
      "JOB ID"
    ],
    jobPrefix: "JOB-",
    pdfUrlFieldCode: "job_detail_url_idn",

    // ========================================================
    // REGISTRATION SETTINGS
    // ========================================================
    //
    // "telegram" = hanya Telegram (DEFAULT)
    // "whatsapp" = hanya WhatsApp
    // "both"     = Telegram dan WhatsApp
    //
    // Instruksi modal otomatis menyesuaikan.
    // ========================================================

    registrationMode: "telegram",

    registrationDelaySeconds: 5,

    whatsappBaseUrl: "https://wa.me/6285258363076",
    telegramBotUrl: "https://t.me/actjob_id_bot",

    // ========================================================
    // DETAIL FIELDS
    // ========================================================

    detailFields: {
      hideEmptyFields: true,
      neverHideFieldTypes: [
        "INDEX_LINK",
        "LABEL",
        "HR",
        "SPACER"
      ],
      neverHideFieldCodes: [],
    },

    // ========================================================
    // IP RESTRICTION
    // ========================================================

    ipRestriction: {
      enabled: false,
      allowedIps: [],
      allowWhenUnknown: false,
      overrideQueryParam: "kv_test_ip",
      overrideLocalStorageKey: "kv_test_ip",
      publicIpUrls: [
        "https://api.ipify.org?format=json",
        "https://ipinfo.io/ip"
      ],
      timeoutMs: 2500,
    },

    mutationDelay: 150,
    periodicDelay: 0,
  };

  // ============================================================
  // INITIAL STATE
  // ============================================================

  if (location.hostname !== CONFIG.host) return;

  const IDS = {
    style: "kv-job-apply-style",
    modal: "kv-job-apply-modal"
  };

  const INSTANCE_KEY =
    "__kvJobApplyButtonsInstance";

  const CARD_ATTR =
    "data-kv-job-card-enhanced";

  const state = {
    observer: null,
    renderTimer: null,
    intervalId: null,
    countdownTimer: null,
    clickGuard: null,
    destroyed: false,
  };

  if (
    typeof window[INSTANCE_KEY]?.destroy === "function"
  ) {
    window[INSTANCE_KEY].destroy();
  }

  window[INSTANCE_KEY] = { destroy };

  boot();

  // ============================================================
  // GENERAL HELPERS
  // ============================================================

  function log(...args) {
    if (CONFIG.debug) {
      console.log(
        `[${CONFIG.name} ${CONFIG.version}]`,
        ...args
      );
    }
  }

  function norm(value) {
    return String(value ?? "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isIndexPage() {
    return (
      location.pathname.replace(/\/+$/, "") ===
      CONFIG.listPath
    );
  }

  function isDetailPage() {
    return location.pathname.includes(
      CONFIG.detailPathPart
    );
  }

  function extractJobId(text) {
    const match = norm(text).match(
      /(?:^|[^A-Za-z0-9])(?:JOB-)?(20\d{2}-\d{3,})(?![A-Za-z0-9])/i
    );

    return match ? match[1] : "";
  }

  function allJobIds(text) {
    const matches = [
      ...norm(text).matchAll(
        /(?:^|[^A-Za-z0-9])(?:JOB-)?(20\d{2}-\d{3,})(?![A-Za-z0-9])/gi
      )
    ];

    return [
      ...new Set(matches.map(match => match[1]))
    ];
  }

  function makeJobCode(id) {
    const validId = extractJobId(id);

    return validId
      ? CONFIG.jobPrefix + validId
      : "";
  }

  function cssEscape(value) {
    if (window.CSS?.escape) {
      return CSS.escape(value);
    }

    return String(value).replace(
      /[^\w-]/g,
      char => "\\" + char
    );
  }

  // ============================================================
  // REGISTRATION MODE
  // ============================================================

  function getRegistrationMode() {
    const mode = norm(
      CONFIG.registrationMode
    ).toLowerCase();

    if (
      mode === "telegram" ||
      mode === "whatsapp" ||
      mode === "both"
    ) {
      return mode;
    }

    log(
      "Invalid registrationMode. Using Telegram.",
      mode
    );

    return "telegram";
  }

  function registrationChannels() {
    const mode = getRegistrationMode();

    switch (mode) {
      case "whatsapp":
        return ["whatsapp"];

      case "both":
        return ["whatsapp", "telegram"];

      case "telegram":
      default:
        return ["telegram"];
    }
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  function destroy() {
    state.destroyed = true;

    clearTimeout(state.renderTimer);
    clearInterval(state.intervalId);
    clearInterval(state.countdownTimer);

    state.observer?.disconnect();

    if (state.clickGuard) {
      document.removeEventListener(
        "click",
        state.clickGuard,
        true
      );
    }

    document.removeEventListener(
      "keydown",
      onEscape
    );

    document.getElementById(IDS.modal)?.remove();

    document.body?.classList.remove(
      "kv-job-modal-open"
    );
  }

  async function boot() {
    installStyles();

    const allowed = await isAccessAllowed();

    if (!allowed || state.destroyed) {
      return;
    }

    if (!document.body) {
      document.addEventListener(
        "DOMContentLoaded",
        start,
        { once: true }
      );
    } else {
      start();
    }
  }

  function start() {
    if (state.destroyed) return;

    state.clickGuard = function (event) {
      if (!(event.target instanceof Element)) {
        return;
      }

      const action = event.target.closest(
        "[data-kv-job-action]"
      );

      if (!action) return;

      const type = action.dataset.kvJobAction;

      if (
        ![
          "apply",
          "detail",
          "download-pdf"
        ].includes(type)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      if (type === "apply") {
        openApplyModal(
          action.dataset.kvJobCode,
          action
        );
      }

      if (type === "detail") {
        goToDetail(action);
      }

      if (type === "download-pdf") {
        downloadPdf(action.dataset.kvPdfUrl);
      }
    };

    document.addEventListener(
      "click",
      state.clickGuard,
      true
    );

    state.observer = new MutationObserver(
      () => scheduleRender()
    );

    state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    scheduleRender();

    if (CONFIG.periodicDelay > 0) {
      state.intervalId = setInterval(
        scheduleRender,
        CONFIG.periodicDelay
      );
    }
  }

  function scheduleRender() {
    if (state.destroyed) return;

    clearTimeout(state.renderTimer);

    state.renderTimer = setTimeout(
      render,
      CONFIG.mutationDelay
    );
  }

  function render() {
    if (state.destroyed) return;

    if (isIndexPage()) {
      cleanupMisplacedActions();
      enhanceIndexPage();
    } else if (isDetailPage()) {
      cleanupMisplacedActions();
      enhanceDetailPage();
    }
  }

  // ============================================================
  // FIELD / JOB ID DETECTION
  // ============================================================

  function fieldByCode(root, code) {
    if (!root || !code) return null;

    const selector =
      `[data-field-code="${cssEscape(code)}"]`;

    const nodes = [
      ...root.querySelectorAll(selector)
    ];

    return (
      nodes.find(el =>
        el.matches(
          ".kv-list-field-value, .kv-detail-field-value"
        )
      ) ||
      nodes.find(el =>
        el.matches(".kv-detail-field")
      ) ||
      nodes[0] ||
      null
    );
  }

  function getFieldText(field) {
    if (!field) return "";

    if (
      field.matches("input, textarea, select")
    ) {
      return field.value || "";
    }

    const value = field.matches(
      ".kv-list-field-value, .kv-detail-field-value"
    )
      ? field
      : (
          field.querySelector(
            ".kv-list-field-value, .kv-detail-field-value"
          ) || field
        );

    const control = value.querySelector(
      "input, textarea, select"
    );

    if (control) {
      return control.value || "";
    }

    return (
      value.innerText ||
      value.textContent ||
      ""
    );
  }

  function findJobIdInRoot(root) {
    if (!root) return "";

    const direct = extractJobId(
      getFieldText(
        fieldByCode(
          root,
          CONFIG.jobIdFieldCode
        )
      )
    );

    if (direct) return direct;

    const labels = [
      ...root.querySelectorAll(
        "dt, th, label, .kv-list-field-label, .kv-detail-field-label"
      )
    ];

    for (const element of labels) {
      const label = norm(
        element.innerText || element.textContent
      );

      if (!CONFIG.jobIdLabels.includes(label)) {
        continue;
      }

      const parent = element.parentElement;

      const sibling =
        element.nextElementSibling ||
        parent?.querySelector(
          "dd, .kv-list-field-value, .kv-detail-field-value"
        );

      const result = extractJobId(
        sibling?.innerText ||
        sibling?.textContent ||
        ""
      );

      if (result) return result;
    }

    const ids = allJobIds(
      root.innerText || root.textContent
    );

    return ids.length === 1
      ? ids[0]
      : "";
  }

  function displayJobCode(root) {
    const field = fieldByCode(
      root,
      CONFIG.jobIdFieldCode
    );

    if (!field) return;

    const value = field.matches(
      ".kv-list-field-value, .kv-detail-field-value"
    )
      ? field
      : field.querySelector(
          ".kv-list-field-value, .kv-detail-field-value"
        );

    if (!value) return;

    if (
      value.querySelector(
        "input, textarea, select"
      )
    ) {
      return;
    }

    const id = extractJobId(
      value.innerText || value.textContent
    );

    if (!id) return;

    const target =
      value.querySelector("div, span, p") ||
      value;

    const formatted = makeJobCode(id);

    if (norm(target.textContent) !== formatted) {
      target.textContent = formatted;
    }
  }

  // ============================================================
  // INDEX PAGE: FIND INDIVIDUAL RECORDS
  // ============================================================

  function findIndexCards() {
    const scope =
      document.querySelector("#__next main") ||
      document.querySelector("main") ||
      document;

    const rows = [
      ...scope.querySelectorAll("tr")
    ].filter(row => {
      if (!row.querySelector("td")) {
        return false;
      }

      const ids = allJobIds(
        row.innerText || row.textContent
      );

      return (
        ids.length === 1 &&
        Boolean(findJobIdInRoot(row))
      );
    });

    if (rows.length) {
      return rows;
    }

    const candidates = [
      ...scope.querySelectorAll(
        ".kv-list-record, article, li, .card, [class*='Card'], [class*='card']"
      )
    ].filter(element => {
      if (!(element instanceof HTMLElement)) {
        return false;
      }

      if (
        element.id === "__next" ||
        element === document.body
      ) {
        return false;
      }

      if (element.closest(`#${IDS.modal}`)) {
        return false;
      }

      if (
        element.querySelector(
          "tr, article, .kv-list-record"
        )
      ) {
        return false;
      }

      const ids = allJobIds(
        element.innerText || element.textContent
      );

      if (
        ids.length !== 1 ||
        !findJobIdInRoot(element)
      ) {
        return false;
      }

      const rect =
        element.getBoundingClientRect();

      return (
        rect.width > 160 &&
        rect.height > 60
      );
    });

    return candidates.filter(card =>
      !candidates.some(other =>
        other !== card &&
        card.contains(other)
      )
    );
  }

  // ============================================================
  // REMOVE MISPLACED ACTION BUTTONS
  // ============================================================

  function cleanupMisplacedActions() {
    const root =
      document.getElementById("__next");

    if (root) {
      root.querySelectorAll(
        ":scope > .kv-job-card-actions"
      ).forEach(element => element.remove());

      root.removeAttribute(CARD_ATTR);

      root.classList.remove(
        "kv-job-list-row-desktop-enhanced",
        "kv-job-list-card-mobile-enhanced"
      );
    }

    const validCards = new Set(
      isIndexPage()
        ? findIndexCards()
        : []
    );

    document.querySelectorAll(
      ".kv-job-card-actions"
    ).forEach(actions => {
      if (
        actions.closest(`#${IDS.modal}`)
      ) {
        return;
      }

      const owner = [...validCards].find(
        card => card.contains(actions)
      );

      if (!owner) {
        actions.remove();
      }
    });

    document.querySelectorAll(
      `[${CARD_ATTR}="true"]`
    ).forEach(element => {
      if (validCards.has(element)) {
        return;
      }

      element.removeAttribute(CARD_ATTR);

      element.classList.remove(
        "kv-job-list-row-desktop-enhanced",
        "kv-job-list-card-mobile-enhanced"
      );
    });
  }

  // ============================================================
  // ENHANCE INDEX PAGE
  // ============================================================

  function enhanceIndexPage() {
    const cards = findIndexCards();

    cards.forEach(card => {
      const jobCode = makeJobCode(
        findJobIdInRoot(card)
      );

      if (!jobCode) return;

      displayJobCode(card);

      const mount = findIndexActionMount(
        card
      );

      if (!mount) return;

      let actions = mount.querySelector(
        ":scope > .kv-job-card-actions"
      );

      if (!actions) {
        actions = document.createElement("div");

        actions.className =
          "kv-job-card-actions";

        const detailButton = createButton(
          "DETAIL",
          "secondary",
          "detail"
        );

        detailButton.dataset.kvJobAction =
          "detail";

        const applyButton = createButton(
          "DAFTAR",
          "primary",
          "send"
        );

        applyButton.dataset.kvJobAction =
          "apply";

        actions.append(
          detailButton,
          applyButton
        );

        mount.appendChild(actions);
      }

      const applyButton = actions.querySelector(
        '[data-kv-job-action="apply"]'
      );

      if (applyButton) {
        applyButton.dataset.kvJobCode =
          jobCode;
      }

      hideNativeDetailArrow(card);

      const mobile = mount.classList.contains(
        "kv-job-list-action-dd"
      );

      card.classList.toggle(
        "kv-job-list-card-mobile-enhanced",
        mobile
      );

      card.classList.toggle(
        "kv-job-list-row-desktop-enhanced",
        !mobile
      );

      card.setAttribute(
        CARD_ATTR,
        "true"
      );
    });
  }

  function findIndexActionMount(card) {
    if (card.tagName !== "TR") {
      return card;
    }

    const dl = card.querySelector(
      "td:first-child dl"
    );

    if (dl) {
      card.closest("table")?.classList.add(
        "kv-job-mobile-list-table"
      );

      card.closest("tbody")?.classList.add(
        "kv-job-mobile-list-body"
      );

      card.querySelector(
        "td:first-child"
      )?.classList.add(
        "kv-job-mobile-list-cell"
      );

      let dd = dl.querySelector(
        ".kv-job-list-action-dd"
      );

      if (!dd) {
        dd = document.createElement("dd");

        dd.className =
          "kv-job-list-action-dd";

        dl.appendChild(dd);
      }

      return dd;
    }

    let cell = card.querySelector(
      ":scope > td.kv-job-table-action-cell"
    );

    if (!cell) {
      cell = document.createElement("td");

      cell.className =
        "kv-job-table-action-cell";

      card.appendChild(cell);
    }

    return cell;
  }

  function hideNativeDetailArrow(card) {
    if (card.tagName !== "TR") return;

    [...card.children]
      .filter(el => el.tagName === "TD")
      .forEach(cell => {
        if (
          cell.classList.contains(
            "kv-job-table-action-cell"
          )
        ) {
          return;
        }

        const text = norm(
          cell.innerText || cell.textContent
        );

        if (
          !text &&
          cell.querySelector("svg") &&
          !cell.dataset.fieldCode
        ) {
          cell.classList.add(
            "kv-job-native-arrow-hidden"
          );
        }
      });
  }

  // ============================================================
  // ENHANCE DETAIL PAGE
  // ============================================================

  function enhanceDetailPage() {
    const root = document.querySelector(
      ".kv-detail"
    );

    if (!root) return;

    displayJobCode(root);
    updateEmptyDetailFields(root);

    const pdfUrl = findPdfUrl(root);

    const pdfField = fieldByCode(
      root,
      CONFIG.pdfUrlFieldCode
    );

    if (pdfField) {
      pdfField.classList.add(
        "kv-job-pdf-url-field-hidden"
      );

      pdfField.closest(
        ".kv-detail-field"
      )?.classList.add(
        "kv-job-pdf-url-field-hidden"
      );
    }

    const jobCode = makeJobCode(
      findJobIdInRoot(root)
    );

    if (!jobCode) return;

    const back = findBackElement(root);

    if (!back || !back.parentElement) {
      return;
    }

    enhanceBackControl(back);

    const toolbar = back.parentElement;

    toolbar.classList.add(
      "kv-job-detail-toolbar"
    );

    toolbar.classList.toggle(
      "kv-job-detail-toolbar-has-pdf",
      Boolean(pdfUrl)
    );

    document.querySelectorAll(
      ".kv-job-detail-toolbar [data-kv-job-action='apply']"
    ).forEach(element => {
      if (element.parentElement !== toolbar) {
        element.remove();
      }
    });

    let apply = toolbar.querySelector(
      ":scope > [data-kv-job-action='apply']"
    );

    if (!apply) {
      apply = createButton(
        "DAFTAR",
        "primary",
        "send"
      );

      apply.dataset.kvJobAction =
        "apply";

      toolbar.appendChild(apply);
    }

    apply.dataset.kvJobCode = jobCode;

    let pdf = toolbar.querySelector(
      ":scope > [data-kv-job-action='download-pdf']"
    );

    if (pdfUrl) {
      if (!pdf) {
        pdf = createButton(
          "DOWNLOAD PDF",
          "secondary",
          "download"
        );

        pdf.classList.add(
          "kv-job-download-pdf-button"
        );

        pdf.dataset.kvJobAction =
          "download-pdf";

        toolbar.insertBefore(
          pdf,
          apply
        );
      }

      pdf.dataset.kvPdfUrl = pdfUrl;
    } else if (pdf) {
      pdf.remove();
    }
  }

  function updateEmptyDetailFields(root) {
    const cfg = CONFIG.detailFields;

    for (
      const field of root.querySelectorAll(
        ".kv-detail-field"
      )
    ) {
      const type = norm(
        field.dataset.fieldType
      );

      const code = norm(
        field.dataset.fieldCode
      );

      const value = field.querySelector(
        ".kv-detail-field-value"
      );

      const hasContent =
        value && (
          norm(
            value.innerText ||
            value.textContent
          ) ||
          value.querySelector(
            "img, video, audio, canvas, iframe, svg, a[href], button, input, textarea, select"
          )
        );

      const hide =
        cfg.hideEmptyFields &&
        value &&
        !hasContent &&
        !cfg.neverHideFieldTypes.includes(type) &&
        !cfg.neverHideFieldCodes.includes(code);

      field.classList.toggle(
        "kv-job-empty-field-hidden",
        Boolean(hide)
      );
    }
  }

  function findBackElement(root) {
    return [
      ...root.querySelectorAll(
        "a, button, [role='button']"
      )
    ].find(element => {
      if (element.dataset.kvJobAction) {
        return false;
      }

      const label = norm(
        element.innerText ||
        element.textContent ||
        element.getAttribute("aria-label")
      );

      const href =
        element.getAttribute("href") ||
        "";

      return (
        [
          "kembali",
          "戻る",
          "back"
        ].includes(label.toLowerCase()) ||
        (
          href.includes(CONFIG.listPath) &&
          !href.includes(
            CONFIG.detailPathPart
          )
        )
      );
    }) || null;
  }

  function enhanceBackControl(element) {
    element.classList.add(
      "kv-job-back-button"
    );

    element.classList.remove(
      "underline"
    );

    if (
      element.dataset.kvJobBackEnhanced ===
      "true"
    ) {
      return;
    }

    const label = norm(
      element.innerText ||
      element.textContent
    ) || "Kembali";

    element.innerHTML = `
      ${icon("back")}
      <span class="kv-job-back-label"></span>
    `;

    element.querySelector(
      ".kv-job-back-label"
    ).textContent = label;

    element.dataset.kvJobBackEnhanced =
      "true";
  }

  // ============================================================
  // DETAIL NAVIGATION
  // ============================================================

  function goToDetail(action) {
    const card =
      findIndexCards().find(item =>
        item.contains(action)
      ) ||
      action.closest(
        "tr, article, li, .card, .kv-list-record"
      );

    if (!card) return;

    const link = [
      ...card.querySelectorAll("a[href]")
    ].find(anchor =>
      anchor.href.includes(
        CONFIG.detailPathPart
      ) ||
      /\/detail\//.test(anchor.href)
    );

    if (link) {
      location.assign(link.href);
      return;
    }

    const arrow = [
      ...card.querySelectorAll(
        "a, button, [role='button'], [onclick], [tabindex]"
      )
    ].find(element => {
      if (
        element.closest(
          ".kv-job-card-actions"
        )
      ) {
        return false;
      }

      const text = norm(
        element.textContent
      );

      return (
        !text ||
        /detail|詳細|›|»|＞/i.test(text)
      );
    });

    if (arrow) {
      arrow.click();
    } else {
      card.click();
    }
  }

  // ============================================================
  // PDF DOWNLOAD
  // ============================================================

  function extractUrls(text) {
    return (
      norm(text).match(
        /https?:\/\/[^\s"'<>]+/gi
      ) || []
    );
  }

  function isDriveUrl(url) {
    try {
      const host = new URL(
        url
      ).hostname.toLowerCase();

      return [
        "drive.google.com",
        "docs.google.com",
        "drive.usercontent.google.com"
      ].includes(host);
    } catch {
      return false;
    }
  }

  function findPdfUrl(root) {
    const field = fieldByCode(
      root,
      CONFIG.pdfUrlFieldCode
    );

    if (!field) return "";

    const urls = [
      ...field.querySelectorAll("a[href]")
    ].map(anchor => anchor.href);

    urls.push(
      ...extractUrls(
        getFieldText(field)
      )
    );

    return urls.find(isDriveUrl) || "";
  }

  function downloadPdf(rawUrl) {
    if (!isDriveUrl(rawUrl)) return;

    const fileId =
      (
        rawUrl.match(
          /\/file\/d\/([^/]+)/
        ) || []
      )[1] ||
      (
        rawUrl.match(
          /[?&]id=([^&]+)/
        ) || []
      )[1];

    const url = fileId
      ? (
          "https://drive.google.com/uc?export=download&id=" +
          encodeURIComponent(fileId)
        )
      : rawUrl;

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.download = "";

    document.body.appendChild(anchor);

    anchor.click();
    anchor.remove();
  }

  // ============================================================
  // SVG ICONS
  // ============================================================

  function icon(name) {
    const paths = {
      detail:
        '<path d="M2.1 12s3.5-7 9.9-7 9.9 7 9.9 7-3.5 7-9.9 7-9.9-7-9.9-7Z"/><circle cx="12" cy="12" r="3"/>',

      send:
        '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',

      download:
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',

      back:
        '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',

      close:
        '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',

      copy:
        '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'
    };

    return `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        ${paths[name] || ""}
      </svg>
    `;
  }

  // ============================================================
  // CREATE BUTTONS
  // ============================================================

  function createButton(
    label,
    variant,
    iconName
  ) {
    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      `kv-job-button kv-job-button-${variant}`;

    button.innerHTML = `
      <span class="kv-job-button-content">
        ${icon(iconName)}
        <span class="kv-job-button-label"></span>
      </span>
    `;

    button.querySelector(
      ".kv-job-button-label"
    ).textContent = label;

    return button;
  }

  // ============================================================
  // REGISTRATION URL
  // ============================================================
  //
  // WhatsApp:
  // https://wa.me/6285258363076?text=JOB-2026-0097
  //
  // Telegram:
  // https://t.me/actjob_id_bot?text=JOB-2026-0097
  //
  // Telegram tidak lagi menggunakan ?start=JOB-...
  // agar Job Code tidak menjadi perintah /start.
  //
  // ============================================================

  function registrationUrl(
    channel,
    jobCode
  ) {
    const base =
      channel === "telegram"
        ? CONFIG.telegramBotUrl
        : CONFIG.whatsappBaseUrl;

    const url = new URL(base);

    url.searchParams.delete("start");
    url.searchParams.delete("startgroup");

    url.searchParams.set(
      "text",
      jobCode
    );

    return url.href;
  }

  // ============================================================
  // DYNAMIC MODAL INSTRUCTIONS
  // ============================================================
  //
  // Instruksi dipisah menjadi:
  // - Telegram only
  // - WhatsApp only
  // - Both
  //
  // Tidak ada teks WhatsApp dalam mode Telegram only.
  // Tidak ada teks Telegram dalam mode WhatsApp only.
  //
  // ============================================================

  function instructions(mode) {
    const opening =
      "Periksa kembali detail lowongan, terutama persyaratan pelamar, lokasi kerja, dan informasi gaji.";

    const closing =
      "Tunggu balasan dari tim kami, kemudian ikuti petunjuk pendaftaran selanjutnya.";

    const telegramSteps = [
      "Klik tombol DAFTAR KE TELEGRAM untuk membuka bot pendaftaran.",

      "Jika muncul tombol START/MULAI, klik tombol tersebut terlebih dahulu. Setelah itu, kirim Job Code yang sudah otomatis terisi di kolom pesan.",

      "Jika Job Code belum terisi otomatis, kembali ke halaman ini dan klik tombol DAFTAR KE TELEGRAM sekali lagi.",

      "Jika masih belum terisi, klik Job Code di bawah untuk menyalinnya. Kemudian tempel dan kirimkan kode tersebut secara manual tanpa menambahkan teks lain."
    ];

    const whatsappSteps = [
      "Klik tombol DAFTAR KE WHATSAPP untuk membuka chat pendaftaran.",

      "WhatsApp akan terbuka dengan Job Code yang sudah terisi otomatis di kolom pesan.",

      "Tekan tombol Kirim tanpa mengubah kode atau menambahkan teks lain."
    ];

    // Mode Telegram ONLY
    if (mode === "telegram") {
      return [
        opening,
        ...telegramSteps,
        closing
      ];
    }

    // Mode WhatsApp ONLY
    if (mode === "whatsapp") {
      return [
        opening,
        ...whatsappSteps,
        closing
      ];
    }

    // Mode BOTH
    return [
      opening,

      "Pilih salah satu metode pendaftaran yang tersedia: Telegram atau WhatsApp.",

      "Jika memilih Telegram: buka bot pendaftaran. Jika muncul tombol START/MULAI, klik terlebih dahulu, lalu kirim Job Code yang sudah terisi otomatis di kolom pesan.",

      "Jika Job Code di Telegram belum terisi, kembali ke halaman ini dan klik DAFTAR KE TELEGRAM sekali lagi. Jika masih kosong, salin Job Code di bawah, lalu tempel dan kirimkan secara manual.",

      "Jika memilih WhatsApp: chat akan terbuka dengan Job Code yang sudah terisi otomatis. Tekan Kirim tanpa menambahkan teks lain.",

      closing
    ];
  }

  // ============================================================
  // APPLY MODAL
  // ============================================================

  function openApplyModal(
    code,
    trigger
  ) {
    const jobCode = makeJobCode(code);

    if (!jobCode) {
      log("Invalid Job Code:", code);
      return;
    }

    closeApplyModal(true);

    const mode = getRegistrationMode();
    const channels = registrationChannels();

    // Overlay
    const overlay =
      document.createElement("div");

    overlay.id = IDS.modal;
    overlay.className =
      "kv-job-modal-overlay";

    overlay.setAttribute(
      "role",
      "dialog"
    );

    overlay.setAttribute(
      "aria-modal",
      "true"
    );

    overlay.setAttribute(
      "aria-labelledby",
      "kv-job-modal-title"
    );

    // Dialog
    const dialog =
      document.createElement("div");

    dialog.className =
      "kv-job-modal-dialog";

    // Close
    const close =
      document.createElement("button");

    close.type = "button";
    close.className =
      "kv-job-modal-close";

    close.setAttribute(
      "aria-label",
      "Tutup modal"
    );

    close.innerHTML = icon("close");

    close.addEventListener(
      "click",
      () => closeApplyModal()
    );

    // Title
    const title =
      document.createElement("h2");

    title.id = "kv-job-modal-title";
    title.textContent =
      "Konfirmasi Pendaftaran";

    // Introduction
    const intro =
      document.createElement("p");

    intro.className =
      "kv-job-modal-text";

    intro.textContent =
      "Sebelum mendaftar, pastikan lowongan ini sesuai dengan minat dan Kamu sudah memenuhi persyaratan atau kriteria yang diminta.";

    // Instruction heading
    const heading =
      document.createElement("div");

    heading.className =
      "kv-job-step-title";

    if (mode === "telegram") {
      heading.textContent =
        "Langkah pendaftaran melalui Telegram";
    } else if (mode === "whatsapp") {
      heading.textContent =
        "Langkah pendaftaran melalui WhatsApp";
    } else {
      heading.textContent =
        "Langkah pendaftaran";
    }

    // Instruction list
    const ol =
      document.createElement("ol");

    ol.className =
      "kv-job-step-list";

    instructions(mode).forEach(text => {
      const li =
        document.createElement("li");

      li.textContent = text;

      ol.appendChild(li);
    });

    // Job Code label
    const label =
      document.createElement("div");

    label.className =
      "kv-job-code-label";

    label.textContent =
      "Job Code";

    // Copy button
    const codeButton =
      document.createElement("button");

    codeButton.type = "button";

    codeButton.className =
      "kv-job-code-copy";

    codeButton.innerHTML = `
      <span class="kv-job-code-value"></span>
      <span class="kv-job-code-status">
        <span class="kv-job-code-status-text">
          Klik untuk salin kode
        </span>
        ${icon("copy")}
      </span>
    `;

    codeButton.querySelector(
      ".kv-job-code-value"
    ).textContent = jobCode;

    codeButton.addEventListener(
      "click",
      () => copyJobCode(
        jobCode,
        codeButton
      )
    );

    // Modal actions
    const actions =
      document.createElement("div");

    actions.className =
      "kv-job-modal-actions";

    // DETAIL button for index
    if (!isDetailPage()) {
      const detail = createButton(
        "DETAIL",
        "secondary",
        "detail"
      );

      detail.addEventListener(
        "click",
        () => {
          closeApplyModal();

          if (trigger) {
            setTimeout(
              () => goToDetail(trigger),
              190
            );
          }
        }
      );

      actions.appendChild(detail);
    } else {
      actions.classList.add(
        "kv-job-modal-actions-single"
      );
    }

    // Channel container
    const channelActions =
      document.createElement("div");

    channelActions.className =
      "kv-job-modal-channels";

    if (channels.length > 1) {
      actions.classList.add(
        "kv-job-modal-actions-multi"
      );

      channelActions.classList.add(
        "kv-job-modal-channels-multi"
      );
    }

    // Registration buttons
    const buttons = channels.map(channel => {
      const anchor =
        document.createElement("a");

      anchor.className = [
        "kv-job-registration-button",
        `kv-job-${channel}-button`,
        "kv-job-registration-disabled"
      ].join(" ");

      anchor.href = "#";

      anchor.setAttribute(
        "aria-disabled",
        "true"
      );

      anchor.textContent =
        `DAFTAR KE ${channel.toUpperCase()}`;

      anchor.addEventListener(
        "click",
        event => {
          if (
            anchor.getAttribute(
              "aria-disabled"
            ) === "true"
          ) {
            event.preventDefault();
          }
        }
      );

      channelActions.appendChild(anchor);

      return {
        channel,
        anchor
      };
    });

    actions.appendChild(
      channelActions
    );

    dialog.append(
      close,
      title,
      intro,
      heading,
      ol,
      label,
      codeButton,
      actions
    );

    overlay.appendChild(dialog);

    document.body.appendChild(
      overlay
    );

    document.body.classList.add(
      "kv-job-modal-open"
    );

    overlay.addEventListener(
      "click",
      event => {
        if (event.target === overlay) {
          closeApplyModal();
        }
      }
    );

    document.addEventListener(
      "keydown",
      onEscape
    );

    startCountdown(
      buttons,
      jobCode
    );

    requestAnimationFrame(() => {
      if (!overlay.isConnected) {
        return;
      }

      overlay.classList.add(
        "kv-job-modal-visible"
      );

      close.focus();
    });
  }

  // ============================================================
  // REGISTRATION COUNTDOWN
  // ============================================================

  function startCountdown(
    buttons,
    code
  ) {
    clearInterval(
      state.countdownTimer
    );

    const seconds = Math.max(
      0,
      Number(
        CONFIG.registrationDelaySeconds
      ) || 0
    );

    const readyAt =
      Date.now() +
      Math.ceil(seconds * 1000);

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (readyAt - Date.now()) / 1000
        )
      );

      buttons.forEach(({
        channel,
        anchor
      }) => {
        anchor.textContent =
          `DAFTAR KE ${channel.toUpperCase()}` +
          (
            remaining
              ? ` (${remaining})`
              : ""
          );

        if (remaining) return;

        anchor.href = registrationUrl(
          channel,
          code
        );

        anchor.target = "_blank";

        anchor.rel =
          "noopener noreferrer";

        anchor.setAttribute(
          "aria-disabled",
          "false"
        );

        anchor.classList.remove(
          "kv-job-registration-disabled"
        );
      });

      if (!remaining) {
        clearInterval(
          state.countdownTimer
        );

        state.countdownTimer = null;
      }
    };

    update();

    if (seconds > 0) {
      state.countdownTimer = setInterval(
        update,
        250
      );
    }
  }

  // ============================================================
  // CLOSE MODAL
  // ============================================================

  function onEscape(event) {
    if (event.key === "Escape") {
      closeApplyModal();
    }
  }

  function closeApplyModal(
    immediately = false
  ) {
    clearInterval(
      state.countdownTimer
    );

    state.countdownTimer = null;

    const modal =
      document.getElementById(
        IDS.modal
      );

    if (modal) {
      if (immediately) {
        modal.remove();
      } else {
        modal.classList.remove(
          "kv-job-modal-visible"
        );

        setTimeout(
          () => modal.remove(),
          180
        );
      }
    }

    document.body?.classList.remove(
      "kv-job-modal-open"
    );

    document.removeEventListener(
      "keydown",
      onEscape
    );
  }

  // ============================================================
  // COPY JOB CODE
  // ============================================================

  async function copyJobCode(
    code,
    button
  ) {
    let copied = false;

    try {
      await navigator.clipboard.writeText(
        code
      );

      copied = true;
    } catch {
      const input =
        document.createElement(
          "textarea"
        );

      input.value = code;

      input.style.position =
        "fixed";

      input.style.left =
        "-9999px";

      document.body.appendChild(input);

      input.select();

      try {
        copied =
          document.execCommand("copy");
      } catch {}

      input.remove();
    }

    button.classList.toggle(
      "kv-job-code-copied",
      copied
    );

    button.classList.toggle(
      "kv-job-code-copy-failed",
      !copied
    );

    const text = button.querySelector(
      ".kv-job-code-status-text"
    );

    if (text) {
      text.textContent = copied
        ? "Kode berhasil disalin"
        : "Gagal menyalin. Silakan salin manual.";
    }

    setTimeout(() => {
      if (!button.isConnected) return;

      button.classList.remove(
        "kv-job-code-copied",
        "kv-job-code-copy-failed"
      );

      if (text) {
        text.textContent =
          "Klik untuk salin kode";
      }
    }, 2400);
  }

  // ============================================================
  // IP RESTRICTION
  // ============================================================

  async function isAccessAllowed() {
    const cfg =
      CONFIG.ipRestriction;

    if (!cfg.enabled) {
      return true;
    }

    const ips = [];

    try {
      const urlIp = norm(
        new URLSearchParams(
          location.search
        ).get(cfg.overrideQueryParam)
      );

      if (urlIp) {
        localStorage.setItem(
          cfg.overrideLocalStorageKey,
          urlIp
        );
      }

      const override =
        urlIp ||
        norm(
          localStorage.getItem(
            cfg.overrideLocalStorageKey
          )
        );

      if (override) {
        ips.push(override);
      }
    } catch {}

    await Promise.all(
      cfg.publicIpUrls.map(async url => {
        const controller =
          new AbortController();

        const timeout = setTimeout(
          () => controller.abort(),
          cfg.timeoutMs
        );

        try {
          const response = await fetch(
            url,
            {
              signal: controller.signal,
              cache: "no-store"
            }
          );

          if (!response.ok) return;

          const text = response.headers
            .get("content-type")
            ?.includes("json")
              ? (await response.json()).ip
              : await response.text();

          ips.push(norm(text));
        } catch (error) {
          log(
            "IP lookup error:",
            error
          );
        } finally {
          clearTimeout(timeout);
        }
      })
    );

    ips.push(
      ...await getLocalIpsViaWebRtc(
        cfg.timeoutMs
      )
    );

    const unique = [
      ...new Set(
        ips.filter(ip =>
          /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)
        )
      )
    ];

    const allowed =
      unique.some(ip =>
        cfg.allowedIps.includes(ip)
      ) ||
      (
        !unique.length &&
        cfg.allowWhenUnknown
      );

    if (!allowed) {
      log(
        "Access denied: IP not allowed",
        unique
      );
    }

    return allowed;
  }

  function getLocalIpsViaWebRtc(timeoutMs) {
    return new Promise(resolve => {
      const Peer =
        window.RTCPeerConnection ||
        window.webkitRTCPeerConnection;

      if (!Peer) {
        resolve([]);
        return;
      }

      const ips = new Set();

      let peer;
      let done = false;

      const finish = () => {
        if (done) return;

        done = true;

        clearTimeout(timer);

        try {
          peer?.close();
        } catch {}

        resolve([...ips]);
      };

      const collect = value => {
        const matches = String(
          value || ""
        ).match(
          /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
        ) || [];

        for (const match of matches) {
          if (
            match.split(".").every(
              n => Number(n) <= 255
            )
          ) {
            ips.add(match);
          }
        }
      };

      const timer = setTimeout(
        finish,
        timeoutMs
      );

      try {
        peer = new Peer({
          iceServers: []
        });

        peer.createDataChannel(
          "kv-ip-check"
        );

        peer.onicecandidate = event => {
          if (event.candidate) {
            collect(
              event.candidate.candidate
            );
          } else {
            finish();
          }
        };

        peer.createOffer()
          .then(offer => {
            collect(offer.sdp);

            return peer.setLocalDescription(
              offer
            );
          })
          .catch(finish);
      } catch {
        finish();
      }
    });
  }

  // ============================================================
  // CSS
  // ============================================================

  function installStyles() {
    let style =
      document.getElementById(
        IDS.style
      );

    if (!style) {
      style =
        document.createElement("style");

      style.id = IDS.style;

      document.head.appendChild(style);
    }

    style.textContent = `
      /* INDEX PAGE */

      .kv-job-card-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 16px 0 0 !important;
        padding: 14px 4px 16px !important;
        border-top: 1px solid #e5e7eb;
      }

      .kv-job-list-action-dd {
        display: block !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      .kv-job-mobile-list-table,
      .kv-job-mobile-list-body {
        display: block !important;
        width: 100% !important;
        border-collapse: separate !important;
        border-spacing: 0 12px !important;
      }

      tr.kv-job-list-card-mobile-enhanced {
        display: block !important;
        width: calc(100% - 20px) !important;
        margin: 10px 10px 16px !important;
        border: 1px solid #dbeafe !important;
        border-radius: 6px !important;
        background: white !important;
        overflow: hidden !important;
      }

      tr.kv-job-list-card-mobile-enhanced > td:first-child {
        display: block !important;
        width: 100% !important;
        border: 0 !important;
        box-sizing: border-box !important;
      }

      tr.kv-job-list-card-mobile-enhanced > td:first-child dl {
        padding: 14px 10px 0 !important;
      }

      tr.kv-job-list-card-mobile-enhanced > td:not(:first-child),
      .kv-job-native-arrow-hidden,
      .kv-job-empty-field-hidden,
      .kv-job-pdf-url-field-hidden {
        display: none !important;
      }

      .kv-job-table-action-cell {
        min-width: 190px;
        padding: 8px;
        vertical-align: middle;
        border: 1px solid #e5e7eb;
        background: white;
      }

      .kv-job-table-action-cell > .kv-job-card-actions {
        grid-template-columns: 1fr;
        gap: 8px;
        margin: 0 !important;
        padding: 0 !important;
        border: 0;
      }

      /* BASE BUTTONS */

      .kv-job-button {
        appearance: none;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        min-height: 42px;
        padding: 10px 12px;
        font-size: 13px;
        font-weight: 800;
        line-height: 1;
        cursor: pointer;
        transition:
          background .12s,
          border-color .12s,
          transform .12s;
      }

      .kv-job-button-content,
      .kv-job-back-button {
        display: inline-flex !important;
        justify-content: center;
        align-items: center;
        gap: 7px;
        min-width: 0;
      }

      .kv-job-button-label,
      .kv-job-back-label {
        white-space: nowrap;
      }

      .kv-job-button svg,
      .kv-job-back-button svg {
        flex-shrink: 0;
      }

      .kv-job-button-primary {
        background: #0079d2;
        border-color: #0079d2;
        color: #ffffff;
      }

      .kv-job-button-primary:hover {
        background: #006bb9;
        border-color: #006bb9;
      }

      .kv-job-button-secondary {
        background: #ffffff;
        border-color: #cbd5e1;
        color: #111827;
      }

      .kv-job-button-secondary:hover {
        background: #eff6ff;
        color: #005ea8;
      }

      .kv-job-button:focus-visible,
      .kv-job-back-button:focus-visible,
      .kv-job-code-copy:focus-visible,
      .kv-job-modal-close:focus-visible,
      .kv-job-registration-button:focus-visible {
        outline: 3px solid rgba(37,99,235,.38);
        outline-offset: 2px;
      }

      /* DETAIL TOOLBAR */

      .kv-job-detail-toolbar {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: 12px;
        width: 100%;
        margin: 0;
        overflow: visible !important;
      }

      .kv-job-detail-toolbar > *:first-child {
        margin: 0 !important;
      }

      .kv-job-back-button {
        min-height: 42px;
        padding: 10px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        background: #ffffff;
        color: #0079d2 !important;
        font-size: 13px;
        font-weight: 800;
        text-decoration: none !important;
        box-sizing: border-box;
      }

      .kv-job-back-button:hover {
        background: #eff6ff;
        border-color: #0079d2;
      }

      .kv-job-detail-toolbar .kv-job-button {
        min-width: 118px;
        margin-left: 0;
      }

      .kv-job-detail-toolbar
        .kv-job-back-button ~ .kv-job-button-primary {
        margin-left: auto;
      }

      .kv-job-detail-toolbar
        .kv-job-download-pdf-button {
        min-width: 148px;
        margin-left: auto;
      }

      .kv-job-detail-toolbar
        .kv-job-download-pdf-button + .kv-job-button {
        margin-left: 0;
      }

      @media (max-width: 520px) {
        .kv-job-detail-toolbar {
          display: grid !important;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .kv-job-detail-toolbar.kv-job-detail-toolbar-has-pdf {
          grid-template-columns:
            minmax(90px, .82fr)
            minmax(150px, 1.35fr);
        }

        .kv-job-detail-toolbar.kv-job-detail-toolbar-has-pdf
          .kv-job-button-primary {
          grid-column: 1 / -1;
        }

        .kv-job-detail-toolbar .kv-job-back-button,
        .kv-job-detail-toolbar .kv-job-button {
          width: 100%;
          min-width: 0;
          min-height: 44px;
          padding: 10px 8px;
          font-size: 12px;
        }

        .kv-job-detail-toolbar
          .kv-job-back-button ~ .kv-job-button-primary,
        .kv-job-detail-toolbar
          .kv-job-download-pdf-button,
        .kv-job-detail-toolbar
          .kv-job-download-pdf-button + .kv-job-button {
          margin-left: 0;
        }
      }

      /* MODAL */

      .kv-job-modal-open {
        overflow: hidden;
      }

      .kv-job-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        background: rgba(15,23,42,0);
        opacity: 0;
        transition:
          opacity .18s,
          background .18s;
      }

      .kv-job-modal-visible {
        background: rgba(15,23,42,.58);
        opacity: 1;
      }

      .kv-job-modal-dialog {
        position: relative;
        width: min(100%, 460px);
        max-height: calc(100vh - 36px);
        overflow-y: auto;
        border-radius: 8px;
        background: #ffffff;
        color: #111827;
        box-shadow:
          0 24px 80px rgba(17,24,39,.24);
        padding: 24px 20px 20px;
        transform:
          translateY(12px) scale(.98);
        transition: transform .18s;
      }

      .kv-job-modal-visible .kv-job-modal-dialog {
        transform:
          translateY(0) scale(1);
      }

      .kv-job-modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: #ffffff;
        color: #374151;
        cursor: pointer;
      }

      .kv-job-modal-close:hover {
        background: #f3f4f6;
      }

      .kv-job-modal-dialog h2 {
        margin: 0 38px 14px 0;
        font-size: 20px;
        font-weight: 800;
        line-height: 1.25;
      }

      .kv-job-modal-text {
        margin: 0 0 12px;
        color: #374151;
        font-size: 14px;
        line-height: 1.6;
      }

      /* INSTRUCTIONS */

      .kv-job-step-title {
        margin: 16px 0 8px;
        font-size: 13px;
        font-weight: 900;
      }

      .kv-job-step-list {
        margin: 0 0 16px;
        padding-left: 24px;
        color: #374151;
        font-size: 14px;
        line-height: 1.55;
        list-style: decimal !important;
      }

      .kv-job-step-list li {
        display: list-item !important;
        list-style: decimal !important;
        margin-bottom: 7px;
        padding-left: 4px;
      }

      /* JOB CODE */

      .kv-job-code-label {
        margin: 18px 0 4px;
        font-size: 12px;
        font-weight: 900;
        color: #6b7280;
        text-transform: uppercase;
      }

      .kv-job-code-copy {
        display: grid;
        grid-template-columns: 1fr;
        justify-items: center;
        gap: 10px;
        width: 100%;
        border: 1px dashed #0079d2;
        border-radius: 6px;
        background: #eff6ff;
        color: #0f172a;
        padding: 14px;
        font-size: 19px;
        font-weight: 900;
        cursor: pointer;
        overflow-wrap: anywhere;
        text-align: center;
      }

      .kv-job-code-copy:hover {
        background: #dbeafe;
      }

      .kv-job-code-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        border-radius: 999px;
        background: #ffffff;
        color: #0079d2;
        padding: 4px 9px;
        font-size: 12px;
        font-weight: 800;
      }

      .kv-job-code-status svg {
        width: 15px;
        height: 15px;
      }

      .kv-job-code-copied {
        border-color: #16a34a;
        background: #ecfdf5;
        color: #14532d;
      }

      .kv-job-code-copied
        .kv-job-code-status {
        background: #16a34a;
        color: #ffffff;
      }

      .kv-job-code-copy-failed {
        border-color: #dc2626;
        background: #fef2f2;
        color: #7f1d1d;
      }

      .kv-job-code-copy-failed
        .kv-job-code-status {
        background: #dc2626;
        color: #ffffff;
      }

      /* ACTIONS */

      .kv-job-modal-actions {
        display: grid;
        grid-template-columns:
          minmax(110px, .62fr)
          minmax(0, 1.38fr);
        gap: 10px;
        margin-top: 16px;
      }

      .kv-job-modal-actions-single,
      .kv-job-modal-actions-multi {
        grid-template-columns: 1fr;
      }

      .kv-job-modal-channels {
        display: grid;
        grid-template-columns: 1fr;
        gap: 10px;
        min-width: 0;
      }

      .kv-job-modal-channels-multi {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }

      .kv-job-registration-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 46px;
        border-radius: 6px;
        padding: 10px 8px;
        box-sizing: border-box;
        color: #ffffff !important;
        font-size: 13px;
        font-weight: 900;
        text-align: center;
        text-decoration: none !important;
        overflow-wrap: anywhere;
        line-height: 1.3;
      }

      .kv-job-modal-actions
        .kv-job-button {
        min-height: 46px;
      }

      /* WHATSAPP */

      .kv-job-whatsapp-button {
        background: #0079d2;
      }

      .kv-job-whatsapp-button:hover {
        background: #006bb9;
      }

      /* TELEGRAM */

      .kv-job-telegram-button {
        background: #229ed9;
      }

      .kv-job-telegram-button:hover {
        background: #1686c0;
      }

      /* DISABLED */

      .kv-job-registration-disabled,
      .kv-job-registration-disabled:hover {
        pointer-events: none;
        background: #9ca3af;
        color: #ffffff !important;
        cursor: not-allowed;
      }

      @media (max-width: 360px) {
        .kv-job-modal-channels-multi {
          grid-template-columns: 1fr;
        }
      }
    `;
  }

})();
