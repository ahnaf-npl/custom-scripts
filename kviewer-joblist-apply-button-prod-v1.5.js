
/**
 * ============================================================
 * KViewer Job Apply Buttons v1.5.0
 * ============================================================
 *
 * Features:
 * - DETAIL dan DAFTAR pada halaman daftar lowongan
 * - DAFTAR pada halaman detail
 * - Download PDF dari Google Drive
 * - Job Code otomatis: JOB- + 求人票ID
 * - Copy Job Code
 * - Pendaftaran melalui WhatsApp / Telegram / keduanya
 * - Instruksi modal dinamis sesuai channel
 * - Telegram deep link menggunakan parameter /start
 * - Countdown sebelum tombol pendaftaran aktif
 * - Responsive desktop dan mobile
 * - Optional IP restriction
 * - Tidak mengubah data Kintone
 */

(function () {
  "use strict";

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    name: "KViewer Job Apply Buttons",
    version: "1.5.0",
    debug: false,

    host: "e-bridge-id.viewer.kintoneapp.com",
    listPath: "/public/sswjoblist",
    detailPathPart: "/public/sswjoblist/detail/",

    jobIdFieldCode: "求人票ID",
    jobIdLabels: ["求人票ID", "Job ID", "Job Id", "JOB ID"],
    jobPrefix: "JOB-",
    pdfUrlFieldCode: "job_detail_url_idn",

    // ========================================================
    // REGISTRATION SETTINGS
    // ========================================================
    // "whatsapp" = hanya WhatsApp
    // "telegram" = hanya Telegram
    // "both"     = WhatsApp dan Telegram

    registrationMode: "both",

    // Delay tombol pendaftaran dalam detik
    registrationDelaySeconds: 5,

    // WhatsApp destination
    whatsappBaseUrl: "https://wa.me/6285258363076",

    // Telegram bot destination
    telegramBotUrl: "https://t.me/actjob_id_bot",

    // ========================================================
    // DETAIL PAGE SETTINGS
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
      allowedIps: [""],
      allowWhenUnknown: false,
      overrideQueryParam: "kv_test_ip",
      overrideLocalStorageKey: "kv_test_ip",
      publicIpUrls: [
        "https://api.ipify.org?format=json",
        "https://ipinfo.io/ip",
      ],
      timeoutMs: 2500,
    },

    mutationDelay: 150,
    periodicDelay: 0,
  };

  // ============================================================
  // CONSTANTS & STATE
  // ============================================================

  const IDS = {
    style: "kv-job-apply-style",
    modal: "kv-job-apply-modal",
  };

  const INSTANCE_KEY = "__kvJobApplyButtonsInstance";

  const ATTR = {
    cardEnhanced: "data-kv-job-card-enhanced",
    detailEnhanced: "data-kv-job-detail-enhanced",
  };

  const state = {
    accessAllowed: false,
    accessReason: "checking",
    accessIps: [],
    observer: null,
    renderTimer: null,
    intervalId: null,
    modalCountdownTimer: null,
    clickGuard: null,
  };

  if (location.hostname !== CONFIG.host) return;

  // Prevent multiple instances
  if (
    window[INSTANCE_KEY] &&
    typeof window[INSTANCE_KEY].destroy === "function"
  ) {
    window[INSTANCE_KEY].destroy();
  }

  window[INSTANCE_KEY] = {
    destroy() {
      clearTimeout(state.renderTimer);
      clearInterval(state.intervalId);
      clearInterval(state.modalCountdownTimer);

      if (state.observer) state.observer.disconnect();

      document.removeEventListener("keydown", closeOnEscape);

      if (state.clickGuard) {
        document.removeEventListener(
          "click",
          state.clickGuard,
          true
        );
      }

      document.getElementById(IDS.modal)?.remove();
      document.body?.classList.remove("kv-job-modal-open");
    },
  };

  boot();

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async function boot() {
    installStyles();

    state.accessAllowed = await checkAccess();

    if (!state.accessAllowed) {
      log("IP tidak diizinkan.", {
        allowedIps: CONFIG.ipRestriction.allowedIps,
        detectedIps: state.accessIps,
        reason: state.accessReason,
      });
      return;
    }

    log("Script aktif.", {
      version: CONFIG.version,
      registrationMode: CONFIG.registrationMode,
    });

    installObserver();
    installGlobalClickGuard();
    scheduleRender("boot");

    if (CONFIG.periodicDelay > 0) {
      state.intervalId = setInterval(
        () => scheduleRender("periodic"),
        CONFIG.periodicDelay
      );
    }
  }

  function isIndexPage() {
    return (
      location.pathname.replace(/\/+$/, "") ===
        CONFIG.listPath &&
      !isDetailPage()
    );
  }

  function isDetailPage() {
    return location.pathname.includes(CONFIG.detailPathPart);
  }

  function log(...args) {
    if (!CONFIG.debug) return;

    console.log(
      `%c[${CONFIG.name}]`,
      "background:#0079d2;color:#fff;font-weight:700;padding:2px 7px;border-radius:4px",
      ...args
    );
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function unique(values) {
    return [
      ...new Set(values.map(normalizeText).filter(Boolean))
    ];
  }

  // ============================================================
  // IP RESTRICTION
  // ============================================================

  async function checkAccess() {
    if (!CONFIG.ipRestriction.enabled) {
      state.accessReason = "ip-check-disabled";
      return true;
    }

    const overrideIp = getOverrideIp();
    const detectedIps = [];

    if (overrideIp) detectedIps.push(overrideIp);

    detectedIps.push(...await getPublicIps());
    detectedIps.push(...await getLocalIpsViaWebRtc());

    state.accessIps = unique(detectedIps);

    const allowed = state.accessIps.some(ip =>
      CONFIG.ipRestriction.allowedIps.includes(ip)
    );

    if (allowed) {
      state.accessReason = overrideIp
        ? "override-ip-match"
        : "ip-match";
      return true;
    }

    if (
      !state.accessIps.length &&
      CONFIG.ipRestriction.allowWhenUnknown
    ) {
      state.accessReason = "ip-unknown-allowed";
      return true;
    }

    state.accessReason = state.accessIps.length
      ? "ip-not-allowed"
      : "ip-unknown-blocked";

    return false;
  }

  function getOverrideIp() {
    const params = new URLSearchParams(location.search);

    const fromUrl = normalizeText(
      params.get(CONFIG.ipRestriction.overrideQueryParam)
    );

    if (fromUrl) {
      try {
        localStorage.setItem(
          CONFIG.ipRestriction.overrideLocalStorageKey,
          fromUrl
        );
      } catch (error) {
        log("IP override storage error.", error);
      }

      return fromUrl;
    }

    try {
      return normalizeText(
        localStorage.getItem(
          CONFIG.ipRestriction.overrideLocalStorageKey
        )
      );
    } catch {
      return "";
    }
  }

  async function getPublicIps() {
    const results = [];

    await Promise.all(
      CONFIG.ipRestriction.publicIpUrls.map(async url => {
        try {
          const response = await fetchWithTimeout(
            url,
            CONFIG.ipRestriction.timeoutMs
          );

          if (!response.ok) return;

          const contentType =
            response.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            const data = await response.json();
            results.push(data.ip);
          } else {
            results.push(await response.text());
          }
        } catch (error) {
          log("Public IP check failed.", url, error);
        }
      })
    );

    return results
      .map(value =>
        normalizeText(value).replace(/^"|"$/g, "")
      )
      .filter(isIpAddress);
  }

  function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    return fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => clearTimeout(timer));
  }

  function getLocalIpsViaWebRtc() {
    return new Promise(resolve => {
      const PeerConnection =
        window.RTCPeerConnection ||
        window.webkitRTCPeerConnection ||
        window.mozRTCPeerConnection;

      if (!PeerConnection) {
        resolve([]);
        return;
      }

      const ips = new Set();
      let peer;
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;

        clearTimeout(timeout);

        try {
          peer?.close();
        } catch {}

        resolve([...ips]);
      };

      const collect = text => {
        const matches = String(text || "").match(
          /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
        );

        (matches || []).forEach(ip => {
          if (isIpAddress(ip)) ips.add(ip);
        });
      };

      const timeout = setTimeout(
        finish,
        CONFIG.ipRestriction.timeoutMs
      );

      try {
        peer = new PeerConnection({ iceServers: [] });
        peer.createDataChannel("kv-ip-check");

        peer.onicecandidate = event => {
          if (event.candidate) {
            collect(event.candidate.candidate);
          } else {
            finish();
          }
        };

        peer.createOffer()
          .then(offer => {
            collect(offer.sdp);
            return peer.setLocalDescription(offer);
          })
          .catch(finish);
      } catch {
        finish();
      }
    });
  }

  function isIpAddress(value) {
    const text = normalizeText(value);

    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(text)) {
      return false;
    }

    return text.split(".").every(part => {
      const number = Number(part);
      return Number.isInteger(number) &&
        number >= 0 &&
        number <= 255;
    });
  }

  // ============================================================
  // OBSERVER & RENDER
  // ============================================================

  function installObserver() {
    if (!document.body) {
      setTimeout(installObserver, 100);
      return;
    }

    state.observer = new MutationObserver(
      () => scheduleRender("mutation")
    );

    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function scheduleRender(reason) {
    clearTimeout(state.renderTimer);

    state.renderTimer = setTimeout(
      () => render(reason),
      CONFIG.mutationDelay
    );
  }

  function render(reason) {
    if (!document.body) return;

    if (isDetailPage()) {
      cleanupMisplacedDetailButtons();
      enhanceDetailPage();
    } else if (isIndexPage()) {
      enhanceIndexPage();
    }

    if (reason === "boot") {
      log("Render initialized.");
    }
  }

  function installGlobalClickGuard() {
    if (state.clickGuard) return;

    state.clickGuard = event => {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const action = target.closest(
        "[data-kv-job-action]"
      );

      if (!action) return;

      const type = action.getAttribute(
        "data-kv-job-action"
      );

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      switch (type) {
        case "detail":
          goToDetail(action);
          break;

        case "apply":
          openApplyModal(
            action.getAttribute("data-kv-job-code") || "",
            action
          );
          break;

        case "download-pdf":
          downloadPdf(
            action.getAttribute("data-kv-pdf-url") || ""
          );
          break;
      }
    };

    document.addEventListener(
      "click",
      state.clickGuard,
      true
    );
  }

  // ============================================================
  // INDEX PAGE
  // ============================================================

  function enhanceIndexPage() {
    const cards = findIndexCards();

    cards.forEach(card => {
      if (
        card.getAttribute(ATTR.cardEnhanced) === "true"
      ) {
        return;
      }

      const jobId = findJobIdInRoot(card);
      if (!jobId) return;

      applyJobCodeDisplay(card);

      const actionRow = document.createElement("div");
      actionRow.className = "kv-job-card-actions";

      const detailButton = createButton(
        "DETAIL",
        "secondary"
      );
      detailButton.dataset.kvJobAction = "detail";

      const applyButton = createButton(
        "DAFTAR",
        "primary"
      );
      applyButton.dataset.kvJobAction = "apply";
      applyButton.dataset.kvJobCode = makeJobCode(jobId);

      actionRow.append(
        detailButton,
        applyButton
      );

      const mount = findIndexActionMount(card);
      if (!mount) return;

      mount.appendChild(actionRow);
      hideNativeDetailArrow(card);

      if (
        mount.classList.contains("kv-job-list-action-dd")
      ) {
        card.classList.add(
          "kv-job-list-card-mobile-enhanced"
        );
        card.classList.remove(
          "kv-job-list-row-desktop-enhanced"
        );
      } else {
        card.classList.add(
          "kv-job-list-row-desktop-enhanced"
        );
        card.classList.remove(
          "kv-job-list-card-mobile-enhanced"
        );
      }

      card.setAttribute(ATTR.cardEnhanced, "true");
    });
  }

  function findIndexCards() {
    const rows = Array.from(
      document.querySelectorAll("tr.kv-list-record")
    );

    if (rows.length) {
      return rows.filter(findJobIdInRoot);
    }

    const candidates = Array.from(
      document.querySelectorAll(
        "article, li, .card, [class*='card'], [class*='Card'], [class*='record'], [class*='Record']"
      )
    );

    const cards = candidates.filter(element => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.closest("#" + IDS.modal)) return false;
      if (!findJobIdInRoot(element)) return false;

      const rect = element.getBoundingClientRect();

      return rect.width > 160 &&
        rect.height > 120;
    });

    if (cards.length) {
      return cards.filter(card =>
        !cards.some(other =>
          other !== card && other.contains(card)
        )
      );
    }

    return Array.from(document.body.children)
      .filter(element =>
        element instanceof HTMLElement &&
        findJobIdInRoot(element)
      );
  }

  function findIndexActionMount(card) {
    if (!card.matches("tr.kv-list-record")) {
      return card;
    }

    const dl = card.querySelector(
      "td:first-child dl"
    );

    if (!dl) {
      let cell = card.querySelector(
        ":scope > td.kv-job-table-action-cell"
      );

      if (!cell) {
        cell = document.createElement("td");
        cell.className = "kv-job-table-action-cell";
        card.appendChild(cell);
      }

      return cell;
    }

    const table = card.closest("table");
    const tbody = card.closest("tbody");
    const firstCell = card.querySelector("td:first-child");

    table?.classList.add("kv-job-mobile-list-table");
    tbody?.classList.add("kv-job-mobile-list-body");
    firstCell?.classList.add("kv-job-mobile-list-cell");

    let actionItem = dl.querySelector(
      ".kv-job-list-action-dd"
    );

    if (!actionItem) {
      actionItem = document.createElement("dd");
      actionItem.className = "kv-job-list-action-dd";
      dl.appendChild(actionItem);
    }

    return actionItem;
  }

  function hideNativeDetailArrow(card) {
    if (!card.matches("tr.kv-list-record")) return;

    const cells = Array.from(card.children)
      .filter(child => child.tagName === "TD");

    const arrowCell = cells.find(cell => {
      const text = normalizeText(
        cell.innerText || cell.textContent
      );

      return (
        cell.querySelector("svg") &&
        !text &&
        !cell.getAttribute("data-field-code")
      );
    });

    arrowCell?.classList.add(
      "kv-job-native-arrow-hidden"
    );
  }

  // ============================================================
  // DETAIL PAGE
  // ============================================================

  function enhanceDetailPage() {
    const root = document.querySelector(".kv-detail");
    if (!root) return;

    cleanupLooseActionButtons(document.body);
    applyJobCodeDisplay(root);
    applyEmptyDetailFieldVisibility(root);
    hidePdfUrlField(root);

    const jobId = findJobIdInRoot(root);
    if (!jobId) return;

    const pdfUrl = findPdfDownloadUrl(root);
    const backElement = findBackElement(root);

    if (!backElement) return;

    enhanceBackControl(backElement);

    document.querySelectorAll(
      ".kv-job-detail-toolbar [data-kv-job-action='apply']"
    ).forEach((button, index) => {
      if (index > 0) button.remove();
    });

    const mount = backElement.parentElement;
    if (!mount) return;

    mount.classList.add("kv-job-detail-toolbar");
    mount.classList.toggle(
      "kv-job-detail-toolbar-has-pdf",
      Boolean(pdfUrl)
    );

    let applyButton = mount.querySelector(
      ":scope > [data-kv-job-action='apply']"
    );

    if (!applyButton) {
      applyButton = createButton(
        "DAFTAR",
        "primary"
      );
      mount.appendChild(applyButton);
    }

    applyButton.dataset.kvJobAction = "apply";
    applyButton.dataset.kvJobCode = makeJobCode(jobId);

    let pdfButton = mount.querySelector(
      ":scope > [data-kv-job-action='download-pdf']"
    );

    if (pdfUrl) {
      if (!pdfButton) {
        pdfButton = createButton(
          "DOWNLOAD PDF",
          "secondary",
          "download"
        );

        pdfButton.classList.add(
          "kv-job-download-pdf-button"
        );

        mount.insertBefore(pdfButton, applyButton);
      }

      pdfButton.dataset.kvJobAction = "download-pdf";
      pdfButton.dataset.kvPdfUrl = pdfUrl;
      pdfButton.hidden = false;
    } else {
      pdfButton?.remove();
    }

    document.body.setAttribute(
      ATTR.detailEnhanced,
      "true"
    );
  }

  function cleanupLooseActionButtons(root) {
    root.querySelectorAll(
      "[data-kv-job-action='detail'], [data-kv-job-action='apply']"
    ).forEach(button => {
      if (
        button.closest(".kv-job-detail-toolbar") ||
        button.closest("#" + IDS.modal)
      ) {
        return;
      }

      const wrapper = button.closest(
        ".kv-job-card-actions"
      );

      if (wrapper) wrapper.remove();
      else button.remove();
    });
  }

  function cleanupMisplacedDetailButtons() {
    document.querySelectorAll(
      "aside .kv-job-detail-toolbar"
    ).forEach(toolbar => {
      toolbar.querySelectorAll(
        "[data-kv-job-action='apply']"
      ).forEach(button => button.remove());

      toolbar.classList.remove(
        "kv-job-detail-toolbar"
      );
    });
  }

  function applyEmptyDetailFieldVisibility(root) {
    const settings = CONFIG.detailFields;

    const neverHideTypes = new Set(
      settings.neverHideFieldTypes || []
    );

    const neverHideCodes = new Set(
      settings.neverHideFieldCodes || []
    );

    root.querySelectorAll(
      ".kv-detail-field"
    ).forEach(field => {
      const type = normalizeText(
        field.getAttribute("data-field-type")
      );

      const code = normalizeText(
        field.getAttribute("data-field-code")
      );

      const shouldHide =
        settings.hideEmptyFields &&
        !neverHideTypes.has(type) &&
        !neverHideCodes.has(code) &&
        !field.querySelector("[data-kv-job-action]") &&
        isEmptyDetailField(field);

      field.classList.toggle(
        "kv-job-empty-field-hidden",
        shouldHide
      );

      if (shouldHide) {
        field.style.setProperty(
          "display",
          "none",
          "important"
        );
      } else {
        field.style.removeProperty("display");
      }
    });
  }

  function isEmptyDetailField(field) {
    const value = field.querySelector(
      ".kv-detail-field-value"
    );

    if (!value) return false;

    if (
      value.querySelector(
        "img, video, audio, canvas, iframe, svg, a[href], button, input, textarea, select"
      )
    ) {
      return false;
    }

    return !normalizeText(
      value.innerText || value.textContent
    );
  }

  function hidePdfUrlField(root) {
    const field = findFieldElementByCode(
      root,
      CONFIG.pdfUrlFieldCode
    );

    if (!field) return;

    field.classList.add(
      "kv-job-pdf-url-field-hidden"
    );

    field.style.setProperty(
      "display",
      "none",
      "important"
    );
  }

  // ============================================================
  // FIELD EXTRACTION
  // ============================================================

  function cssEscape(value) {
    if (
      window.CSS &&
      typeof window.CSS.escape === "function"
    ) {
      return window.CSS.escape(String(value));
    }

    return String(value).replace(
      /[^a-zA-Z0-9_-]/g,
      char => "\\" + char
    );
  }

  function findFieldElementByCode(root, code) {
    if (!root || !code) return null;

    const escaped = cssEscape(code);

    const selector = [
      `.kv-list-field-value[data-field-code="${escaped}"]`,
      `.kv-detail-field[data-field-code="${escaped}"]`,
      `.kv-detail-field-value[data-field-code="${escaped}"]`,
    ].join(", ");

    if (root.matches?.(selector)) return root;

    const found = root.querySelector(selector);
    if (found) return found;

    const generic = `[data-field-code="${escaped}"]`;

    if (root.matches?.(generic)) return root;

    return root.querySelector(generic);
  }

  function getFieldValueElement(field) {
    if (!field) return null;

    if (
      field.classList.contains("kv-list-field-value") ||
      field.classList.contains("kv-detail-field-value")
    ) {
      return field;
    }

    return field.querySelector(
      ".kv-list-field-value, .kv-detail-field-value"
    );
  }

  function findNextMeaningfulElement(element) {
    let current = element.nextElementSibling;

    while (current) {
      const text = normalizeText(
        current.innerText || current.textContent
      );

      if (text) return current;

      current = current.nextElementSibling;
    }

    const parent = element.parentElement;
    if (!parent) return null;

    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);

    for (let i = index + 1; i < siblings.length; i++) {
      const sibling = siblings[i];

      if (
        normalizeText(
          sibling.innerText || sibling.textContent
        )
      ) {
        return sibling;
      }
    }

    return null;
  }

  function findFirstJobIdText(root) {
    const text = normalizeText(
      root.innerText || root.textContent
    );

    const match = text.match(
      /\b20\d{2}-\d{3,}\b/
    );

    return match ? match[0] : "";
  }

  function looksLikeJobId(value) {
    return /\b20\d{2}-\d{3,}\b/.test(
      normalizeText(value)
    );
  }

  function findValueByDataFieldCode(root, code) {
    const field = findFieldElementByCode(
      root,
      code
    );

    if (!field) return "";

    if (field.matches("input, textarea, select")) {
      return normalizeText(field.value);
    }

    if (
      field.classList.contains("kv-list-field-label") ||
      field.classList.contains("kv-detail-field-label")
    ) {
      const next = findNextMeaningfulElement(field);

      if (next) {
        return (
          findFirstJobIdText(next) ||
          normalizeText(
            next.innerText || next.textContent
          )
        );
      }
    }

    const control = field.querySelector(
      "input, textarea, select"
    );

    if (control) {
      return normalizeText(
        control.value || control.textContent
      );
    }

    const value = getFieldValueElement(field);

    if (value) {
      return (
        findFirstJobIdText(value) ||
        normalizeText(
          value.innerText || value.textContent
        )
      );
    }

    return findFirstJobIdText(field);
  }

  function findValueByVisibleLabel(root, label) {
    const elements = Array.from(
      root.querySelectorAll(
        "div, span, p, dt, th, label"
      )
    );

    const found = elements.find(element =>
      normalizeText(
        element.innerText || element.textContent
      ) === label
    );

    if (!found) return "";

    const next = findNextMeaningfulElement(found);

    if (next) {
      const value =
        findFirstJobIdText(next) ||
        normalizeText(
          next.innerText || next.textContent
        );

      if (looksLikeJobId(value)) {
        return value;
      }
    }

    const parent = found.parentElement;

    if (parent) {
      const text = normalizeText(
        parent.innerText || parent.textContent
      );

      const match = text.match(
        /\b20\d{2}-\d{3,}\b/
      );

      if (match) return match[0];
    }

    return "";
  }

  function findJobIdInRoot(root) {
    const direct = findValueByDataFieldCode(
      root,
      CONFIG.jobIdFieldCode
    );

    if (direct) return direct;

    for (const label of CONFIG.jobIdLabels) {
      const value = findValueByVisibleLabel(
        root,
        label
      );

      if (value) return value;
    }

    return findFirstJobIdText(root);
  }

  function makeJobCode(jobId) {
    const clean = normalizeText(jobId)
      .replace(/^JOB-/i, "");

    return CONFIG.jobPrefix + clean;
  }

  function applyJobCodeDisplay(root) {
    const field = findFieldElementByCode(
      root,
      CONFIG.jobIdFieldCode
    );

    if (!field) return;

    let value = getFieldValueElement(field);

    if (
      !value &&
      (
        field.classList.contains("kv-list-field-label") ||
        field.classList.contains("kv-detail-field-label")
      )
    ) {
      value = findNextMeaningfulElement(field);
    }

    if (!value) return;

    const rawJobId = findFirstJobIdText(value);
    if (!rawJobId) return;

    const jobCode = makeJobCode(rawJobId);

    const target =
      value.querySelector("div, span, p") ||
      value;

    if (
      normalizeText(target.textContent) === jobCode
    ) {
      return;
    }

    target.textContent = jobCode;
    target.setAttribute(
      "data-kv-job-code-formatted",
      "true"
    );
  }

  // ============================================================
  // PDF DOWNLOAD
  // ============================================================

  function extractHttpUrls(value) {
    const text = normalizeText(value);
    if (!text) return [];

    return (
      text.match(/https?:\/\/[^\s"'<>]+/gi) || []
    ).map(url => {
      try {
        return new URL(url).href;
      } catch {
        return url;
      }
    });
  }

  function isGoogleDriveUrl(url) {
    try {
      const hostname = new URL(url)
        .hostname.toLowerCase();

      return [
        "drive.google.com",
        "docs.google.com",
        "drive.usercontent.google.com",
      ].includes(hostname);
    } catch {
      return false;
    }
  }

  function findPdfDownloadUrl(root) {
    const field = findFieldElementByCode(
      root,
      CONFIG.pdfUrlFieldCode
    );

    if (!field) return "";

    const value = getFieldValueElement(field) || field;
    const candidates = [];

    if (field.matches("input, textarea, select")) {
      candidates.push(field.value);
    }

    value.querySelectorAll("a[href]").forEach(link => {
      candidates.push(
        link.getAttribute("href"),
        link.href
      );
    });

    candidates.push(
      value.innerText,
      value.textContent
    );

    return (
      candidates
        .flatMap(extractHttpUrls)
        .find(isGoogleDriveUrl) || ""
    );
  }

  function toGoogleDriveDownloadUrl(url) {
    const fileId =
      (url.match(/\/file\/d\/([^/]+)/) || [])[1] ||
      (url.match(/[?&]id=([^&]+)/) || [])[1];

    if (!fileId) return url;

    return (
      "https://drive.google.com/uc?export=download&id=" +
      encodeURIComponent(fileId)
    );
  }

  function downloadPdf(rawUrl) {
    const url = extractHttpUrls(rawUrl)
      .find(isGoogleDriveUrl);

    if (!url) return;

    const anchor = document.createElement("a");

    anchor.href = toGoogleDriveDownloadUrl(url);
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.download = "";

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  // ============================================================
  // BUTTONS
  // ============================================================

  function getActionIcon(name) {
    const attrs =
      'xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

    const paths = {
      back:
        '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
      detail:
        '<path d="M2.1 12s3.5-7 9.9-7 9.9 7 9.9 7-3.5 7-9.9 7-9.9-7-9.9-7Z"/><circle cx="12" cy="12" r="3"/>',
      download:
        '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      send:
        '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    };

    if (!paths[name]) return "";

    return `<svg ${attrs}>${paths[name]}</svg>`;
  }

  function createButton(label, variant, iconName) {
    const button = document.createElement("button");

    button.type = "button";
    button.className =
      `kv-job-button kv-job-button-${variant}`;

    const icon =
      iconName ||
      (
        label === "DETAIL"
          ? "detail"
          : label.includes("DOWNLOAD")
            ? "download"
            : "send"
      );

    button.innerHTML = `
      <span class="kv-job-button-content">
        ${getActionIcon(icon)}
        <span class="kv-job-button-label"></span>
      </span>
    `;

    button.querySelector(
      ".kv-job-button-label"
    ).textContent = label;

    return button;
  }

  function enhanceBackControl(element) {
    element.classList.add("kv-job-back-button");
    element.classList.remove("underline");

    if (
      element.getAttribute(
        "data-kv-job-back-enhanced"
      ) === "true"
    ) {
      return;
    }

    const label = normalizeText(
      element.innerText || element.textContent
    ) || "Kembali";

    element.innerHTML = `
      ${getActionIcon("back")}
      <span class="kv-job-back-label"></span>
    `;

    element.querySelector(
      ".kv-job-back-label"
    ).textContent = label;

    element.setAttribute(
      "data-kv-job-back-enhanced",
      "true"
    );

    element.setAttribute("aria-label", label);
  }

  function findBackElement(root) {
    const elements = Array.from(
      root.querySelectorAll(
        "a, button, [role='button']"
      )
    ).filter(element =>
      !element.matches("[data-kv-job-action]")
    );

    return elements.find(element => {
      const text = normalizeText(
        element.innerText ||
        element.textContent ||
        element.getAttribute("aria-label")
      );

      const href =
        element.getAttribute("href") || "";

      return (
        text === "Kembali" ||
        text === "戻る" ||
        text.toLowerCase() === "back" ||
        (
          href.includes(CONFIG.listPath) &&
          Boolean(element.closest(".kv-detail"))
        )
      );
    }) || null;
  }

  function findDetailLink(root) {
    if (!root) return null;

    return Array.from(
      root.querySelectorAll("a[href]")
    ).find(link =>
      link.href.includes(CONFIG.detailPathPart) ||
      /\/detail\//.test(link.href)
    ) || null;
  }

  function findClickableDetailTarget(root) {
    if (!root) return null;

    return Array.from(
      root.querySelectorAll(
        "a, button, [role='button'], [onclick], [tabindex]"
      )
    ).find(element => {
      if (element.closest(".kv-job-card-actions")) {
        return false;
      }

      const text = normalizeText(
        element.innerText || element.textContent
      );

      return (
        !text ||
        /detail|詳細|›|»|＞/i.test(text)
      );
    }) || null;
  }

  function goToDetail(button) {
    const card = button.closest(
      "tr.kv-list-record, article, li, .card, [class*='card'], [class*='Card'], [class*='record'], [class*='Record']"
    ) || button.parentElement;

    const link = findDetailLink(
      card || document.body
    );

    if (link) {
      location.href = link.href;
      return;
    }

    const clickable = findClickableDetailTarget(card);

    if (clickable) {
      clickable.click();
      return;
    }

    card?.click();
  }

  // ============================================================
  // REGISTRATION CHANNEL SETTINGS
  // ============================================================

  function getRegistrationChannels() {
    const mode = normalizeText(
      CONFIG.registrationMode
    ).toLowerCase();

    switch (mode) {
      case "both":
        return ["whatsapp", "telegram"];

      case "telegram":
        return ["telegram"];

      case "whatsapp":
        return ["whatsapp"];

      default:
        log(
          "Invalid registrationMode, fallback to WhatsApp.",
          mode
        );
        return ["whatsapp"];
    }
  }

  function isTelegramPayloadValid(jobCode) {
    // Telegram start payload:
    // A-Z, a-z, 0-9, _, -
    // Maximum 64 characters

    return /^[A-Za-z0-9_-]{1,64}$/.test(jobCode);
  }

  function getRegistrationUrl(channel, jobCode) {
    if (channel === "whatsapp") {
      const url = new URL(
        CONFIG.whatsappBaseUrl
      );

      url.searchParams.set("text", jobCode);

      return url.toString();
    }

    if (channel === "telegram") {
      const url = new URL(
        CONFIG.telegramBotUrl
      );

      if (isTelegramPayloadValid(jobCode)) {
        url.searchParams.set(
          "start",
          jobCode
        );
      } else {
        log(
          "Invalid Telegram start payload. Manual copy required.",
          jobCode
        );
      }

      return url.toString();
    }

    return "#";
  }

  // ============================================================
  // DYNAMIC REGISTRATION INSTRUCTIONS
  // ============================================================

  function getRegistrationInstructions(
    channels,
    jobCode
  ) {
    const whatsapp = channels.includes("whatsapp");
    const telegram = channels.includes("telegram");

    const validTelegramPayload =
      isTelegramPayloadValid(jobCode);

    const steps = [
      "Periksa kembali detail lowongan, terutama kriteria pelamar, lokasi kerja, dan informasi gaji.",
    ];

    if (whatsapp && telegram) {
      steps.push(
        "Pilih salah satu metode pendaftaran: WhatsApp atau Telegram."
      );
    } else if (whatsapp) {
      steps.push(
        "Klik tombol DAFTAR KE WHATSAPP."
      );
    } else {
      steps.push(
        "Klik tombol DAFTAR KE TELEGRAM."
      );
    }

    if (whatsapp) {
      steps.push(
        "WhatsApp: pesan berisi Job Code akan terisi otomatis. Tekan Kirim tanpa menambahkan teks lain."
      );
    }

    if (telegram) {
      if (validTelegramPayload) {
        steps.push(
          "Telegram: setelah bot terbuka, tekan tombol START/MULAI jika muncul, terutama jika ini pertama kali Kamu chat dengan bot. Job Code akan diteruskan ke bot melalui perintah /start secara otomatis."
        );

        steps.push(
          "Jika bot meminta kode secara manual, klik Job Code di bawah untuk menyalin, lalu kirimkan hanya kode tersebut di chat Telegram."
        );
      } else {
        steps.push(
          "Telegram: setelah bot terbuka, tekan START/MULAI jika diminta. Salin Job Code di bawah, kemudian tempel dan kirimkan kodenya ke bot."
        );
      }
    }

    steps.push(
      "Tunggu respons dari tim kami, lalu ikuti panduan atau instruksi selanjutnya."
    );

    return steps;
  }

  // ============================================================
  // REGISTRATION BUTTON
  // ============================================================

  function createRegistrationButton(channel) {
    const button = document.createElement("a");

    button.className = [
      "kv-job-registration-button",
      `kv-job-${channel}-button`,
      "kv-job-registration-disabled",
    ].join(" ");

    button.href = "#";

    button.setAttribute(
      "aria-disabled",
      "true"
    );

    button.setAttribute(
      "data-kv-registration-channel",
      channel
    );

    button.textContent =
      channel === "telegram"
        ? "DAFTAR KE TELEGRAM"
        : "DAFTAR KE WHATSAPP";

    button.addEventListener("click", event => {
      if (
        button.getAttribute("aria-disabled") === "true"
      ) {
        event.preventDefault();
      }
    });

    return button;
  }

  // ============================================================
  // APPLY MODAL
  // ============================================================

  function openApplyModal(jobCode, triggerElement) {
    const cleanJobCode = normalizeText(jobCode);

    if (!cleanJobCode) {
      log("Job Code not found.");
      return;
    }

    closeApplyModal(true);

    const channels = getRegistrationChannels();

    // Overlay
    const overlay = document.createElement("div");

    overlay.id = IDS.modal;
    overlay.className = "kv-job-modal-overlay";

    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute(
      "aria-labelledby",
      "kv-job-modal-title"
    );

    // Dialog
    const dialog = document.createElement("div");
    dialog.className = "kv-job-modal-dialog";

    // Close button
    const closeButton = document.createElement("button");

    closeButton.type = "button";
    closeButton.className = "kv-job-modal-close";
    closeButton.setAttribute(
      "aria-label",
      "Tutup modal"
    );

    closeButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg"
        width="20" height="20" viewBox="0 0 24 24"
        fill="none" stroke="currentColor"
        stroke-width="2.25"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <path d="M18 6 6 18"/>
        <path d="m6 6 12 12"/>
      </svg>
    `;

    closeButton.addEventListener(
      "click",
      () => closeApplyModal()
    );

    // Title
    const title = document.createElement("h2");

    title.id = "kv-job-modal-title";
    title.textContent = "Konfirmasi Pendaftaran";

    // Introduction
    const intro = document.createElement("p");

    intro.className = "kv-job-modal-text";

    intro.textContent =
      "Sebelum mendaftar, pastikan lowongan pekerjaan ini sesuai dengan minat dan Kamu sudah memenuhi syarat atau kriteria yang diminta.";

    // Instruction heading
    const instructionTitle = document.createElement("div");

    instructionTitle.className = "kv-job-step-title";
    instructionTitle.textContent = "Langkah pendaftaran";

    // Dynamic instructions
    const instruction = document.createElement("ol");
    instruction.className = "kv-job-step-list";

    getRegistrationInstructions(
      channels,
      cleanJobCode
    ).forEach(text => {
      const item = document.createElement("li");
      item.textContent = text;
      instruction.appendChild(item);
    });

    // Job Code label
    const codeLabel = document.createElement("div");
    codeLabel.className = "kv-job-code-label";
    codeLabel.textContent = "Job Code";

    // Job Code copy button
    const codeButton = document.createElement("button");

    codeButton.type = "button";
    codeButton.className = "kv-job-code-copy";

    codeButton.innerHTML = `
      <span class="kv-job-code-value"></span>
      <span class="kv-job-code-status">
        <span class="kv-job-code-status-text">
          Klik untuk salin kode
        </span>
        <svg xmlns="http://www.w3.org/2000/svg"
          width="15" height="15" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          stroke-width="2.25"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <rect width="14" height="14"
            x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
      </span>
    `;

    codeButton.querySelector(
      ".kv-job-code-value"
    ).textContent = cleanJobCode;

    codeButton.addEventListener("click", () => {
      copyJobCode(cleanJobCode, codeButton);
    });

    // Action container
    const bottomActions = document.createElement("div");
    bottomActions.className = "kv-job-modal-actions";

    // Detail button for index page only
    if (!isDetailPage()) {
      const detailButton = createButton(
        "DETAIL",
        "secondary"
      );

      detailButton.classList.add(
        "kv-job-modal-detail-button"
      );

      detailButton.addEventListener("click", () => {
        closeApplyModal();

        if (triggerElement) {
          setTimeout(
            () => goToDetail(triggerElement),
            190
          );
        }
      });

      bottomActions.appendChild(detailButton);
    } else {
      bottomActions.classList.add(
        "kv-job-modal-actions-single"
      );
    }

    // Channel buttons container
    const channelActions = document.createElement("div");
    channelActions.className = "kv-job-modal-channels";

    if (channels.length > 1) {
      bottomActions.classList.add(
        "kv-job-modal-actions-multi"
      );

      channelActions.classList.add(
        "kv-job-modal-channels-multi"
      );
    }

    const channelButtons = channels.map(channel => ({
      channel,
      button: createRegistrationButton(channel),
    }));

    channelButtons.forEach(({ button }) => {
      channelActions.appendChild(button);
    });

    bottomActions.appendChild(channelActions);

    // Assemble dialog
    dialog.append(
      closeButton,
      title,
      intro,
      instructionTitle,
      instruction,
      codeLabel,
      codeButton,
      bottomActions
    );

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    document.body.classList.add(
      "kv-job-modal-open"
    );

    // Close by clicking backdrop
    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        closeApplyModal();
      }
    });

    document.addEventListener(
      "keydown",
      closeOnEscape
    );

    // Start registration countdown
    startRegistrationCountdown(
      channelButtons,
      cleanJobCode
    );

    requestAnimationFrame(() => {
      if (!overlay.isConnected) return;

      overlay.classList.add(
        "kv-job-modal-visible"
      );

      closeButton.focus();
    });
  }

  // ============================================================
  // COUNTDOWN FOR ALL REGISTRATION CHANNELS
  // ============================================================

  function startRegistrationCountdown(
    channelButtons,
    jobCode
  ) {
    clearInterval(state.modalCountdownTimer);

    const delay = Math.max(
      0,
      Number(CONFIG.registrationDelaySeconds) || 0
    );

    const unlockAt =
      Date.now() + Math.ceil(delay * 1000);

    const setButtonLabel = (
      button,
      channel,
      remaining
    ) => {
      const name =
        channel === "telegram"
          ? "TELEGRAM"
          : "WHATSAPP";

      button.textContent =
        "DAFTAR KE " +
        name +
        (remaining > 0 ? ` (${remaining})` : "");
    };

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (unlockAt - Date.now()) / 1000
        )
      );

      channelButtons.forEach(({ button, channel }) => {
        setButtonLabel(
          button,
          channel,
          remaining
        );

        if (remaining > 0) return;

        button.href = getRegistrationUrl(
          channel,
          jobCode
        );

        button.target = "_blank";
        button.rel = "noopener noreferrer";

        button.setAttribute(
          "aria-disabled",
          "false"
        );

        button.classList.remove(
          "kv-job-registration-disabled"
        );
      });

      if (remaining === 0) {
        clearInterval(
          state.modalCountdownTimer
        );

        state.modalCountdownTimer = null;
      }
    };

    updateCountdown();

    if (delay > 0) {
      state.modalCountdownTimer = setInterval(
        updateCountdown,
        250
      );
    }
  }

  // ============================================================
  // MODAL CLOSE
  // ============================================================

  function closeOnEscape(event) {
    if (event.key === "Escape") {
      closeApplyModal();
    }
  }

  function closeApplyModal(immediate = false) {
    clearInterval(state.modalCountdownTimer);
    state.modalCountdownTimer = null;

    const modal = document.getElementById(
      IDS.modal
    );

    if (modal) {
      if (immediate) {
        modal.remove();
      } else {
        modal.classList.remove(
          "kv-job-modal-visible"
        );

        setTimeout(() => {
          if (modal.parentElement) {
            modal.remove();
          }
        }, 180);
      }
    }

    document.body?.classList.remove(
      "kv-job-modal-open"
    );

    document.removeEventListener(
      "keydown",
      closeOnEscape
    );
  }

  // ============================================================
  // COPY JOB CODE
  // ============================================================

  async function copyJobCode(jobCode, button) {
    try {
      await navigator.clipboard.writeText(jobCode);

      setCopyStatus(
        button,
        "Kode berhasil disalin",
        true
      );
    } catch {
      fallbackCopy(jobCode, button);
    }
  }

  function fallbackCopy(text, button) {
    const input = document.createElement("textarea");

    input.value = text;
    input.setAttribute("readonly", "readonly");

    input.style.position = "fixed";
    input.style.top = "-1000px";

    document.body.appendChild(input);
    input.select();

    let success = false;

    try {
      success = document.execCommand("copy");
    } catch {}

    input.remove();

    setCopyStatus(
      button,
      success
        ? "Kode berhasil disalin"
        : "Copy gagal. Silakan salin kode manual.",
      success
    );
  }

  function setCopyStatus(button, message, success) {
    if (!button) return;

    const status = button.querySelector(
      ".kv-job-code-status-text"
    );

    if (!status) return;

    button.classList.toggle(
      "kv-job-code-copied",
      Boolean(success)
    );

    button.classList.toggle(
      "kv-job-code-copy-failed",
      !success
    );

    status.textContent = message;

    setTimeout(() => {
      if (!button.isConnected) return;

      button.classList.remove(
        "kv-job-code-copied",
        "kv-job-code-copy-failed"
      );

      status.textContent =
        "Klik untuk salin kode";
    }, 2400);
  }

  // ============================================================
  // CSS
  // ============================================================

  function installStyles() {
    let style = document.getElementById(
      IDS.style
    );

    if (!style) {
      style = document.createElement("style");
      style.id = IDS.style;
      document.head.appendChild(style);
    }

    style.textContent = `
      /* ======================================================
         INDEX PAGE
         ====================================================== */

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

      tr.kv-list-record.kv-job-list-card-mobile-enhanced {
        display: block !important;
        width: calc(100% - 20px) !important;
        margin: 10px 10px 16px !important;
        border: 1px solid #dbeafe !important;
        border-radius: 6px !important;
        background: #ffffff !important;
        overflow: hidden !important;
      }

      tr.kv-list-record.kv-job-list-card-mobile-enhanced
        > td:first-child {
        display: block !important;
        width: 100% !important;
        border: 0 !important;
        box-sizing: border-box !important;
      }

      tr.kv-list-record.kv-job-list-card-mobile-enhanced
        > td:first-child dl {
        padding: 14px 10px 0 !important;
      }

      tr.kv-list-record.kv-job-list-card-mobile-enhanced
        > td:not(:first-child) {
        display: none !important;
      }

      .kv-job-native-arrow-hidden,
      .kv-job-empty-field-hidden,
      .kv-job-pdf-url-field-hidden {
        display: none !important;
      }

      .kv-job-table-action-cell {
        min-width: 190px;
        border: 1px solid #e5e7eb;
        padding: 8px;
        vertical-align: middle;
        background: #ffffff;
      }

      .kv-job-table-action-cell .kv-job-card-actions {
        grid-template-columns: 1fr;
        gap: 8px;
        margin-top: 0;
        padding: 0;
        border-top: 0;
      }

      /* ======================================================
         BASE BUTTONS
         ====================================================== */

      .kv-job-button {
        appearance: none;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 10px 12px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0;
        line-height: 1;
        cursor: pointer;
        box-shadow: none;
        transition:
          transform 120ms ease,
          border-color 120ms ease,
          background 120ms ease,
          color 120ms ease;
      }

      .kv-job-button-content,
      .kv-job-back-button {
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        gap: 7px;
        min-width: 0;
      }

      .kv-job-button svg,
      .kv-job-back-button svg {
        flex: 0 0 auto;
      }

      .kv-job-button-label,
      .kv-job-back-label {
        min-width: 0;
        overflow-wrap: normal;
        white-space: nowrap;
      }

      .kv-job-button:hover {
        border-color: #0079d2;
      }

      .kv-job-button:active {
        transform: translateY(1px);
      }

      .kv-job-button:focus-visible,
      .kv-job-back-button:focus-visible,
      .kv-job-code-copy:focus-visible,
      .kv-job-modal-close:focus-visible,
      .kv-job-registration-button:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.38);
        outline-offset: 2px;
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
        color: #111827;
        border-color: #cbd5e1;
      }

      .kv-job-button-secondary:hover {
        background: #eff6ff;
        color: #005ea8;
      }

      /* ======================================================
         DETAIL PAGE TOOLBAR
         ====================================================== */

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
        line-height: 1 !important;
        text-decoration: none !important;
        box-sizing: border-box;
        transition:
          transform 120ms ease,
          border-color 120ms ease,
          background 120ms ease,
          color 120ms ease;
      }

      .kv-job-back-button:hover {
        background: #eff6ff;
        border-color: #0079d2;
        color: #005ea8 !important;
      }

      .kv-job-back-button:active {
        transform: translateY(1px);
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
          align-items: stretch;
        }

        .kv-job-detail-toolbar.kv-job-detail-toolbar-has-pdf {
          grid-template-columns:
            minmax(90px, 0.82fr)
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
          line-height: 1;
        }

        .kv-job-detail-toolbar
          .kv-job-back-button ~ .kv-job-button-primary,
        .kv-job-detail-toolbar
          .kv-job-download-pdf-button,
        .kv-job-detail-toolbar
          .kv-job-download-pdf-button + .kv-job-button {
          margin-left: 0;
        }

        .kv-job-detail-toolbar .kv-job-button-content,
        .kv-job-detail-toolbar .kv-job-back-button {
          gap: 5px;
        }

        .kv-job-detail-toolbar .kv-job-button svg,
        .kv-job-detail-toolbar .kv-job-back-button svg {
          width: 15px;
          height: 15px;
        }
      }

      /* ======================================================
         MODAL OVERLAY
         ====================================================== */

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
        background: rgba(15, 23, 42, 0);
        opacity: 0;
        transition:
          opacity 180ms ease,
          background 180ms ease;
      }

      .kv-job-modal-visible {
        background: rgba(15, 23, 42, 0.58);
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
          0 24px 80px rgba(17, 24, 39, 0.24);
        padding: 24px 20px 20px;
        transform:
          translateY(12px) scale(0.98);
        transition: transform 180ms ease;
      }

      .kv-job-modal-visible .kv-job-modal-dialog {
        transform: translateY(0) scale(1);
      }

      .kv-job-modal-close {
        position: absolute;
        top: 12px;
        right: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        background: #ffffff;
        color: #374151;
        cursor: pointer;
        transition:
          background 140ms ease,
          border-color 140ms ease,
          color 140ms ease;
      }

      .kv-job-modal-close:hover {
        background: #f3f4f6;
        border-color: #9ca3af;
        color: #111827;
      }

      .kv-job-modal-dialog h2 {
        margin: 0 38px 14px 0;
        font-size: 20px;
        font-weight: 800;
        line-height: 1.25;
        letter-spacing: 0;
      }

      .kv-job-modal-text {
        margin: 0 0 12px;
        color: #374151;
        font-size: 14px;
        line-height: 1.6;
      }

      /* ======================================================
         REGISTRATION STEPS
         ====================================================== */

      .kv-job-step-title {
        margin: 16px 0 8px;
        font-size: 13px;
        font-weight: 900;
        color: #111827;
      }

      .kv-job-step-list {
        margin: 0 0 16px 0;
        padding: 0 0 0 24px;
        color: #374151;
        font-size: 14px;
        line-height: 1.55;
        list-style: decimal !important;
      }

      .kv-job-step-list li {
        display: list-item !important;
        list-style: decimal !important;
        margin: 0 0 7px;
        padding-left: 4px;
      }

      /* ======================================================
         JOB CODE
         ====================================================== */

      .kv-job-code-label {
        margin: 18px 0 4px;
        font-size: 12px;
        font-weight: 900;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0;
      }

      .kv-job-code-copy {
        display: grid;
        grid-template-columns: 1fr;
        grid-template-rows: auto auto;
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
        letter-spacing: 0;
        cursor: pointer;
        overflow-wrap: anywhere;
        text-align: center;
        transition:
          background 140ms ease,
          border-color 140ms ease;
      }

      .kv-job-code-copy:hover {
        background: #dbeafe;
      }

      .kv-job-code-value {
        display: block;
        grid-column: 1;
        justify-self: center;
      }

      .kv-job-code-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        grid-column: 1;
        justify-self: center;
        min-height: 22px;
        border-radius: 999px;
        background: #ffffff;
        color: #0079d2;
        padding: 4px 9px;
        font-size: 12px;
        font-weight: 800;
      }

      .kv-job-code-copied {
        border-color: #16a34a;
        background: #ecfdf5;
        color: #14532d;
      }

      .kv-job-code-copied .kv-job-code-status {
        background: #16a34a;
        color: #ffffff;
      }

      .kv-job-code-copy-failed {
        border-color: #dc2626;
        background: #fef2f2;
        color: #7f1d1d;
      }

      .kv-job-code-copy-failed .kv-job-code-status {
        background: #dc2626;
        color: #ffffff;
      }

      /* ======================================================
         REGISTRATION CHANNEL BUTTONS
         ====================================================== */

      .kv-job-registration-button {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        min-height: 46px;
        width: 100%;
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 10px 8px;
        background: #0079d2;
        color: #ffffff !important;
        font-size: 13px;
        font-weight: 900;
        line-height: 1.3;
        text-align: center;
        overflow-wrap: break-word;
        box-sizing: border-box;
        text-decoration: none !important;
        letter-spacing: 0;
        transition:
          background 140ms ease,
          transform 140ms ease;
      }

      .kv-job-whatsapp-button {
        background: #0079d2;
      }

      .kv-job-whatsapp-button:hover {
        background: #006bb9;
      }

      .kv-job-telegram-button {
        background: #229ed9;
      }

      .kv-job-telegram-button:hover {
        background: #1686c0;
      }

      /* ======================================================
         MODAL ACTION LAYOUT
         ====================================================== */

      .kv-job-modal-actions {
        display: grid;
        grid-template-columns:
          minmax(110px, 0.62fr)
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

      .kv-job-modal-actions .kv-job-button,
      .kv-job-modal-actions
        .kv-job-registration-button {
        min-height: 46px;
        margin: 0;
      }

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
