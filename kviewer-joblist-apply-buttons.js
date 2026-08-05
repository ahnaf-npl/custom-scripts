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
    version: "1.0.0",
    debug: true,

    host: "e-bridge-id.viewer.kintoneapp.com",
    listPath: "/public/sswjoblist",
    detailPathPart: "/public/sswjoblist/detail/",

    jobIdFieldCode: "求人票ID",
    jobIdLabels: ["求人票ID", "Job ID", "Job Id", "JOB ID"],
    jobPrefix: "JOB-",

    whatsappBaseUrl: "https://wa.me/6285258363076",
    whatsappDelaySeconds: 5,

    ipRestriction: {
      enabled: true,
      allowedIps: ["192.168.110.204"],
      allowWhenUnknown: false,
      overrideQueryParam: "kv_test_ip",
      overrideLocalStorageKey: "kv_test_ip",
      publicIpUrls: [
        "https://api.ipify.org?format=json",
        "https://ipinfo.io/ip"
      ],
      timeoutMs: 2500
    },

    mutationDelay: 150,
    periodicDelay: 1500
  };

  const IDS = {
    style: "kv-job-apply-style",
    modal: "kv-job-apply-modal",
    toast: "kv-job-apply-toast"
  };

  const ATTR = {
    cardEnhanced: "data-kv-job-card-enhanced",
    detailEnhanced: "data-kv-job-detail-enhanced"
  };

  const state = {
    accessAllowed: false,
    accessReason: "checking",
    accessIps: [],
    observer: null,
    renderTimer: null,
    intervalId: null,
    modalCountdownTimer: null
  };

  if (!isTargetHost()) {
    return;
  }

  boot();

  async function boot() {
    installStyles();
    state.accessAllowed = await checkAccess();

    if (!state.accessAllowed) {
      log("Script tidak aktif karena IP tidak masuk daftar test.", {
        allowedIps: CONFIG.ipRestriction.allowedIps,
        detectedIps: state.accessIps,
        reason: state.accessReason
      });
      return;
    }

    log("Script aktif.", {
      version: CONFIG.version,
      detectedIps: state.accessIps,
      reason: state.accessReason
    });

    installObserver();
    installGlobalClickGuard();
    scheduleRender("boot");
    state.intervalId = window.setInterval(
      () => scheduleRender("periodic"),
      CONFIG.periodicDelay
    );
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
      "background:#0f766e;color:#fff;font-weight:700;padding:2px 7px;border-radius:4px",
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
      params.get(CONFIG.ipRestriction.overrideQueryParam)
    );

    if (fromUrl) {
      try {
        localStorage.setItem(CONFIG.ipRestriction.overrideLocalStorageKey, fromUrl);
      } catch (error) {
        log("Tidak bisa menyimpan override IP.", error);
      }
      return fromUrl;
    }

    try {
      return normalizeText(
        localStorage.getItem(CONFIG.ipRestriction.overrideLocalStorageKey)
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
          const response = await fetchWithTimeout(url, CONFIG.ipRestriction.timeoutMs);
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
      })
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
      cache: "no-store"
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
          /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
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
      attributes: true,
      attributeFilter: ["class", "style", "href"]
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
          openApplyModal(action.getAttribute("data-kv-job-code") || "");
        }
      },
      true
    );
  }

  function scheduleRender(reason) {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(() => render(reason), CONFIG.mutationDelay);
  }

  function render(reason) {
    if (!document.body) return;

    if (isDetailPage()) {
      enhanceDetailPage();
    } else if (isIndexPage()) {
      enhanceIndexPage();
    }

    log("render", reason);
  }

  function enhanceIndexPage() {
    const cards = findIndexCards();

    cards.forEach((card) => {
      if (card.getAttribute(ATTR.cardEnhanced) === "true") return;

      const jobId = findJobIdInRoot(card);
      if (!jobId) return;

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
      card.setAttribute(ATTR.cardEnhanced, "true");
    });
  }

  function enhanceDetailPage() {
    const jobId = findJobIdInRoot(document.body);
    if (!jobId) return;

    const backElement = findBackElement();
    if (!backElement) return;

    const backField = backElement.closest(".kv-detail-field") || backElement.parentElement;
    const mount =
      backField.querySelector(".kv-detail-field-value") ||
      backElement.parentElement ||
      backField;

    let toolbar = mount.querySelector(".kv-job-detail-toolbar");
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.className = "kv-job-detail-toolbar";

      if (backElement.parentElement !== toolbar) {
        toolbar.appendChild(backElement);
      }

      mount.appendChild(toolbar);
    }

    let applyButton = toolbar.querySelector("[data-kv-job-action='apply']");
    if (!applyButton) {
      applyButton = createButton("DAFTAR", "primary");
      toolbar.appendChild(applyButton);
    }

    applyButton.setAttribute("data-kv-job-action", "apply");
    applyButton.setAttribute("data-kv-job-code", makeJobCode(jobId));

    document.body.setAttribute(ATTR.detailEnhanced, "true");
  }

  function findIndexCards() {
    const kviewerRows = Array.from(document.querySelectorAll("tr.kv-list-record"));
    if (kviewerRows.length) {
      return kviewerRows.filter((row) => findJobIdInRoot(row));
    }

    const candidates = Array.from(
      document.querySelectorAll("article, li, .card, [class*='card'], [class*='Card'], [class*='record'], [class*='Record']")
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
      if (!dl) return null;

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
    const field = root.matches &&
      root.matches('[data-field-code="' + cssEscape(fieldCode) + '"]')
      ? root
      : root.querySelector('[data-field-code="' + cssEscape(fieldCode) + '"]');
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
        return findFirstJobIdText(valueElement) ||
          normalizeText(valueElement.innerText || valueElement.textContent);
      }
    }

    const control = field.querySelector("input, textarea, select");
    if (control) {
      return normalizeText(control.value || control.textContent);
    }

    const valueElement = field.classList.contains("kv-detail-field")
      ? field.querySelector(".kv-detail-field-value")
      : field.classList.contains("kv-list-field-value")
        ? field
        : field.querySelector(".kv-list-field-value, .kv-detail-field-value");

    if (valueElement) {
      return findFirstJobIdText(valueElement) ||
        normalizeText(valueElement.innerText || valueElement.textContent);
    }

    return findFirstJobIdText(field);
  }

  function findValueByVisibleLabel(root, label) {
    const elements = Array.from(root.querySelectorAll("div, span, p, dt, th, label"));
    const labelElement = elements.find((element) => {
      return normalizeText(element.innerText || element.textContent) === label;
    });

    if (!labelElement) return "";

    const next = findNextMeaningfulElement(labelElement);
    if (next) {
      const value = findFirstJobIdText(next) || normalizeText(next.innerText || next.textContent);
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
    for (let nextIndex = index + 1; nextIndex < siblings.length; nextIndex += 1) {
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

  function createButton(label, variant) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kv-job-button kv-job-button-" + variant;
    button.textContent = label;
    return button;
  }

  function goToDetail(button) {
    const card = button.closest("tr.kv-list-record, article, li, .card, [class*='card'], [class*='Card'], [class*='record'], [class*='Record']") || button.parentElement;
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

  function findDetailLink(root) {
    if (!root) return null;

    const links = Array.from(root.querySelectorAll("a[href]"));
    return links.find((link) => {
      return link.href.includes(CONFIG.detailPathPart) || /\/detail\//.test(link.href);
    }) || null;
  }

  function findClickableDetailTarget(root) {
    if (!root) return null;

    const candidates = Array.from(
      root.querySelectorAll("a, button, [role='button'], [onclick], [tabindex]")
    );

    return candidates.find((element) => {
      if (element.closest(".kv-job-card-actions")) return false;
      const text = normalizeText(element.innerText || element.textContent);
      return text === "" || /detail|詳細|›|»|＞|›/i.test(text);
    }) || null;
  }

  function findBackElement() {
    const links = Array.from(document.querySelectorAll("a, button, [role='button']"));

    return links.find((element) => {
      const text = normalizeText(element.innerText || element.textContent || element.getAttribute("aria-label"));
      const href = element.getAttribute("href") || "";
      return (
        text === "Kembali" ||
        text === "戻る" ||
        text.toLowerCase() === "back" ||
        href.includes(CONFIG.listPath)
      );
    }) || null;
  }

  function openApplyModal(jobCode) {
    const cleanJobCode = normalizeText(jobCode);
    if (!cleanJobCode) {
      showToast("Job Code belum ditemukan.");
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
    closeButton.textContent = "x";
    closeButton.addEventListener("click", closeApplyModal);

    const title = document.createElement("h2");
    title.id = "kv-job-modal-title";
    title.textContent = "Konfirmasi Pendaftaran";

    const intro = document.createElement("p");
    intro.className = "kv-job-modal-text";
    intro.textContent =
      "Sebelum melanjutkan ke pendaftaran, pastikan kriteria job sudah sesuai dengan minat Kamu dan kandidat sudah memenuhi syarat job.";

    const instruction = document.createElement("p");
    instruction.className = "kv-job-modal-text";
    instruction.textContent =
      "Klik area Job Code untuk menyalin. Setelah itu klik tombol DAFTAR KE WHATSAPP, lalu kirim Job Code yang sudah terisi otomatis tanpa tambahan teks apapun.";

    const codeLabel = document.createElement("div");
    codeLabel.className = "kv-job-code-label";
    codeLabel.textContent = "Job Code";

    const codeButton = document.createElement("button");
    codeButton.type = "button";
    codeButton.className = "kv-job-code-copy";
    codeButton.textContent = cleanJobCode;
    codeButton.addEventListener("click", () => copyJobCode(cleanJobCode));

    const whatsappButton = document.createElement("a");
    whatsappButton.className = "kv-job-whatsapp-button kv-job-whatsapp-disabled";
    whatsappButton.href = "#";
    whatsappButton.setAttribute("aria-disabled", "true");
    whatsappButton.textContent =
      "DAFTAR KE WHATSAPP (" + CONFIG.whatsappDelaySeconds + ")";

    dialog.append(
      closeButton,
      title,
      intro,
      instruction,
      codeLabel,
      codeButton,
      whatsappButton
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
    closeButton.focus();
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
      button.href = CONFIG.whatsappBaseUrl + "?text=" + encodeURIComponent(jobCode);
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
    if (modal) modal.remove();
    document.body.classList.remove("kv-job-modal-open");
    document.removeEventListener("keydown", closeOnEscape);
  }

  async function copyJobCode(jobCode) {
    try {
      await navigator.clipboard.writeText(jobCode);
      showToast("Job Code berhasil disalin.");
    } catch (error) {
      fallbackCopy(jobCode);
    }
  }

  function fallbackCopy(text) {
    const input = document.createElement("textarea");
    input.value = text;
    input.setAttribute("readonly", "readonly");
    input.style.position = "fixed";
    input.style.top = "-1000px";
    document.body.appendChild(input);
    input.select();

    try {
      document.execCommand("copy");
      showToast("Job Code berhasil disalin.");
    } catch (error) {
      showToast("Tidak bisa copy otomatis. Silakan copy manual.");
    }

    input.remove();
  }

  function showToast(message) {
    let toast = document.getElementById(IDS.toast);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = IDS.toast;
      toast.className = "kv-job-toast";
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("kv-job-toast-show");
    window.setTimeout(() => {
      toast.classList.remove("kv-job-toast-show");
    }, 2200);
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }

    return String(value).replace(/([ #;?%&,.+*~\\':"!^$[\]()=>|/@])/g, "\\$1");
  }

  function installStyles() {
    if (document.getElementById(IDS.style)) return;

    const style = document.createElement("style");
    style.id = IDS.style;
    style.textContent = `
      .kv-job-card-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid #e5e7eb;
      }

      .kv-job-list-action-dd {
        display: block;
        margin: 0;
        padding: 0 0 8px;
      }

      .kv-job-button {
        appearance: none;
        border: 0;
        border-radius: 6px;
        min-height: 42px;
        padding: 10px 12px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0;
        line-height: 1;
        cursor: pointer;
        transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
      }

      .kv-job-button:active {
        transform: translateY(1px);
      }

      .kv-job-button:focus-visible,
      .kv-job-code-copy:focus-visible,
      .kv-job-modal-close:focus-visible,
      .kv-job-whatsapp-button:focus-visible {
        outline: 3px solid rgba(37, 99, 235, 0.38);
        outline-offset: 2px;
      }

      .kv-job-button-primary {
        background: #0f766e;
        color: #ffffff;
        box-shadow: 0 8px 18px rgba(15, 118, 110, 0.2);
      }

      .kv-job-button-secondary {
        background: #ffffff;
        color: #111827;
        border: 1px solid #d1d5db;
      }

      .kv-job-detail-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        width: 100%;
        margin: 0;
      }

      .kv-job-detail-toolbar > *:first-child {
        margin: 0 !important;
      }

      .kv-job-detail-toolbar .kv-job-button {
        min-width: 118px;
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
        background: rgba(17, 24, 39, 0.54);
      }

      .kv-job-modal-dialog {
        position: relative;
        width: min(100%, 430px);
        max-height: calc(100vh - 36px);
        overflow-y: auto;
        border-radius: 8px;
        background: #ffffff;
        color: #111827;
        box-shadow: 0 24px 80px rgba(17, 24, 39, 0.28);
        padding: 24px 18px 18px;
      }

      .kv-job-modal-close {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 6px;
        background: #f3f4f6;
        color: #111827;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }

      .kv-job-modal-dialog h2 {
        margin: 0 38px 14px 0;
        font-size: 20px;
        line-height: 1.25;
        letter-spacing: 0;
      }

      .kv-job-modal-text {
        margin: 0 0 12px;
        color: #374151;
        font-size: 14px;
        line-height: 1.6;
      }

      .kv-job-code-label {
        margin: 18px 0 7px;
        font-size: 12px;
        font-weight: 800;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 0;
      }

      .kv-job-code-copy {
        width: 100%;
        border: 1px dashed #0f766e;
        border-radius: 6px;
        background: #ecfdf5;
        color: #064e3b;
        padding: 14px 12px;
        font-size: 20px;
        font-weight: 900;
        letter-spacing: 0;
        cursor: pointer;
        overflow-wrap: anywhere;
      }

      .kv-job-whatsapp-button {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        margin-top: 16px;
        border-radius: 6px;
        background: #16a34a;
        color: #ffffff !important;
        font-size: 14px;
        font-weight: 900;
        text-decoration: none !important;
        letter-spacing: 0;
      }

      .kv-job-whatsapp-disabled {
        pointer-events: none;
        background: #9ca3af;
        color: #ffffff !important;
        cursor: not-allowed;
      }

      .kv-job-toast {
        position: fixed;
        left: 50%;
        bottom: 18px;
        z-index: 2147483001;
        transform: translate(-50%, 18px);
        opacity: 0;
        max-width: calc(100vw - 32px);
        border-radius: 6px;
        background: #111827;
        color: #ffffff;
        padding: 10px 14px;
        font-size: 13px;
        font-weight: 700;
        text-align: center;
        transition: opacity 160ms ease, transform 160ms ease;
      }

      .kv-job-toast-show {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    `;

    document.head.appendChild(style);
  }
})();
