/**
 * ============================================================
 * KViewer Job Apply Buttons
 * ============================================================
 *
 * Target:
 * - https://e-bridge-id.viewer.kintoneapp.com/public/sswjoblist
 * - https://e-bridge-id.viewer.kintoneapp.com/public/sswjoblist/detail/
 *
 * Features:
 * - Index page: add DETAIL and DAFTAR buttons at the bottom of each card.
 * - Detail page: add DAFTAR button beside the Kembali/back control.
 * - DAFTAR opens a modal with Job Code: "JOB-" + field 求人票ID value.
 * - Job Code area can be clicked to copy.
 * - WhatsApp button is enabled after 5 seconds.
 * - WhatsApp message contains only the Job Code.
 * - Value in KViewer/Kintone is never changed.
 *
 * Note about IP restriction:
 * Browser JavaScript cannot securely read a private LAN IP such as
 * 192.168.110.204 in every browser. This script uses a best-effort gate:
 * public IP lookup, WebRTC local-IP discovery where available, and an
 * optional local test override.
 */

(function () {
  "use strict";

  const CONFIG = {
    name: "KViewer Job Apply Buttons",
    version: "1.4.4",
    debug: false,

    host: "e-bridge-id.viewer.kintoneapp.com",
    listPath: "/public/sswjoblist",
    detailPathPart: "/public/sswjoblist/detail/",

    jobIdFieldCode: "求人票ID",
    jobIdLabels: ["求人票ID", "Job ID", "Job Id", "JOB ID"],
    jobPrefix: "JOB-",
    pdfUrlFieldCode: "job_detail_url_idn",

    whatsappBaseUrl: "https://wa.me/6285258363076",
    whatsappDelaySeconds: 5,

    detailFields: {
      hideEmptyFields: true,
      neverHideFieldTypes: ["INDEX_LINK", "LABEL", "HR", "SPACER"],
      neverHideFieldCodes: [],
    },

    ipRestriction: {
      enabled: true,
      allowedIps: ["192.168.110.204"],
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
  };

  if (!isTargetHost()) {
    return;
  }

  if (
    window[INSTANCE_KEY] &&
    typeof window[INSTANCE_KEY].destroy === "function"
  ) {
    window[INSTANCE_KEY].destroy();
  }

  window[INSTANCE_KEY] = {
    destroy() {
      window.clearTimeout(state.renderTimer);
      window.clearInterval(state.intervalId);
      window.clearInterval(state.modalCountdownTimer);
      if (state.observer) {
        state.observer.disconnect();
      }
      document.removeEventListener("keydown", closeOnEscape);
    },
  };

  boot();

  async function boot() {
    installStyles();
    state.accessAllowed = await checkAccess();

    if (!state.accessAllowed) {
      log("Script tidak aktif karena IP tidak masuk daftar test.", {
        allowedIps: CONFIG.ipRestriction.allowedIps,
        detectedIps: state.accessIps,
        reason: state.accessReason,
      });
      return;
    }

    log("Script aktif.", {
      version: CONFIG.version,
      detectedIps: state.accessIps,
      reason: state.accessReason,
    });

    installObserver();
    installGlobalClickGuard();
    scheduleRender("boot");
    if (CONFIG.periodicDelay > 0) {
      state.intervalId = window.setInterval(
        () => scheduleRender("periodic"),
        CONFIG.periodicDelay,
      );
    }
  }

  function isTargetHost() {
    return location.hostname === CONFIG.host;
  }

  function isIndexPage() {
    return (
      location.pathname.replace(/\/+$/, "") === CONFIG.listPath &&
      !isDetailPage()
    );
  }

  function isDetailPage() {
    return location.pathname.includes(CONFIG.detailPathPart);
  }

  function log(...args) {
    if (!CONFIG.debug) return;
    console.log(
      "%c[" + CONFIG.name + "]",
      "background:#0079d2;color:#fff;font-weight:700;padding:2px 7px;border-radius:4px",
      ...args,
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
    return [...new Set(values.map(normalizeText).filter(Boolean))];
  }

  async function checkAccess() {
    if (!CONFIG.ipRestriction.enabled) {
      state.accessReason = "ip-check-disabled";
      return true;
    }

    const overrideIp = getOverrideIp();
    const detectedIps = [];

    if (overrideIp) {
      detectedIps.push(overrideIp);
    }

    const publicIps = await getPublicIps();
    detectedIps.push(...publicIps);

    const localIps = await getLocalIpsViaWebRtc();
    detectedIps.push(...localIps);

    state.accessIps = unique(detectedIps);

    const allowed = state.accessIps.some((ip) => {
      return CONFIG.ipRestriction.allowedIps.includes(ip);
    });

    if (allowed) {
      state.accessReason = overrideIp ? "override-ip-match" : "ip-match";
      return true;
    }

    if (!state.accessIps.length && CONFIG.ipRestriction.allowWhenUnknown) {
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
      params.get(CONFIG.ipRestriction.overrideQueryParam),
    );

    if (fromUrl) {
      try {
        localStorage.setItem(
          CONFIG.ipRestriction.overrideLocalStorageKey,
          fromUrl,
        );
      } catch (error) {
        log("Tidak bisa menyimpan override IP.", error);
      }
      return fromUrl;
    }

    try {
      return normalizeText(
        localStorage.getItem(CONFIG.ipRestriction.overrideLocalStorageKey),
      );
    } catch (error) {
      return "";
    }
  }

  async function getPublicIps() {
    const results = [];

    await Promise.all(
      CONFIG.ipRestriction.publicIpUrls.map(async (url) => {
        try {
          const response = await fetchWithTimeout(
            url,
            CONFIG.ipRestriction.timeoutMs,
          );
          if (!response.ok) return;

          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            const data = await response.json();
            results.push(data.ip);
            return;
          }

          results.push(await response.text());
        } catch (error) {
          log("Public IP check gagal.", { url, error: String(error) });
        }
      }),
    );

    return results
      .map((value) => normalizeText(value).replace(/^"|"$/g, ""))
      .filter(isIpAddress);
  }

  function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);

    return fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    }).finally(() => window.clearTimeout(timer));
  }

  function getLocalIpsViaWebRtc() {
    return new Promise((resolve) => {
      const RTCPeerConnection =
        window.RTCPeerConnection ||
        window.webkitRTCPeerConnection ||
        window.mozRTCPeerConnection;

      if (!RTCPeerConnection) {
        resolve([]);
        return;
      }

      const ips = new Set();
      const timeout = window.setTimeout(() => {
        cleanup();
        resolve([...ips]);
      }, CONFIG.ipRestriction.timeoutMs);

      let peer;

      function cleanup() {
        window.clearTimeout(timeout);
        if (peer) {
          try {
            peer.close();
          } catch (error) {
            log("WebRTC cleanup gagal.", error);
          }
        }
      }

      function collectCandidate(candidateText) {
        const matches = String(candidateText || "").match(
          /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        );

        (matches || []).forEach((ip) => {
          if (isIpAddress(ip)) ips.add(ip);
        });
      }

      try {
        peer = new RTCPeerConnection({ iceServers: [] });
        peer.createDataChannel("kv-ip-check");
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            collectCandidate(event.candidate.candidate);
            return;
          }

          cleanup();
          resolve([...ips]);
        };

        peer
          .createOffer()
          .then((offer) => {
            collectCandidate(offer.sdp);
            return peer.setLocalDescription(offer);
          })
          .catch(() => {
            cleanup();
            resolve([...ips]);
          });
      } catch (error) {
        cleanup();
        resolve([]);
      }
    });
  }

  function isIpAddress(value) {
    const text = normalizeText(value);
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(text)) return false;
    return text.split(".").every((part) => {
      const number = Number(part);
      return Number.isInteger(number) && number >= 0 && number <= 255;
    });
  }

  function installObserver() {
    if (!document.body) {
      window.setTimeout(installObserver, 100);
      return;
    }

    state.observer = new MutationObserver(() => scheduleRender("mutation"));
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function installGlobalClickGuard() {
    document.addEventListener(
      "click",
      (event) => {
        const action = event.target.closest("[data-kv-job-action]");
        if (!action) return;

        const type = action.getAttribute("data-kv-job-action");
        if (type === "detail") {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
          }
          goToDetail(action);
        }

        if (type === "apply") {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
          }
          openApplyModal(action.getAttribute("data-kv-job-code") || "", action);
        }

        if (type === "download-pdf") {
          event.preventDefault();
          event.stopPropagation();
          if (typeof event.stopImmediatePropagation === "function") {
            event.stopImmediatePropagation();
          }
          downloadPdf(action.getAttribute("data-kv-pdf-url") || "");
        }
      },
      true,
    );
  }

  function scheduleRender(reason) {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(
      () => render(reason),
      CONFIG.mutationDelay,
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

    if (CONFIG.debug && reason === "boot") {
      log("render", reason);
    }
  }

  function enhanceIndexPage() {
    const cards = findIndexCards();

    cards.forEach((card) => {
      if (card.getAttribute(ATTR.cardEnhanced) === "true") return;

      const jobId = findJobIdInRoot(card);
      if (!jobId) return;
      applyJobCodeDisplay(card);

      const actionRow = document.createElement("div");
      actionRow.className = "kv-job-card-actions";

      const detailButton = createButton("DETAIL", "secondary");
      detailButton.setAttribute("data-kv-job-action", "detail");

      const applyButton = createButton("DAFTAR", "primary");
      applyButton.setAttribute("data-kv-job-action", "apply");
      applyButton.setAttribute("data-kv-job-code", makeJobCode(jobId));

      actionRow.append(detailButton, applyButton);

      const mount = findIndexActionMount(card);
      if (!mount) return;

      mount.appendChild(actionRow);
      hideNativeDetailArrow(card);

      if (mount.classList.contains("kv-job-list-action-dd")) {
        card.classList.add("kv-job-list-card-mobile-enhanced");
        card.classList.remove("kv-job-list-row-desktop-enhanced");
      } else {
        card.classList.add("kv-job-list-row-desktop-enhanced");
        card.classList.remove("kv-job-list-card-mobile-enhanced");
      }

      card.setAttribute(ATTR.cardEnhanced, "true");
    });
  }

  function enhanceDetailPage() {
    const detailRoot = document.querySelector(".kv-detail");
    if (!detailRoot) return;

    cleanupLooseActionButtons(document.body);
    applyJobCodeDisplay(detailRoot);
    applyEmptyDetailFieldVisibility(detailRoot);
    hidePdfUrlField(detailRoot);

    const jobId = findJobIdInRoot(detailRoot);
    if (!jobId) return;
    const pdfUrl = findPdfDownloadUrl(detailRoot);

    const backElement = findBackElement(detailRoot);
    if (!backElement) return;
    enhanceBackControl(backElement);

    document
      .querySelectorAll(".kv-job-detail-toolbar [data-kv-job-action='apply']")
      .forEach((button, index) => {
        if (index > 0) button.remove();
      });

    const mount = backElement.parentElement;
    if (!mount) return;

    mount.classList.add("kv-job-detail-toolbar");
    mount.classList.toggle("kv-job-detail-toolbar-has-pdf", Boolean(pdfUrl));

    let applyButton = mount.querySelector(
      ":scope > [data-kv-job-action='apply']",
    );
    if (!applyButton) {
      applyButton = createButton("DAFTAR", "primary");
      mount.appendChild(applyButton);
    }

    applyButton.setAttribute("data-kv-job-action", "apply");
    applyButton.setAttribute("data-kv-job-code", makeJobCode(jobId));

    let pdfButton = mount.querySelector(
      ":scope > [data-kv-job-action='download-pdf']",
    );

    if (pdfUrl) {
      if (!pdfButton) {
        pdfButton = createButton("DOWNLOAD PDF", "secondary", "download");
        pdfButton.classList.add("kv-job-download-pdf-button");
        mount.insertBefore(pdfButton, applyButton);
      }

      pdfButton.setAttribute("data-kv-job-action", "download-pdf");
      pdfButton.setAttribute("data-kv-pdf-url", pdfUrl);
      pdfButton.hidden = false;
    } else if (pdfButton) {
      pdfButton.remove();
    }

    document.body.setAttribute(ATTR.detailEnhanced, "true");
  }

  function applyEmptyDetailFieldVisibility(detailRoot) {
    const shouldHide = Boolean(CONFIG.detailFields.hideEmptyFields);
    const neverHideTypes = new Set(
      CONFIG.detailFields.neverHideFieldTypes || [],
    );
    const neverHideCodes = new Set(
      CONFIG.detailFields.neverHideFieldCodes || [],
    );

    detailRoot.querySelectorAll(".kv-detail-field").forEach((field) => {
      const fieldType = normalizeText(field.getAttribute("data-field-type"));
      const fieldCode = normalizeText(field.getAttribute("data-field-code"));

      if (
        neverHideTypes.has(fieldType) ||
        neverHideCodes.has(fieldCode) ||
        field.querySelector("[data-kv-job-action]")
      ) {
        field.classList.remove("kv-job-empty-field-hidden");
        field.style.removeProperty("display");
        return;
      }

      if (shouldHide && isEmptyDetailField(field)) {
        field.classList.add("kv-job-empty-field-hidden");
        field.style.setProperty("display", "none", "important");
      } else {
        field.classList.remove("kv-job-empty-field-hidden");
        field.style.removeProperty("display");
      }
    });
  }

  function isEmptyDetailField(field) {
    const valueElement = field.querySelector(".kv-detail-field-value");
    if (!valueElement) return false;

    if (
      valueElement.querySelector(
        "img, video, audio, canvas, iframe, svg, a[href], button, input, textarea, select",
      )
    ) {
      return false;
    }

    const text = normalizeText(
      valueElement.innerText || valueElement.textContent,
    );
    return !text;
  }

  function hidePdfUrlField(root) {
    const field = findFieldElementByCode(root, CONFIG.pdfUrlFieldCode);
    if (!field) return;

    field.classList.add("kv-job-pdf-url-field-hidden");
    field.style.setProperty("display", "none", "important");
  }

  function applyJobCodeDisplay(root) {
    const field = findFieldElementByCode(root, CONFIG.jobIdFieldCode);
    if (!field) return;

    let valueElement = getFieldValueElement(field);
    if (
      !valueElement &&
      (field.classList.contains("kv-list-field-label") ||
        field.classList.contains("kv-detail-field-label"))
    ) {
      valueElement = findNextMeaningfulElement(field);
    }
    if (!valueElement) return;

    const rawJobId = findFirstJobIdText(valueElement);
    if (!rawJobId) return;

    const jobCode = makeJobCode(rawJobId);
    const target = valueElement.querySelector("div, span, p") || valueElement;

    if (normalizeText(target.textContent) === jobCode) return;

    target.textContent = jobCode;
    target.setAttribute("data-kv-job-code-formatted", "true");
  }

  function findFieldElementByCode(root, fieldCode) {
    if (!root || !fieldCode) return null;

    const valueSelector = [
      '.kv-list-field-value[data-field-code="' + cssEscape(fieldCode) + '"]',
      '.kv-detail-field[data-field-code="' + cssEscape(fieldCode) + '"]',
      '.kv-detail-field-value[data-field-code="' + cssEscape(fieldCode) + '"]',
    ].join(", ");

    if (root.matches && root.matches(valueSelector)) {
      return root;
    }

    const valueMatch = root.querySelector(valueSelector);
    if (valueMatch) return valueMatch;

    if (
      root.matches &&
      root.matches('[data-field-code="' + cssEscape(fieldCode) + '"]')
    ) {
      return root;
    }

    return root.querySelector(
      '[data-field-code="' + cssEscape(fieldCode) + '"]',
    );
  }

  function getFieldValueElement(field) {
    if (!field) return null;

    if (
      field.classList.contains("kv-list-field-value") ||
      field.classList.contains("kv-detail-field-value")
    ) {
      return field;
    }

    return field.querySelector(".kv-list-field-value, .kv-detail-field-value");
  }

  function findFieldValueByCode(root, fieldCode) {
    const field = findFieldElementByCode(root, fieldCode);
    if (!field) return "";

    if (field.matches("input, textarea, select")) {
      return normalizeText(field.value);
    }

    const valueElement = getFieldValueElement(field) || field;
    const link = valueElement.querySelector("a[href]");
    if (link) return normalizeText(link.href || link.getAttribute("href"));

    return normalizeText(valueElement.innerText || valueElement.textContent);
  }

  function findPdfDownloadUrl(root) {
    const field = findFieldElementByCode(root, CONFIG.pdfUrlFieldCode);
    if (!field) return "";

    const valueElement = getFieldValueElement(field) || field;
    const candidates = [];

    if (field.matches("input, textarea, select")) {
      candidates.push(field.value);
    }

    valueElement.querySelectorAll("a[href]").forEach((link) => {
      candidates.push(link.getAttribute("href"), link.href);
    });

    candidates.push(valueElement.innerText, valueElement.textContent);

    return candidates.flatMap(extractHttpUrls).find(isGoogleDriveUrl) || "";
  }

  function extractHttpUrls(value) {
    const text = normalizeText(value);
    if (!text) return [];

    return (text.match(/https?:\/\/[^\s"'<>]+/gi) || []).map((url) => {
      try {
        return new URL(url).href;
      } catch (error) {
        return url;
      }
    });
  }

  function extractFirstGoogleDriveUrl(value) {
    return extractHttpUrls(value).find(isGoogleDriveUrl) || "";
  }

  function isGoogleDriveUrl(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return [
        "drive.google.com",
        "docs.google.com",
        "drive.usercontent.google.com",
      ].includes(hostname);
    } catch (error) {
      return false;
    }
  }

  function cleanupLooseActionButtons(detailRoot) {
    const allowedSelectors = [".kv-job-detail-toolbar", "#" + IDS.modal];

    detailRoot
      .querySelectorAll(
        "[data-kv-job-action='detail'], [data-kv-job-action='apply']",
      )
      .forEach((button) => {
        const isAllowed = allowedSelectors.some((selector) => {
          return Boolean(button.closest(selector));
        });

        if (!isAllowed) {
          const wrapper = button.closest(".kv-job-card-actions");
          if (wrapper) {
            wrapper.remove();
          } else {
            button.remove();
          }
        }
      });
  }

  function cleanupMisplacedDetailButtons() {
    document
      .querySelectorAll("aside .kv-job-detail-toolbar")
      .forEach((toolbar) => {
        toolbar
          .querySelectorAll("[data-kv-job-action='apply']")
          .forEach((button) => {
            button.remove();
          });
        toolbar.classList.remove("kv-job-detail-toolbar");
      });
  }

  function findIndexCards() {
    const kviewerRows = Array.from(
      document.querySelectorAll("tr.kv-list-record"),
    );
    if (kviewerRows.length) {
      return kviewerRows.filter((row) => findJobIdInRoot(row));
    }

    const candidates = Array.from(
      document.querySelectorAll(
        "article, li, .card, [class*='card'], [class*='Card'], [class*='record'], [class*='Record']",
      ),
    );

    const cards = candidates.filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.closest("#" + IDS.modal)) return false;
      if (!findJobIdInRoot(element)) return false;

      const rect = element.getBoundingClientRect();
      return rect.width > 160 && rect.height > 120;
    });

    if (cards.length) {
      return removeNestedCards(cards);
    }

    return Array.from(document.body.children).filter((element) => {
      return element instanceof HTMLElement && findJobIdInRoot(element);
    });
  }

  function findIndexActionMount(card) {
    if (card.matches("tr.kv-list-record")) {
      const dl = card.querySelector("td:first-child dl");
      if (!dl) {
        let actionCell = card.querySelector(
          ":scope > td.kv-job-table-action-cell",
        );
        if (!actionCell) {
          actionCell = document.createElement("td");
          actionCell.className = "kv-job-table-action-cell";
          card.appendChild(actionCell);
        }

        return actionCell;
      }

      const table = card.closest("table");
      const tbody = card.closest("tbody");
      const firstCell = card.querySelector("td:first-child");
      if (table) table.classList.add("kv-job-mobile-list-table");
      if (tbody) tbody.classList.add("kv-job-mobile-list-body");
      if (firstCell) firstCell.classList.add("kv-job-mobile-list-cell");

      let actionItem = dl.querySelector(".kv-job-list-action-dd");
      if (!actionItem) {
        actionItem = document.createElement("dd");
        actionItem.className = "kv-job-list-action-dd";
        dl.appendChild(actionItem);
      }

      return actionItem;
    }

    return card;
  }

  function hideNativeDetailArrow(card) {
    if (!card.matches("tr.kv-list-record")) return;

    const cells = Array.from(card.children).filter((child) => {
      return child.tagName === "TD";
    });

    const arrowCell = cells.find((cell) => {
      const text = normalizeText(cell.innerText || cell.textContent);
      const hasSvg = Boolean(cell.querySelector("svg"));
      const hasFieldCode = Boolean(cell.getAttribute("data-field-code"));
      return hasSvg && !text && !hasFieldCode;
    });

    if (arrowCell) {
      arrowCell.classList.add("kv-job-native-arrow-hidden");
    }
  }

  function removeNestedCards(cards) {
    return cards.filter((card) => {
      return !cards.some((other) => other !== card && other.contains(card));
    });
  }

  function findJobIdInRoot(root) {
    const direct = findValueByDataFieldCode(root, CONFIG.jobIdFieldCode);
    if (direct) return direct;

    for (const label of CONFIG.jobIdLabels) {
      const value = findValueByVisibleLabel(root, label);
      if (value) return value;
    }

    const text = normalizeText(root.innerText || root.textContent);
    const match = text.match(/\b20\d{2}-\d{3,}\b/);
    return match ? match[0] : "";
  }

  function findValueByDataFieldCode(root, fieldCode) {
    const field = findFieldElementByCode(root, fieldCode);
    if (!field) return "";

    if (field.matches("input, textarea, select")) {
      return normalizeText(field.value);
    }

    if (
      field.classList.contains("kv-list-field-label") ||
      field.classList.contains("kv-detail-field-label")
    ) {
      const valueElement = findNextMeaningfulElement(field);
      if (valueElement) {
        return (
          findFirstJobIdText(valueElement) ||
          normalizeText(valueElement.innerText || valueElement.textContent)
        );
      }
    }

    const control = field.querySelector("input, textarea, select");
    if (control) {
      return normalizeText(control.value || control.textContent);
    }

    const valueElement = getFieldValueElement(field);

    if (valueElement) {
      return (
        findFirstJobIdText(valueElement) ||
        normalizeText(valueElement.innerText || valueElement.textContent)
      );
    }

    return findFirstJobIdText(field);
  }

  function findValueByVisibleLabel(root, label) {
    const elements = Array.from(
      root.querySelectorAll("div, span, p, dt, th, label"),
    );
    const labelElement = elements.find((element) => {
      return normalizeText(element.innerText || element.textContent) === label;
    });

    if (!labelElement) return "";

    const next = findNextMeaningfulElement(labelElement);
    if (next) {
      const value =
        findFirstJobIdText(next) ||
        normalizeText(next.innerText || next.textContent);
      if (looksLikeJobId(value)) return value;
    }

    const parent = labelElement.parentElement;
    if (parent) {
      const text = normalizeText(parent.innerText || parent.textContent);
      const match = text.match(/\b20\d{2}-\d{3,}\b/);
      if (match) return match[0];
    }

    return "";
  }

  function findNextMeaningfulElement(element) {
    let current = element.nextElementSibling;
    while (current) {
      const text = normalizeText(current.innerText || current.textContent);
      if (text) return current;
      current = current.nextElementSibling;
    }

    const parent = element.parentElement;
    if (!parent) return null;

    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    for (
      let nextIndex = index + 1;
      nextIndex < siblings.length;
      nextIndex += 1
    ) {
      const sibling = siblings[nextIndex];
      const text = normalizeText(sibling.innerText || sibling.textContent);
      if (text) return sibling;
    }

    return null;
  }

  function findFirstJobIdText(root) {
    const text = normalizeText(root.innerText || root.textContent);
    const match = text.match(/\b20\d{2}-\d{3,}\b/);
    return match ? match[0] : "";
  }

  function looksLikeJobId(value) {
    return /\b20\d{2}-\d{3,}\b/.test(normalizeText(value));
  }

  function makeJobCode(jobId) {
    const clean = normalizeText(jobId).replace(/^JOB-/i, "");
    return CONFIG.jobPrefix + clean;
  }

  function createButton(label, variant, iconName) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kv-job-button kv-job-button-" + variant;
    button.innerHTML =
      '<span class="kv-job-button-content">' +
      getActionIcon(iconName || getButtonIconName(label)) +
      '<span class="kv-job-button-label"></span>' +
      "</span>";
    button.querySelector(".kv-job-button-label").textContent = label;
    return button;
  }

  function getButtonIconName(label) {
    const text = normalizeText(label).toUpperCase();
    if (text === "DETAIL") return "detail";
    if (text.includes("DOWNLOAD")) return "download";
    if (text.includes("DAFTAR")) return "send";
    return "";
  }

  function getActionIcon(name) {
    const attrs =
      'xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

    if (name === "back") {
      return (
        "<svg " +
        attrs +
        '><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>'
      );
    }

    if (name === "detail") {
      return (
        "<svg " +
        attrs +
        '><path d="M2.1 12s3.5-7 9.9-7 9.9 7 9.9 7-3.5 7-9.9 7-9.9-7-9.9-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
      );
    }

    if (name === "download") {
      return (
        "<svg " +
        attrs +
        '><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>'
      );
    }

    if (name === "send") {
      return (
        "<svg " +
        attrs +
        '><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>'
      );
    }

    return "";
  }

  function enhanceBackControl(backElement) {
    backElement.classList.add("kv-job-back-button");
    backElement.classList.remove("underline");

    if (backElement.getAttribute("data-kv-job-back-enhanced") === "true") {
      return;
    }

    const label =
      normalizeText(backElement.innerText || backElement.textContent) ||
      "Kembali";
    backElement.innerHTML =
      getActionIcon("back") +
      '<span class="kv-job-back-label"></span>';
    backElement.querySelector(".kv-job-back-label").textContent = label;
    backElement.setAttribute("data-kv-job-back-enhanced", "true");
    backElement.setAttribute("aria-label", label);
  }

  function goToDetail(button) {
    const card =
      button.closest(
        "tr.kv-list-record, article, li, .card, [class*='card'], [class*='Card'], [class*='record'], [class*='Record']",
      ) || button.parentElement;
    const link = findDetailLink(card || document.body);

    if (link) {
      location.href = link.href;
      return;
    }

    const clickable = findClickableDetailTarget(card);
    if (clickable) {
      clickable.click();
      return;
    }

    if (card) {
      card.click();
    }
  }

  function downloadPdf(rawUrl) {
    const url = extractFirstGoogleDriveUrl(rawUrl);
    if (!url) return;

    const downloadUrl = toGoogleDriveDownloadUrl(url);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.download = "";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
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

  function findDetailLink(root) {
    if (!root) return null;

    const links = Array.from(root.querySelectorAll("a[href]"));
    return (
      links.find((link) => {
        return (
          link.href.includes(CONFIG.detailPathPart) ||
          /\/detail\//.test(link.href)
        );
      }) || null
    );
  }

  function findClickableDetailTarget(root) {
    if (!root) return null;

    const candidates = Array.from(
      root.querySelectorAll(
        "a, button, [role='button'], [onclick], [tabindex]",
      ),
    );

    return (
      candidates.find((element) => {
        if (element.closest(".kv-job-card-actions")) return false;
        const text = normalizeText(element.innerText || element.textContent);
        return text === "" || /detail|詳細|›|»|＞|›/i.test(text);
      }) || null
    );
  }

  function findBackElement(root) {
    const scope = root || document.querySelector(".kv-detail") || document;
    const links = Array.from(
      scope.querySelectorAll("a, button, [role='button']"),
    ).filter((element) => !element.matches("[data-kv-job-action]"));

    return (
      links.find((element) => {
        const text = normalizeText(
          element.innerText ||
            element.textContent ||
            element.getAttribute("aria-label"),
        );
        const href = element.getAttribute("href") || "";
        return (
          text === "Kembali" ||
          text === "戻る" ||
          text.toLowerCase() === "back" ||
          (href.includes(CONFIG.listPath) &&
            Boolean(element.closest(".kv-detail")))
        );
      }) || null
    );
  }

  function openApplyModal(jobCode, triggerElement) {
    const cleanJobCode = normalizeText(jobCode);
    if (!cleanJobCode) {
      log("Job Code belum ditemukan.");
      return;
    }

    closeApplyModal();

    const overlay = document.createElement("div");
    overlay.id = IDS.modal;
    overlay.className = "kv-job-modal-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "kv-job-modal-title");

    const dialog = document.createElement("div");
    dialog.className = "kv-job-modal-dialog";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "kv-job-modal-close";
    closeButton.setAttribute("aria-label", "Tutup modal");
    closeButton.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    closeButton.addEventListener("click", closeApplyModal);

    const title = document.createElement("h2");
    title.id = "kv-job-modal-title";
    title.textContent = "Konfirmasi Pendaftaran";

    const intro = document.createElement("p");
    intro.className = "kv-job-modal-text";
    intro.textContent =
      "Sebelum mendaftar, pastikan lowongan pekerjaan ini sesuai dengan minat dan Kamu sudah memenuhi syarat atau kriteria yang diminta.";

    const instructionTitle = document.createElement("div");
    instructionTitle.className = "kv-job-step-title";
    instructionTitle.textContent = "Langkah pendaftaran";

    const instruction = document.createElement("ol");
    instruction.className = "kv-job-step-list";
    [
      "Periksa kembali detail lowongan, terutama kriteria pelamar, lokasi kerja, dan informasi gaji.",
      "Klik tombol DAFTAR KE WHATSAPP.",
      "WhatsApp akan terbuka dengan Job Code yang sudah terisi otomatis.",
      "Kirim Job Code tersebut tanpa menambahkan teks lain.",
      "Tunggu respon dari tim kami, lalu ikuti panduan atau instruksi selanjutnya.",
    ].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      instruction.appendChild(item);
    });

    const codeLabel = document.createElement("div");
    codeLabel.className = "kv-job-code-label";
    codeLabel.textContent = "Job Code";

    const codeButton = document.createElement("button");
    codeButton.type = "button";
    codeButton.className = "kv-job-code-copy";
    codeButton.innerHTML =
      '<span class="kv-job-code-value"></span><span class="kv-job-code-status"><span class="kv-job-code-status-text">Klik untuk salin kode</span><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></span>';
    codeButton.querySelector(".kv-job-code-value").textContent = cleanJobCode;
    codeButton.addEventListener("click", () =>
      copyJobCode(cleanJobCode, codeButton),
    );

    const bottomActions = document.createElement("div");
    bottomActions.className = "kv-job-modal-actions";

    const detailButton = createButton("DETAIL", "secondary");
    detailButton.classList.add("kv-job-modal-detail-button");
    detailButton.addEventListener("click", () => {
      closeApplyModal();
      if (isDetailPage()) return;
      if (triggerElement) {
        window.setTimeout(() => goToDetail(triggerElement), 190);
      }
    });

    const whatsappButton = document.createElement("a");
    whatsappButton.className =
      "kv-job-whatsapp-button kv-job-whatsapp-disabled";
    whatsappButton.href = "#";
    whatsappButton.setAttribute("aria-disabled", "true");
    whatsappButton.textContent =
      "DAFTAR KE WHATSAPP (" + CONFIG.whatsappDelaySeconds + ")";

    if (!isDetailPage()) {
      bottomActions.appendChild(detailButton);
    } else {
      bottomActions.classList.add("kv-job-modal-actions-single");
    }
    bottomActions.appendChild(whatsappButton);

    dialog.append(
      closeButton,
      title,
      intro,
      instructionTitle,
      instruction,
      codeLabel,
      codeButton,
      bottomActions,
    );
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.body.classList.add("kv-job-modal-open");

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        closeApplyModal();
      }
    });

    document.addEventListener("keydown", closeOnEscape);
    startWhatsappCountdown(whatsappButton, cleanJobCode);
    window.requestAnimationFrame(() => {
      overlay.classList.add("kv-job-modal-visible");
      closeButton.focus();
    });
  }

  function startWhatsappCountdown(button, jobCode) {
    let remaining = CONFIG.whatsappDelaySeconds;

    window.clearInterval(state.modalCountdownTimer);
    state.modalCountdownTimer = window.setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        button.textContent = "DAFTAR KE WHATSAPP (" + remaining + ")";
        return;
      }

      window.clearInterval(state.modalCountdownTimer);
      button.textContent = "DAFTAR KE WHATSAPP";
      button.href =
        CONFIG.whatsappBaseUrl + "?text=" + encodeURIComponent(jobCode);
      button.setAttribute("target", "_blank");
      button.setAttribute("rel", "noopener noreferrer");
      button.setAttribute("aria-disabled", "false");
      button.classList.remove("kv-job-whatsapp-disabled");
    }, 1000);
  }

  function closeOnEscape(event) {
    if (event.key === "Escape") {
      closeApplyModal();
    }
  }

  function closeApplyModal() {
    window.clearInterval(state.modalCountdownTimer);
    const modal = document.getElementById(IDS.modal);
    if (modal) {
      modal.classList.remove("kv-job-modal-visible");
      window.setTimeout(() => {
        if (modal.parentElement) modal.remove();
      }, 180);
    }
    document.body.classList.remove("kv-job-modal-open");
    document.removeEventListener("keydown", closeOnEscape);
  }

  async function copyJobCode(jobCode, button) {
    try {
      await navigator.clipboard.writeText(jobCode);
      setCopyStatus(button, "Kode berhasil disalin", true);
    } catch (error) {
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

    try {
      document.execCommand("copy");
      setCopyStatus(button, "Kode berhasil disalin", true);
    } catch (error) {
      setCopyStatus(button, "Copy gagal. Silakan blok kode ini manual.", false);
    }

    input.remove();
  }

  function setCopyStatus(button, message, success) {
    if (!button) return;

    const status = button.querySelector(".kv-job-code-status-text");
    if (!status) return;

    button.classList.toggle("kv-job-code-copied", Boolean(success));
    button.classList.toggle("kv-job-code-copy-failed", !success);
    status.textContent = message;

    window.setTimeout(() => {
      button.classList.remove("kv-job-code-copied", "kv-job-code-copy-failed");
      status.textContent = "Klik untuk salin kode";
    }, 2400);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }

    return String(value).replace(/([ #;?%&,.+*~\\':"!^$[\]()=>|/@])/g, "\\$1");
  }

  function installStyles() {
    let style = document.getElementById(IDS.style);
    if (!style) {
      style = document.createElement("style");
      style.id = IDS.style;
      document.head.appendChild(style);
    }

    style.textContent = `
      .kv-job-card-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin: 16px 0 0 !important;
        padding: 14px 10px 16px !important;
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

      tr.kv-list-record.kv-job-list-card-mobile-enhanced > td:first-child {
        display: block !important;
        width: 100% !important;
        border: 0 !important;
        box-sizing: border-box !important;
      }

      tr.kv-list-record.kv-job-list-card-mobile-enhanced > td:first-child dl {
        padding: 14px 10px 0 !important;
      }

      tr.kv-list-record.kv-job-list-card-mobile-enhanced > td:not(:first-child) {
        display: none !important;
      }

      .kv-job-native-arrow-hidden {
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

      .kv-job-empty-field-hidden {
        display: none !important;
      }

      .kv-job-pdf-url-field-hidden {
        display: none !important;
      }

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
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, color 120ms ease;
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
      .kv-job-whatsapp-button:focus-visible {
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
        transition: transform 120ms ease, border-color 120ms ease, background 120ms ease, color 120ms ease;
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

      .kv-job-detail-toolbar .kv-job-back-button ~ .kv-job-button-primary {
        margin-left: auto;
      }

      .kv-job-detail-toolbar .kv-job-download-pdf-button {
        min-width: 148px;
        margin-left: auto;
      }

      .kv-job-detail-toolbar .kv-job-download-pdf-button + .kv-job-button {
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
          grid-template-columns: minmax(90px, 0.82fr) minmax(150px, 1.35fr);
        }

        .kv-job-detail-toolbar.kv-job-detail-toolbar-has-pdf .kv-job-button-primary {
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

        .kv-job-detail-toolbar .kv-job-back-button ~ .kv-job-button-primary,
        .kv-job-detail-toolbar .kv-job-download-pdf-button,
        .kv-job-detail-toolbar .kv-job-download-pdf-button + .kv-job-button {
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
        transition: opacity 180ms ease, background 180ms ease;
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
        box-shadow: 0 24px 80px rgba(17, 24, 39, 0.24);
        padding: 24px 20px 20px;
        transform: translateY(12px) scale(0.98);
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
        transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
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
        transition: background 140ms ease, border-color 140ms ease;
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

      .kv-job-whatsapp-button {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        width: 100%;
        border-radius: 6px;
        background: #0079d2;
        color: #ffffff !important;
        font-size: 14px;
        font-weight: 900;
        text-decoration: none !important;
        letter-spacing: 0;
      }

      .kv-job-whatsapp-button:hover {
        background: #006bb9;
      }

      .kv-job-modal-actions {
        display: grid;
        grid-template-columns: minmax(110px, 0.62fr) minmax(0, 1.38fr);
        gap: 10px;
        margin-top: 16px;
      }

      .kv-job-modal-actions-single {
        grid-template-columns: 1fr;
      }

      .kv-job-modal-actions .kv-job-button,
      .kv-job-modal-actions .kv-job-whatsapp-button {
        min-height: 46px;
        margin: 0;
      }

      .kv-job-whatsapp-disabled {
        pointer-events: none;
        background: #9ca3af;
        color: #ffffff !important;
        cursor: not-allowed;
      }
    `;
  }
})();
