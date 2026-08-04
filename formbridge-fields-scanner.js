/**
 * ============================================================
 * FormBridge New Version — Advanced Preview Scanner
 * ============================================================
 *
 * Versi: 2.0.0
 *
 * Fungsi utama:
 * - Scan field FormBridge versi terbaru.
 * - Mendukung Headless UI Combobox/Listbox.
 * - Membuka dropdown dan mengambil seluruh opsi.
 * - Deduplikasi field berdasarkan fieldCode.
 * - Mendeteksi halaman seperti "1ページ目 / 全5ページ".
 * - Menangani perubahan conditional branch.
 * - Menyimpan hasil lintas halaman.
 * - Menyediakan export JSON dan translation template.
 *
 * Script hanya aktif di:
 * https://formbridge.kintoneapp.com/private/...
 *
 * PENTING:
 * - Script tidak menekan tombol Submit.
 * - Script tidak menerjemahkan teks.
 * - Script hanya melakukan scan.
 * - Mode branch explorer dapat mengubah pilihan sementara,
 *   lalu mencoba mengembalikan pilihan awal.
 */

(function () {
  "use strict";

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    name: "FB Advanced Preview Scanner",
    version: "2.0.0",

    allowedHostname: "formbridge.kintoneapp.com",
    allowedPathPrefix: "/private/",

    initialDelay: 1000,
    mutationScanDelay: 450,
    dropdownOpenDelay: 450,
    dropdownCloseDelay: 250,
    branchRenderDelay: 800,
    navigationDelay: 1200,

    fallbackScanInterval: 4000,

    showPanel: true,
    debug: true,

    /**
     * Jika true, elemen tersembunyi tidak dimasukkan sebagai field aktif.
     * Data yang pernah terlihat tetap tersimpan di hasil keseluruhan.
     */
    visibleOnly: true,

    /**
     * Maksimum opsi yang dicoba saat branch exploration.
     * Naikkan jika diperlukan.
     */
    maxBranchOptionsPerField: 30,

    /**
     * Jangan otomatis menekan tombol yang memiliki teks ini.
     */
    forbiddenNavigationTexts: [
      "送信",
      "Submit",
      "Kirim",
      "Simpan",
      "登録",
      "完了",
      "Confirm",
      "確認"
    ],

    nextButtonTexts: [
      "次へ",
      "Berikutnya",
      "Selanjutnya",
      "Next",
      "Lanjut"
    ],

    previousButtonTexts: [
      "戻る",
      "前へ",
      "Kembali",
      "Sebelumnya",
      "Back"
    ]
  };

  // ============================================================
  // CONSTANTS
  // ============================================================

  const PANEL_ID = "fb-advanced-scanner-panel";
  const STYLE_ID = "fb-advanced-scanner-style";

  const JAPANESE_REGEX =
    /[\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

  // ============================================================
  // STATE
  // ============================================================

  const STATE = {
    initialized: false,
    busy: false,
    observer: null,
    mutationTimer: null,
    fallbackIntervalId: null,

    scanCount: 0,
    dropdownScanCount: 0,
    branchScanCount: 0,

    currentPage: null,
    totalPages: null,

    fields: new Map(),
    genericTexts: new Map(),
    buttons: new Map(),
    pages: new Map(),
    dropdowns: new Map(),
    branchStates: new Map(),

    renderedIdsByField: new Map(),

    latestResult: null,
    lastPageSignature: "",
    statusMessage: ""
  };

  // ============================================================
  // ENVIRONMENT CHECK
  // ============================================================

  function isAllowedPage() {
    return (
      window.location.hostname === CONFIG.allowedHostname &&
      window.location.pathname.startsWith(CONFIG.allowedPathPrefix)
    );
  }

  if (!isAllowedPage()) {
    console.info(
      `[${CONFIG.name}] Tidak dijalankan karena bukan halaman preview/private FormBridge.`,
      {
        hostname: window.location.hostname,
        pathname: window.location.pathname
      }
    );

    return;
  }

  // ============================================================
  // LOGGING
  // ============================================================

  function log(...args) {
    if (!CONFIG.debug) return;

    console.log(
      `%c[${CONFIG.name}]`,
      [
        "background:#2563eb",
        "color:#ffffff",
        "font-weight:700",
        "padding:2px 7px",
        "border-radius:4px"
      ].join(";"),
      ...args
    );
  }

  function warn(...args) {
    console.warn(`[${CONFIG.name}]`, ...args);
  }

  function error(...args) {
    console.error(`[${CONFIG.name}]`, ...args);
  }

  // ============================================================
  // GENERAL UTILITIES
  // ============================================================

  function sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  function normalizeText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/\u00a0/g, " ")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniqueStrings(values) {
    return [
      ...new Set(
        values
          .map(normalizeText)
          .filter(Boolean)
      )
    ];
  }

  function containsJapanese(value) {
    return JAPANESE_REGEX.test(normalizeText(value));
  }

  function detectLanguages(value) {
    const text = normalizeText(value);

    return {
      hasJapanese: containsJapanese(text),
      hasLatin: /[A-Za-z]/.test(text),
      hasNumber: /[0-9]/.test(text)
    };
  }

  function simpleHash(value) {
    const text = String(value);
    let hash = 0;

    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(index);
      hash |= 0;
    }

    return Math.abs(hash).toString(36);
  }

  function cssEscape(value) {
    if (
      window.CSS &&
      typeof window.CSS.escape === "function"
    ) {
      return window.CSS.escape(String(value));
    }

    return String(value).replace(
      /([ #;?%&,.+*~\\':"!^$[\]()=>|/@])/g,
      "\\$1"
    );
  }

  function isGeneratedReactId(value) {
    const text = normalizeText(value);

    if (!text) return false;

    return /^_r_[a-z0-9]+_?$/i.test(text);
  }

  function isElementVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    if (element.hidden) return false;

    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const style = window.getComputedStyle(element);

    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width > 0 || rect.height > 0;
  }

  function isScannerElement(element) {
    return Boolean(
      element instanceof Element &&
      element.closest(`#${PANEL_ID}`)
    );
  }

  function getElementText(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    if (element instanceof HTMLInputElement) {
      if (
        ["button", "submit", "reset"].includes(element.type)
      ) {
        return normalizeText(element.value);
      }
    }

    return normalizeText(
      element.innerText ||
      element.textContent ||
      element.getAttribute("aria-label") ||
      element.getAttribute("title")
    );
  }

  function getOwnText(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    const parts = [];

    element.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = normalizeText(node.textContent);

        if (text) {
          parts.push(text);
        }
      }
    });

    return normalizeText(parts.join(" "));
  }

  function getElementPath(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    const parts = [];
    let current = element;
    let depth = 0;

    while (
      current &&
      current !== document.body &&
      depth < 7
    ) {
      let part = current.tagName.toLowerCase();

      const role = current.getAttribute("role");

      if (role) {
        part += `[role="${role}"]`;
      }

      if (
        current.id &&
        !isGeneratedReactId(current.id)
      ) {
        part += `#${current.id}`;
        parts.unshift(part);
        break;
      }

      const stableClasses = Array.from(current.classList)
        .filter((className) => {
          if (!className) return false;
          if (/^_/.test(className)) return false;
          if (/[0-9]{5,}/.test(className)) return false;

          return ![
            "active",
            "selected",
            "focused",
            "focus",
            "open",
            "closed",
            "visible",
            "hidden"
          ].includes(className);
        })
        .slice(0, 2);

      if (stableClasses.length) {
        part += `.${stableClasses.join(".")}`;
      }

      const parent = current.parentElement;

      if (parent) {
        const sameTags = Array.from(parent.children)
          .filter((child) => child.tagName === current.tagName);

        if (sameTags.length > 1) {
          part += `:nth-of-type(${
            sameTags.indexOf(current) + 1
          })`;
        }
      }

      parts.unshift(part);
      current = current.parentElement;
      depth += 1;
    }

    return parts.join(" > ");
  }

  function dispatchInputEvents(element) {
    element.dispatchEvent(
      new Event("input", {
        bubbles: true
      })
    );

    element.dispatchEvent(
      new Event("change", {
        bubbles: true
      })
    );
  }

  // ============================================================
  // PAGE DETECTION
  // ============================================================

  function detectPageInfo() {
    let currentPage = null;
    let totalPages = null;

    const visibleElements = Array.from(
      document.querySelectorAll(
        "span, div, p, strong"
      )
    ).filter((element) => {
      return (
        !isScannerElement(element) &&
        isElementVisible(element)
      );
    });

    for (const element of visibleElements) {
      const text = normalizeText(
        element.textContent
      );

      if (!text || text.length > 40) continue;

      let match = text.match(/^(\d+)\s*ページ目$/);

      if (match) {
        currentPage = Number(match[1]);
      }

      match = text.match(/^全\s*(\d+)\s*ページ$/);

      if (match) {
        totalPages = Number(match[1]);
      }

      match = text.match(
        /^Page\s*(\d+)\s*(?:of|\/)\s*(\d+)$/i
      );

      if (match) {
        currentPage = Number(match[1]);
        totalPages = Number(match[2]);
      }

      match = text.match(
        /^Halaman\s*(\d+)\s*(?:dari|\/)\s*(\d+)$/i
      );

      if (match) {
        currentPage = Number(match[1]);
        totalPages = Number(match[2]);
      }
    }

    return {
      currentPage,
      totalPages,
      pageKey:
        currentPage !== null
          ? `page-${currentPage}`
          : "page-unknown"
    };
  }

  // ============================================================
  // FIELD CONTAINER
  // ============================================================

  function findFieldContainer(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    const directFieldCode = element.closest(
      "[data-field-code]"
    );

    if (directFieldCode) {
      return directFieldCode;
    }

    const selectors = [
      "[data-testid*='field']",
      "[class*='field-wrapper']",
      "[class*='fieldWrapper']",
      "[class*='field-container']",
      "[class*='fieldContainer']",
      "[class*='form-field']",
      "[class*='FormField']",
      "fieldset",
      ".grid.grid-cols-1 > div",
      "table td"
    ];

    for (const selector of selectors) {
      const container = element.closest(selector);

      if (
        container &&
        !isScannerElement(container)
      ) {
        const fieldCodeElement =
          container.querySelector("[data-field-code]");

        if (
          fieldCodeElement ||
          container.querySelector(
            "input, textarea, [role='combobox'], select"
          )
        ) {
          return container;
        }
      }
    }

    let current = element.parentElement;
    let depth = 0;

    while (current && depth < 6) {
      const controls = current.querySelectorAll(
        [
          "input:not([type='hidden'])",
          "textarea",
          "select",
          "[role='combobox']"
        ].join(",")
      );

      const labels = current.querySelectorAll(
        "label, legend"
      );

      if (
        controls.length >= 1 &&
        labels.length >= 1
      ) {
        return current;
      }

      current = current.parentElement;
      depth += 1;
    }

    return element.parentElement;
  }

  function getFieldCode(element, container) {
    const candidates = [
      element,
      container,
      element.closest("[data-field-code]")
    ].filter(Boolean);

    for (const candidate of candidates) {
      const fieldCode = normalizeText(
        candidate.getAttribute("data-field-code") ||
        candidate.dataset?.fieldCode
      );

      if (fieldCode) {
        return fieldCode;
      }
    }

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      const name = normalizeText(element.name);

      if (name && !isGeneratedReactId(name)) {
        return name;
      }

      const id = normalizeText(element.id);

      if (id && !isGeneratedReactId(id)) {
        return id;
      }
    }

    if (container) {
      const controlWithCode = container.querySelector(
        "[data-field-code]"
      );

      if (controlWithCode) {
        const code = normalizeText(
          controlWithCode.getAttribute(
            "data-field-code"
          )
        );

        if (code) return code;
      }

      const namedControl = container.querySelector(
        "input[name], textarea[name], select[name]"
      );

      if (namedControl) {
        const name = normalizeText(
          namedControl.getAttribute("name")
        );

        if (name && !isGeneratedReactId(name)) {
          return name;
        }
      }
    }

    return "";
  }

  function findFieldLabel(element, container) {
    const candidates = [];

    const id = normalizeText(element.id);

    if (id) {
      const externalLabel = document.querySelector(
        `label[for="${cssEscape(id)}"]`
      );

      if (
        externalLabel &&
        isElementVisible(externalLabel)
      ) {
        candidates.push(getElementText(externalLabel));
      }
    }

    const wrappingLabel = element.closest("label");

    if (
      wrappingLabel &&
      isElementVisible(wrappingLabel)
    ) {
      const clone = wrappingLabel.cloneNode(true);

      clone
        .querySelectorAll(
          "input, textarea, select, button, svg"
        )
        .forEach((child) => child.remove());

      candidates.push(
        normalizeText(clone.textContent)
      );
    }

    const ariaLabel = normalizeText(
      element.getAttribute("aria-label")
    );

    if (ariaLabel) {
      candidates.push(ariaLabel);
    }

    const labelledBy = normalizeText(
      element.getAttribute("aria-labelledby")
    );

    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((labelId) => {
        const labelElement =
          document.getElementById(labelId);

        if (labelElement) {
          candidates.push(
            getElementText(labelElement)
          );
        }
      });
    }

    if (container) {
      const labelSelectors = [
        "label.text-form-base",
        "label",
        "legend",
        "[class*='font-bold'] label",
        "[class*='label']",
        "[class*='Label']"
      ];

      for (const selector of labelSelectors) {
        const found = Array.from(
          container.querySelectorAll(selector)
        ).find((candidate) => {
          return (
            isElementVisible(candidate) &&
            !candidate.closest("[role='option']")
          );
        });

        if (found) {
          candidates.push(
            getElementText(found)
          );

          break;
        }
      }
    }

    return (
      uniqueStrings(candidates)
        .map((text) =>
          normalizeText(
            text.replace(/\s*\*+\s*$/, "")
          )
        )
        .find(Boolean) || ""
    );
  }

  function getDescription(container) {
    if (!container) return [];

    const selectors = [
      ".text-role-description",
      "[class*='description']",
      "[class*='Description']",
      "[class*='help']",
      "[class*='Help']",
      "small"
    ];

    const results = [];

    selectors.forEach((selector) => {
      container
        .querySelectorAll(selector)
        .forEach((element) => {
          if (!isElementVisible(element)) return;

          const text = getElementText(element);

          if (text) {
            results.push(text);
          }
        });
    });

    return uniqueStrings(results);
  }

  // ============================================================
  // CONTROL TYPE
  // ============================================================

  function detectControlType(element) {
    if (element.matches("[role='combobox']")) {
      return "combobox";
    }

    if (element instanceof HTMLSelectElement) {
      return element.multiple
        ? "multi-select"
        : "select";
    }

    if (element instanceof HTMLTextAreaElement) {
      return "textarea";
    }

    if (element instanceof HTMLInputElement) {
      return element.type || "text";
    }

    return element.tagName.toLowerCase();
  }

  // ============================================================
  // FIELD IDENTITY
  // ============================================================

  function createFieldIdentity({
    fieldCode,
    label,
    type,
    container,
    element
  }) {
    if (fieldCode) {
      return `field-code:${fieldCode}`;
    }

    const name = normalizeText(
      element.getAttribute("name")
    );

    if (
      name &&
      !isGeneratedReactId(name)
    ) {
      return `field-name:${name}`;
    }

    const stableId = normalizeText(element.id);

    if (
      stableId &&
      !isGeneratedReactId(stableId)
    ) {
      return `field-id:${stableId}`;
    }

    const containerPath = getElementPath(container);

    return [
      "field-fallback",
      normalizeText(label),
      normalizeText(type),
      containerPath
    ].join(":");
  }

  // ============================================================
  // NATIVE OPTIONS
  // ============================================================

  function getNativeSelectOptions(select) {
    return Array.from(select.options).map(
      (option, index) => ({
        key: `option-${simpleHash(
          `${option.value}::${option.textContent}`
        )}`,
        index,
        text: normalizeText(option.textContent),
        value: option.value,
        selected: option.selected,
        disabled: option.disabled,
        source: "native-select",
        languages: detectLanguages(
          option.textContent
        )
      })
    );
  }

  function getRadioCheckboxOptions(
    input,
    container
  ) {
    if (
      !(input instanceof HTMLInputElement) ||
      !["radio", "checkbox"].includes(input.type)
    ) {
      return [];
    }

    if (input.closest("[role='option']")) {
      return [];
    }

    const root = container || input.parentElement;
    const inputName = normalizeText(input.name);

    let group = [];

    if (inputName) {
      group = Array.from(
        root.querySelectorAll(
          `input[type="${input.type}"][name="${cssEscape(
            inputName
          )}"]`
        )
      );
    }

    if (!group.length) {
      group = Array.from(
        root.querySelectorAll(
          `input[type="${input.type}"]`
        )
      ).filter(
        (candidate) =>
          !candidate.closest("[role='option']")
      );
    }

    return group.map((candidate, index) => {
      const optionLabel = findFieldLabel(
        candidate,
        candidate.closest("label") ||
          candidate.parentElement
      );

      return {
        key: `option-${simpleHash(
          `${candidate.value}::${optionLabel}`
        )}`,
        index,
        text: optionLabel,
        value: candidate.value,
        selected: candidate.checked,
        disabled: candidate.disabled,
        source: input.type,
        languages: detectLanguages(optionLabel)
      };
    });
  }

  // ============================================================
  // HEADLESS UI DROPDOWN SUPPORT
  // ============================================================

  function getComboboxes() {
    return Array.from(
      document.querySelectorAll(
        [
          "[role='combobox']",
          "button[aria-haspopup='listbox']",
          "[aria-controls][aria-expanded]"
        ].join(",")
      )
    ).filter((element) => {
      if (isScannerElement(element)) return false;
      if (!isElementVisible(element)) return false;

      const role = element.getAttribute("role");
      const hasPopup =
        element.getAttribute("aria-haspopup");

      return (
        role === "combobox" ||
        hasPopup === "listbox" ||
        Boolean(
          element.getAttribute("aria-controls")
        )
      );
    });
  }

  function getControlledListbox(combobox) {
    const controlsId = normalizeText(
      combobox.getAttribute("aria-controls")
    );

    if (controlsId) {
      const controlled =
        document.getElementById(controlsId);

      if (
        controlled &&
        (
          controlled.getAttribute("role") ===
            "listbox" ||
          controlled.querySelector(
            "[role='option']"
          )
        )
      ) {
        return controlled;
      }
    }

    const labelledBy = normalizeText(
      combobox.getAttribute("aria-labelledby")
    );

    const openListboxes = Array.from(
      document.querySelectorAll(
        "[role='listbox']"
      )
    ).filter(isElementVisible);

    if (openListboxes.length === 1) {
      return openListboxes[0];
    }

    if (labelledBy) {
      const matching = openListboxes.find(
        (listbox) => {
          const listboxLabelledBy = normalizeText(
            listbox.getAttribute(
              "aria-labelledby"
            )
          );

          return (
            listboxLabelledBy &&
            listboxLabelledBy === labelledBy
          );
        }
      );

      if (matching) return matching;
    }

    return (
      openListboxes[openListboxes.length - 1] ||
      null
    );
  }

  function isComboboxOpen(combobox) {
    return (
      combobox.getAttribute("aria-expanded") ===
      "true"
    );
  }

  async function openCombobox(combobox) {
    if (isComboboxOpen(combobox)) {
      await sleep(CONFIG.dropdownOpenDelay);

      return getControlledListbox(combobox);
    }

    combobox.scrollIntoView({
      behavior: "auto",
      block: "center"
    });

    combobox.click();

    await sleep(CONFIG.dropdownOpenDelay);

    return getControlledListbox(combobox);
  }

  async function closeCombobox(combobox) {
    if (!isComboboxOpen(combobox)) return;

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true
      })
    );

    await sleep(CONFIG.dropdownCloseDelay);

    if (isComboboxOpen(combobox)) {
      combobox.click();
      await sleep(CONFIG.dropdownCloseDelay);
    }
  }

  function extractOptionText(optionElement) {
    if (!(optionElement instanceof Element)) {
      return "";
    }

    const preferredSelectors = [
      "[data-option-label]",
      "label span",
      "label",
      "span",
      "div"
    ];

    for (const selector of preferredSelectors) {
      const candidates = Array.from(
        optionElement.querySelectorAll(selector)
      );

      for (const candidate of candidates) {
        if (
          candidate.matches(
            "input, svg, button"
          )
        ) {
          continue;
        }

        const text = getElementText(candidate);

        if (
          text &&
          text !== "*" &&
          text.length <= 500
        ) {
          return text;
        }
      }
    }

    const clone = optionElement.cloneNode(true);

    clone
      .querySelectorAll(
        "input, button, svg, script, style"
      )
      .forEach((element) => element.remove());

    return normalizeText(clone.textContent);
  }

  function extractListboxOptions(listbox) {
    if (!listbox) return [];

    const optionElements = Array.from(
      listbox.querySelectorAll(
        [
          "[role='option']",
          "li[id*='listbox-option']"
        ].join(",")
      )
    );

    return optionElements
      .map((optionElement, index) => {
        const checkbox =
          optionElement.querySelector(
            "input[type='checkbox'], input[type='radio']"
          );

        const text = extractOptionText(
          optionElement
        );

        const value = normalizeText(
          optionElement.getAttribute(
            "data-value"
          ) ||
          optionElement.getAttribute("value") ||
          checkbox?.value ||
          text
        );

        const selected =
          optionElement.getAttribute(
            "aria-selected"
          ) === "true" ||
          optionElement.getAttribute(
            "aria-checked"
          ) === "true" ||
          Boolean(checkbox?.checked);

        const disabled =
          optionElement.getAttribute(
            "aria-disabled"
          ) === "true" ||
          Boolean(checkbox?.disabled);

        return {
          key: `option-${simpleHash(
            `${value}::${text}`
          )}`,
          index,
          text,
          value,
          selected,
          disabled,
          source: "headlessui-listbox",
          optionElementId:
            normalizeText(optionElement.id),
          languages: detectLanguages(text)
        };
      })
      .filter((option) => option.text);
  }

  async function scanSingleCombobox(
    combobox,
    index
  ) {
    const container = findFieldContainer(
      combobox
    );

    const fieldCode = getFieldCode(
      combobox,
      container
    );

    const label = findFieldLabel(
      combobox,
      container
    );

    const identity = createFieldIdentity({
      fieldCode,
      label,
      type: "combobox",
      container,
      element: combobox
    });

    const listbox = await openCombobox(
      combobox
    );

    const options = extractListboxOptions(
      listbox
    );

    const dropdownResult = {
      key: identity,
      fieldCode,
      label,
      type: "combobox",
      index,
      options,
      page: STATE.currentPage,
      containerPath: getElementPath(container),
      comboboxPath: getElementPath(combobox),
      ariaControls: normalizeText(
        combobox.getAttribute("aria-controls")
      ),
      scannedAt: new Date().toISOString()
    };

    mergeDropdown(dropdownResult);

    await closeCombobox(combobox);

    return dropdownResult;
  }

  async function scanAllDropdowns() {
    if (STATE.busy) {
      setStatus(
        "Scanner sedang menjalankan proses lain."
      );

      return STATE.latestResult;
    }

    STATE.busy = true;
    setStatus("Memindai seluruh dropdown...");

    try {
      const comboboxes = getComboboxes();

      log(
        `Menemukan ${comboboxes.length} combobox pada halaman aktif.`
      );

      for (
        let index = 0;
        index < comboboxes.length;
        index += 1
      ) {
        const combobox = comboboxes[index];

        setStatus(
          `Memindai dropdown ${
            index + 1
          } dari ${comboboxes.length}...`
        );

        try {
          await scanSingleCombobox(
            combobox,
            index
          );
        } catch (scanError) {
          warn(
            "Gagal memindai dropdown.",
            scanError,
            combobox
          );

          try {
            await closeCombobox(combobox);
          } catch {
            // Abaikan.
          }
        }
      }

      STATE.dropdownScanCount += 1;

      await scanCurrentPage(
        "dropdown-scan-complete"
      );

      setStatus(
        `Selesai: ${comboboxes.length} dropdown dipindai.`
      );

      return STATE.latestResult;
    } finally {
      STATE.busy = false;
    }
  }

  // ============================================================
  // FIELD SCANNER
  // ============================================================

  function getCandidateControls() {
    const candidates = Array.from(
      document.querySelectorAll(
        [
          "input:not([type='hidden'])",
          "textarea",
          "select",
          "[role='combobox']",
          "button[aria-haspopup='listbox']"
        ].join(",")
      )
    );

    const seenRadioGroups = new Set();

    return candidates.filter((element) => {
      if (isScannerElement(element)) {
        return false;
      }

      if (
        CONFIG.visibleOnly &&
        !isElementVisible(element)
      ) {
        return false;
      }

      /**
       * Checkbox/radio yang berada di dalam listbox bukan field.
       */
      if (element.closest("[role='option']")) {
        return false;
      }

      if (
        element instanceof HTMLInputElement &&
        ["radio", "checkbox"].includes(
          element.type
        )
      ) {
        const container =
          findFieldContainer(element);

        const fieldCode = getFieldCode(
          element,
          container
        );

        const groupKey = [
          element.type,
          fieldCode,
          normalizeText(element.name),
          getElementPath(container)
        ].join("::");

        if (seenRadioGroups.has(groupKey)) {
          return false;
        }

        seenRadioGroups.add(groupKey);
      }

      return true;
    });
  }

  function extractField(element, index) {
    const container = findFieldContainer(
      element
    );

    const fieldCode = getFieldCode(
      element,
      container
    );

    const label = findFieldLabel(
      element,
      container
    );

    const type = detectControlType(element);

    const identity = createFieldIdentity({
      fieldCode,
      label,
      type,
      container,
      element
    });

    let options = [];

    if (element instanceof HTMLSelectElement) {
      options = getNativeSelectOptions(element);
    }

    if (
      element instanceof HTMLInputElement &&
      ["radio", "checkbox"].includes(
        element.type
      )
    ) {
      options = getRadioCheckboxOptions(
        element,
        container
      );
    }

    const dropdown =
      STATE.dropdowns.get(identity);

    if (
      dropdown &&
      dropdown.options?.length
    ) {
      options = mergeOptions(
        options,
        dropdown.options
      );
    }

    const rawId = normalizeText(element.id);

    const renderedIds =
      STATE.renderedIdsByField.get(identity) ||
      new Set();

    if (rawId) {
      renderedIds.add(rawId);
      STATE.renderedIdsByField.set(
        identity,
        renderedIds
      );
    }

    return {
      key: identity,
      index,
      fieldCode,
      label,
      type,

      placeholder: normalizeText(
        element.getAttribute("placeholder")
      ),

      description: getDescription(container),

      required:
        Boolean(element.required) ||
        element.getAttribute(
          "aria-required"
        ) === "true" ||
        Boolean(
          container?.querySelector(
            ".text-role-error"
          )
        ),

      disabled:
        Boolean(element.disabled) ||
        element.getAttribute(
          "aria-disabled"
        ) === "true",

      readonly:
        Boolean(element.readOnly) ||
        element.getAttribute(
          "aria-readonly"
        ) === "true",

      visible: isElementVisible(element),

      options,

      identifiers: {
        fieldCode,
        name: normalizeText(
          element.getAttribute("name")
        ),
        id:
          rawId &&
          !isGeneratedReactId(rawId)
            ? rawId
            : "",
        renderedId: rawId,
        ariaControls: normalizeText(
          element.getAttribute(
            "aria-controls"
          )
        ),
        ariaLabelledBy: normalizeText(
          element.getAttribute(
            "aria-labelledby"
          )
        )
      },

      languages: {
        label: detectLanguages(label),
        placeholder: detectLanguages(
          element.getAttribute("placeholder")
        ),
        descriptions: getDescription(
          container
        ).map(detectLanguages)
      },

      page: STATE.currentPage,

      dom: {
        tagName:
          element.tagName.toLowerCase(),
        inputType:
          element instanceof HTMLInputElement
            ? element.type
            : "",
        path: getElementPath(element),
        containerPath:
          getElementPath(container)
      },

      scannedAt: new Date().toISOString()
    };
  }

  // ============================================================
  // OPTION MERGING
  // ============================================================

  function mergeOptions(
    existingOptions,
    newOptions
  ) {
    const map = new Map();

    [
      ...(existingOptions || []),
      ...(newOptions || [])
    ].forEach((option) => {
      const key = [
        normalizeText(option.value),
        normalizeText(option.text)
      ].join("::");

      if (!map.has(key)) {
        map.set(key, {
          ...option
        });
      } else {
        map.set(key, {
          ...map.get(key),
          ...option
        });
      }
    });

    return Array.from(map.values());
  }

  function mergeDropdown(dropdown) {
    const existing =
      STATE.dropdowns.get(dropdown.key);

    if (!existing) {
      STATE.dropdowns.set(
        dropdown.key,
        dropdown
      );

      return;
    }

    STATE.dropdowns.set(dropdown.key, {
      ...existing,
      ...dropdown,
      options: mergeOptions(
        existing.options,
        dropdown.options
      )
    });
  }

  // ============================================================
  // FIELD MERGING
  // ============================================================

  function mergeField(field) {
    const existing = STATE.fields.get(
      field.key
    );

    const renderedIds = Array.from(
      STATE.renderedIdsByField.get(
        field.key
      ) || []
    );

    if (!existing) {
      STATE.fields.set(field.key, {
        ...field,
        renderedIds,
        seenOnPages:
          field.page !== null
            ? [field.page]
            : [],
        firstSeenAt:
          new Date().toISOString(),
        lastSeenAt:
          new Date().toISOString()
      });

      return;
    }

    STATE.fields.set(field.key, {
      ...existing,
      ...field,

      label:
        field.label ||
        existing.label,

      fieldCode:
        field.fieldCode ||
        existing.fieldCode,

      placeholder:
        field.placeholder ||
        existing.placeholder,

      description: uniqueStrings([
        ...(existing.description || []),
        ...(field.description || [])
      ]),

      options: mergeOptions(
        existing.options,
        field.options
      ),

      renderedIds,

      seenOnPages: [
        ...new Set([
          ...(existing.seenOnPages || []),
          ...(field.page !== null
            ? [field.page]
            : [])
        ])
      ].sort((a, b) => a - b),

      firstSeenAt:
        existing.firstSeenAt,

      lastSeenAt:
        new Date().toISOString()
    });
  }

  // ============================================================
  // GENERIC TEXT SCANNER
  // ============================================================

  function scanGenericTexts() {
    const selectors = [
      "h1",
      "h2",
      "h3",
      "h4",
      "legend",
      "label",
      "p",
      "span",
      "small",
      "th",
      ".text-role-description",
      ".lexical-html"
    ];

    const results = [];
    const seen = new Set();

    document
      .querySelectorAll(selectors.join(","))
      .forEach((element) => {
        if (isScannerElement(element)) return;
        if (!isElementVisible(element)) return;
        if (element.closest("[role='option']")) {
          return;
        }

        let text = getOwnText(element);

        if (
          !text &&
          element.children.length <= 1
        ) {
          text = getElementText(element);
        }

        if (!text || text === "*") {
          return;
        }

        if (text.length > 1000) {
          return;
        }

        const key = [
          text,
          getElementPath(element)
        ].join("::");

        if (seen.has(key)) return;

        seen.add(key);

        results.push({
          key: `text:${simpleHash(key)}`,
          text,
          hasJapanese:
            containsJapanese(text),
          languages:
            detectLanguages(text),
          page: STATE.currentPage,
          tagName:
            element.tagName.toLowerCase(),
          path: getElementPath(element)
        });
      });

    return results;
  }

  function mergeGenericText(item) {
    const existing =
      STATE.genericTexts.get(item.key);

    if (!existing) {
      STATE.genericTexts.set(item.key, {
        ...item,
        seenOnPages:
          item.page !== null
            ? [item.page]
            : []
      });

      return;
    }

    STATE.genericTexts.set(item.key, {
      ...existing,
      ...item,
      seenOnPages: [
        ...new Set([
          ...(existing.seenOnPages || []),
          ...(item.page !== null
            ? [item.page]
            : [])
        ])
      ].sort((a, b) => a - b)
    });
  }

  // ============================================================
  // BUTTON SCANNER
  // ============================================================

  function scanButtons() {
    const results = [];
    const seen = new Set();

    document
      .querySelectorAll(
        [
          "button",
          "input[type='button']",
          "input[type='submit']",
          "input[type='reset']",
          "[role='button']"
        ].join(",")
      )
      .forEach((element) => {
        if (isScannerElement(element)) return;
        if (!isElementVisible(element)) return;

        const text = getElementText(element);

        if (!text) return;

        const path = getElementPath(element);
        const key = `${text}::${path}`;

        if (seen.has(key)) return;

        seen.add(key);

        results.push({
          key: `button:${simpleHash(key)}`,
          text,
          hasJapanese:
            containsJapanese(text),
          languages:
            detectLanguages(text),
          page: STATE.currentPage,
          disabled:
            Boolean(element.disabled) ||
            element.getAttribute(
              "aria-disabled"
            ) === "true",
          type:
            element.getAttribute("type") ||
            element.getAttribute("role") ||
            element.tagName.toLowerCase(),
          path
        });
      });

    return results;
  }

  function mergeButton(item) {
    const existing =
      STATE.buttons.get(item.key);

    if (!existing) {
      STATE.buttons.set(item.key, {
        ...item,
        seenOnPages:
          item.page !== null
            ? [item.page]
            : []
      });

      return;
    }

    STATE.buttons.set(item.key, {
      ...existing,
      ...item,
      seenOnPages: [
        ...new Set([
          ...(existing.seenOnPages || []),
          ...(item.page !== null
            ? [item.page]
            : [])
        ])
      ].sort((a, b) => a - b)
    });
  }

  // ============================================================
  // PAGE SNAPSHOT
  // ============================================================

  function createPageSignature(fields) {
    return JSON.stringify(
      fields
        .map((field) => ({
          key: field.key,
          options: field.options.map(
            (option) => option.text
          )
        }))
        .sort((a, b) =>
          a.key.localeCompare(b.key)
        )
    );
  }

  function savePageSnapshot(
    fields,
    texts,
    buttons,
    reason
  ) {
    const pageInfo = detectPageInfo();

    const pageKey = pageInfo.pageKey;

    const existing =
      STATE.pages.get(pageKey);

    const snapshot = {
      pageKey,
      pageNumber:
        pageInfo.currentPage,
      totalPages:
        pageInfo.totalPages,
      fieldKeys:
        fields.map((field) => field.key),
      textKeys:
        texts.map((item) => item.key),
      buttonKeys:
        buttons.map((item) => item.key),
      signature:
        createPageSignature(fields),
      lastReason: reason,
      firstSeenAt:
        existing?.firstSeenAt ||
        new Date().toISOString(),
      lastSeenAt:
        new Date().toISOString()
    };

    STATE.pages.set(pageKey, {
      ...existing,
      ...snapshot
    });
  }

  // ============================================================
  // MAIN PAGE SCAN
  // ============================================================

  async function scanCurrentPage(
    reason = "manual"
  ) {
    const pageInfo = detectPageInfo();

    STATE.currentPage =
      pageInfo.currentPage;

    STATE.totalPages =
      pageInfo.totalPages;

    const controls = getCandidateControls();

    const fields = controls.map(
      (element, index) =>
        extractField(element, index)
    );

    const texts = scanGenericTexts();
    const buttons = scanButtons();

    fields.forEach(mergeField);
    texts.forEach(mergeGenericText);
    buttons.forEach(mergeButton);

    savePageSnapshot(
      fields,
      texts,
      buttons,
      reason
    );

    STATE.scanCount += 1;

    const pageSignature =
      createPageSignature(fields);

    const changed =
      pageSignature !==
      STATE.lastPageSignature;

    STATE.lastPageSignature =
      pageSignature;

    STATE.latestResult =
      buildFinalResult();

    updatePanel();

    if (
      changed ||
      reason === "manual" ||
      reason.includes("complete")
    ) {
      log(
        `Scan #${STATE.scanCount}`,
        {
          reason,
          currentPage:
            STATE.currentPage,
          totalPages:
            STATE.totalPages,
          visibleFields:
            fields.length,
          totalFields:
            STATE.fields.size,
          dropdowns:
            STATE.dropdowns.size,
          result:
            STATE.latestResult
        }
      );

      console.groupCollapsed(
        `[${CONFIG.name}] Page ${
          STATE.currentPage ?? "unknown"
        }`
      );

      console.table(
        fields.map((field) => ({
          fieldCode:
            field.fieldCode,
          label:
            field.label,
          type:
            field.type,
          options:
            field.options.length,
          page:
            field.page
        }))
      );

      console.groupEnd();
    }

    return STATE.latestResult;
  }

  function schedulePageScan(reason) {
    window.clearTimeout(
      STATE.mutationTimer
    );

    STATE.mutationTimer =
      window.setTimeout(() => {
        if (!STATE.busy) {
          scanCurrentPage(reason).catch(
            error
          );
        }
      }, CONFIG.mutationScanDelay);
  }

  // ============================================================
  // CONDITIONAL BRANCH EXPLORATION
  // ============================================================

  function getBranchCandidateGroups() {
    const groups = [];

    /**
     * Radio groups.
     */
    const radioMap = new Map();

    document
      .querySelectorAll(
        "input[type='radio']:not([disabled])"
      )
      .forEach((radio) => {
        if (isScannerElement(radio)) return;
        if (!isElementVisible(radio)) return;
        if (radio.closest("[role='option']")) {
          return;
        }

        const container =
          findFieldContainer(radio);

        const fieldCode = getFieldCode(
          radio,
          container
        );

        const key =
          fieldCode ||
          radio.name ||
          getElementPath(container);

        if (!radioMap.has(key)) {
          radioMap.set(key, {
            type: "radio",
            key,
            fieldCode,
            label: findFieldLabel(
              radio,
              container
            ),
            elements: [],
            container
          });
        }

        radioMap.get(key).elements.push(
          radio
        );
      });

    radioMap.forEach((group) => {
      if (group.elements.length > 1) {
        groups.push(group);
      }
    });

    /**
     * Native select.
     */
    document
      .querySelectorAll("select:not([disabled])")
      .forEach((select) => {
        if (!isElementVisible(select)) return;

        const container =
          findFieldContainer(select);

        groups.push({
          type: "select",
          key:
            getFieldCode(
              select,
              container
            ) ||
            select.name ||
            getElementPath(select),
          fieldCode: getFieldCode(
            select,
            container
          ),
          label: findFieldLabel(
            select,
            container
          ),
          element: select,
          container
        });
      });

    return groups;
  }

  async function exploreRadioGroup(group) {
    const originalCheckedIndex =
      group.elements.findIndex(
        (element) => element.checked
      );

    const max = Math.min(
      group.elements.length,
      CONFIG.maxBranchOptionsPerField
    );

    for (
      let index = 0;
      index < max;
      index += 1
    ) {
      const radio = group.elements[index];

      if (radio.disabled) continue;

      radio.scrollIntoView({
        behavior: "auto",
        block: "center"
      });

      radio.click();
      dispatchInputEvents(radio);

      await sleep(CONFIG.branchRenderDelay);

      await scanCurrentPage(
        `branch-radio:${group.key}:${index}`
      );
    }

    if (originalCheckedIndex >= 0) {
      const original =
        group.elements[
          originalCheckedIndex
        ];

      original.click();
      dispatchInputEvents(original);

      await sleep(CONFIG.branchRenderDelay);

      await scanCurrentPage(
        `branch-radio-restore:${group.key}`
      );
    }
  }

  async function exploreNativeSelect(group) {
    const select = group.element;

    const originalValues = Array.from(
      select.options
    )
      .filter((option) => option.selected)
      .map((option) => option.value);

    const validOptions = Array.from(
      select.options
    )
      .filter(
        (option) =>
          !option.disabled &&
          normalizeText(option.textContent)
      )
      .slice(
        0,
        CONFIG.maxBranchOptionsPerField
      );

    for (const option of validOptions) {
      if (select.multiple) {
        Array.from(select.options).forEach(
          (candidate) => {
            candidate.selected = false;
          }
        );
      }

      option.selected = true;
      select.value = option.value;

      dispatchInputEvents(select);

      await sleep(CONFIG.branchRenderDelay);

      await scanCurrentPage(
        `branch-select:${group.key}:${option.value}`
      );
    }

    Array.from(select.options).forEach(
      (option) => {
        option.selected =
          originalValues.includes(
            option.value
          );
      }
    );

    if (!select.multiple) {
      select.value =
        originalValues[0] || "";
    }

    dispatchInputEvents(select);

    await sleep(CONFIG.branchRenderDelay);

    await scanCurrentPage(
      `branch-select-restore:${group.key}`
    );
  }

  async function exploreCurrentPageBranches() {
    if (STATE.busy) {
      setStatus(
        "Scanner sedang menjalankan proses lain."
      );

      return;
    }

    STATE.busy = true;

    try {
      setStatus(
        "Memindai dropdown sebelum eksplorasi cabang..."
      );

      /**
       * Jalankan pemindaian dropdown tanpa memakai fungsi pembungkus
       * yang memeriksa STATE.busy.
       */
      const comboboxes = getComboboxes();

      for (
        let index = 0;
        index < comboboxes.length;
        index += 1
      ) {
        try {
          await scanSingleCombobox(
            comboboxes[index],
            index
          );
        } catch (comboboxError) {
          warn(
            "Gagal memindai combobox sebelum branch exploration.",
            comboboxError
          );
        }
      }

      const groups =
        getBranchCandidateGroups();

      setStatus(
        `Menemukan ${groups.length} kelompok cabang.`
      );

      for (
        let index = 0;
        index < groups.length;
        index += 1
      ) {
        const group = groups[index];

        setStatus(
          `Eksplorasi cabang ${
            index + 1
          } dari ${groups.length}: ${
            group.label ||
            group.fieldCode ||
            group.key
          }`
        );

        try {
          if (group.type === "radio") {
            await exploreRadioGroup(group);
          }

          if (group.type === "select") {
            await exploreNativeSelect(group);
          }
        } catch (branchError) {
          warn(
            "Gagal mengeksplorasi cabang.",
            group,
            branchError
          );
        }
      }

      STATE.branchScanCount += 1;

      await scanCurrentPage(
        "branch-exploration-complete"
      );

      setStatus(
        "Eksplorasi cabang halaman aktif selesai."
      );
    } finally {
      STATE.busy = false;
    }
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  function isForbiddenNavigationButton(
    element
  ) {
    const text = getElementText(element);

    return CONFIG.forbiddenNavigationTexts.some(
      (forbidden) =>
        text
          .toLowerCase()
          .includes(
            forbidden.toLowerCase()
          )
    );
  }

  function findNavigationButton(direction) {
    const expectedTexts =
      direction === "next"
        ? CONFIG.nextButtonTexts
        : CONFIG.previousButtonTexts;

    const candidates = Array.from(
      document.querySelectorAll(
        [
          "button",
          "input[type='button']",
          "input[type='submit']",
          "[role='button']"
        ].join(",")
      )
    ).filter((element) => {
      if (isScannerElement(element)) {
        return false;
      }

      if (!isElementVisible(element)) {
        return false;
      }

      if (
        element.disabled ||
        element.getAttribute(
          "aria-disabled"
        ) === "true"
      ) {
        return false;
      }

      if (
        isForbiddenNavigationButton(
          element
        )
      ) {
        return false;
      }

      return true;
    });

    return candidates.find((element) => {
      const text =
        getElementText(element).toLowerCase();

      return expectedTexts.some(
        (expected) =>
          text === expected.toLowerCase() ||
          text.includes(
            expected.toLowerCase()
          )
      );
    }) || null;
  }

  async function goToNextPage() {
    if (STATE.busy) {
      setStatus(
        "Scanner sedang menjalankan proses lain."
      );

      return false;
    }

    STATE.busy = true;

    try {
      await scanCurrentPage(
        "before-next-page"
      );

      const previousPage =
        STATE.currentPage;

      const button =
        findNavigationButton("next");

      if (!button) {
        setStatus(
          "Tombol Next tidak ditemukan atau masih disabled."
        );

        return false;
      }

      if (
        isForbiddenNavigationButton(
          button
        )
      ) {
        setStatus(
          "Navigasi dibatalkan karena tombol terdeteksi sebagai Submit/Confirm."
        );

        return false;
      }

      setStatus(
        "Mencoba pindah ke halaman berikutnya..."
      );

      button.click();

      await sleep(CONFIG.navigationDelay);

      await scanCurrentPage(
        "after-next-page"
      );

      if (
        previousPage !== null &&
        STATE.currentPage === previousPage
      ) {
        setStatus(
          "Halaman tidak berubah. Kemungkinan masih ada validasi field wajib."
        );

        return false;
      }

      setStatus(
        `Berhasil berpindah ke halaman ${
          STATE.currentPage ?? "berikutnya"
        }.`
      );

      return true;
    } finally {
      STATE.busy = false;
    }
  }

  async function goToPreviousPage() {
    if (STATE.busy) {
      setStatus(
        "Scanner sedang menjalankan proses lain."
      );

      return false;
    }

    STATE.busy = true;

    try {
      const button =
        findNavigationButton("previous");

      if (!button) {
        setStatus(
          "Tombol Back tidak ditemukan."
        );

        return false;
      }

      button.click();

      await sleep(CONFIG.navigationDelay);

      await scanCurrentPage(
        "after-previous-page"
      );

      setStatus(
        `Kembali ke halaman ${
          STATE.currentPage ?? "sebelumnya"
        }.`
      );

      return true;
    } finally {
      STATE.busy = false;
    }
  }

  async function scanAndGoNext() {
    if (STATE.busy) {
      setStatus(
        "Scanner sedang menjalankan proses lain."
      );

      return;
    }

    setStatus(
      "Memindai halaman aktif..."
    );

    await scanCurrentPage(
      "scan-and-next-start"
    );

    await scanAllDropdowns();

    await goToNextPage();
  }

  // ============================================================
  // AUTO WALK
  // ============================================================

  async function autoWalkAvailablePages() {
    if (STATE.busy) {
      setStatus(
        "Scanner sedang menjalankan proses lain."
      );

      return;
    }

    let safetyCounter = 0;
    const maximumPages =
      STATE.totalPages || 20;

    while (
      safetyCounter < maximumPages
    ) {
      safetyCounter += 1;

      const pageBefore =
        detectPageInfo().currentPage;

      await scanCurrentPage(
        "auto-walk-page"
      );

      await scanAllDropdowns();

      const moved =
        await goToNextPage();

      if (!moved) {
        setStatus(
          "Auto walk berhenti. Isi field wajib jika ingin melanjutkan."
        );

        break;
      }

      const pageAfter =
        detectPageInfo().currentPage;

      if (
        pageBefore !== null &&
        pageAfter !== null &&
        pageAfter <= pageBefore
      ) {
        setStatus(
          "Auto walk dihentikan karena halaman tidak bertambah."
        );

        break;
      }

      if (
        STATE.totalPages &&
        pageAfter === STATE.totalPages
      ) {
        await scanCurrentPage(
          "auto-walk-last-page"
        );

        await scanAllDropdowns();

        setStatus(
          "Auto walk mencapai halaman terakhir. Submit tidak ditekan."
        );

        break;
      }
    }
  }

  // ============================================================
  // RESULT BUILDER
  // ============================================================

  function buildTranslationTemplate() {
    const template = {
      labelsByFieldCode: {},
      placeholdersByFieldCode: {},
      descriptionsByFieldCode: {},
      optionsByFieldCode: {},
      genericTexts: {},
      buttons: {}
    };

    Array.from(STATE.fields.values())
      .sort((a, b) =>
        (
          a.fieldCode ||
          a.label ||
          a.key
        ).localeCompare(
          b.fieldCode ||
          b.label ||
          b.key
        )
      )
      .forEach((field) => {
        const fieldKey =
          field.fieldCode ||
          field.key;

        if (
          field.label &&
          containsJapanese(field.label)
        ) {
          template.labelsByFieldCode[
            fieldKey
          ] = {
            source: field.label,
            translation: ""
          };
        }

        if (
          field.placeholder &&
          containsJapanese(
            field.placeholder
          )
        ) {
          template.placeholdersByFieldCode[
            fieldKey
          ] = {
            source:
              field.placeholder,
            translation: ""
          };
        }

        const japaneseDescriptions =
          (field.description || []).filter(
            containsJapanese
          );

        if (
          japaneseDescriptions.length
        ) {
          template.descriptionsByFieldCode[
            fieldKey
          ] = japaneseDescriptions.map(
            (source) => ({
              source,
              translation: ""
            })
          );
        }

        const japaneseOptions =
          (field.options || []).filter(
            (option) =>
              option.text &&
              containsJapanese(option.text)
          );

        if (japaneseOptions.length) {
          template.optionsByFieldCode[
            fieldKey
          ] = {
            fieldLabel:
              field.label,
            options: {}
          };

          japaneseOptions.forEach(
            (option) => {
              template.optionsByFieldCode[
                fieldKey
              ].options[option.text] = {
                translation: "",
                originalValue:
                  option.value
              };
            }
          );
        }
      });

    Array.from(
      STATE.genericTexts.values()
    )
      .filter(
        (item) =>
          item.hasJapanese &&
          !/^\d+\s*ページ目$/.test(
            item.text
          ) &&
          !/^全\s*\d+\s*ページ$/.test(
            item.text
          )
      )
      .forEach((item) => {
        template.genericTexts[
          item.text
        ] = "";
      });

    Array.from(STATE.buttons.values())
      .filter(
        (button) =>
          button.hasJapanese
      )
      .forEach((button) => {
        template.buttons[
          button.text
        ] = "";
      });

    return template;
  }

  function buildFinalResult() {
    const fields = Array.from(
      STATE.fields.values()
    );

    const dropdowns = Array.from(
      STATE.dropdowns.values()
    );

    const genericTexts = Array.from(
      STATE.genericTexts.values()
    );

    const buttons = Array.from(
      STATE.buttons.values()
    );

    const pages = Array.from(
      STATE.pages.values()
    ).sort((a, b) => {
      return (
        (a.pageNumber || 999) -
        (b.pageNumber || 999)
      );
    });

    const totalOptions =
      fields.reduce(
        (total, field) =>
          total +
          (field.options?.length || 0),
        0
      );

    const japaneseOptions =
      fields.reduce(
        (total, field) =>
          total +
          (
            field.options || []
          ).filter((option) =>
            containsJapanese(option.text)
          ).length,
        0
      );

    const japaneseFields =
      fields.filter((field) => {
        return (
          containsJapanese(
            field.label
          ) ||
          containsJapanese(
            field.placeholder
          ) ||
          (
            field.description || []
          ).some(containsJapanese) ||
          (
            field.options || []
          ).some((option) =>
            containsJapanese(option.text)
          )
        );
      });

    return {
      metadata: {
        scanner:
          CONFIG.name,
        scannerVersion:
          CONFIG.version,
        generatedAt:
          new Date().toISOString(),
        pageUrl:
          window.location.href,
        hostname:
          window.location.hostname,
        pathname:
          window.location.pathname,
        scanCount:
          STATE.scanCount,
        dropdownScanCount:
          STATE.dropdownScanCount,
        branchScanCount:
          STATE.branchScanCount,
        currentPage:
          STATE.currentPage,
        totalPages:
          STATE.totalPages,
        userAgent:
          navigator.userAgent
      },

      summary: {
        pagesDiscovered:
          pages.length,
        totalFields:
          fields.length,
        japaneseFields:
          japaneseFields.length,
        totalDropdowns:
          dropdowns.length,
        totalOptions,
        japaneseOptions,
        genericTexts:
          genericTexts.length,
        japaneseGenericTexts:
          genericTexts.filter(
            (item) =>
              item.hasJapanese
          ).length,
        buttons:
          buttons.length,
        japaneseButtons:
          buttons.filter(
            (button) =>
              button.hasJapanese
          ).length
      },

      pages,
      fields,
      japaneseFields,
      dropdowns,
      genericTexts,
      buttons,

      translationTemplate:
        buildTranslationTemplate()
    };
  }

  // ============================================================
  // EXPORT
  // ============================================================

  async function copyJson(data) {
    const json = JSON.stringify(
      data,
      null,
      2
    );

    try {
      await navigator.clipboard.writeText(
        json
      );

      setStatus(
        "JSON berhasil disalin."
      );
    } catch (clipboardError) {
      warn(
        "Clipboard API gagal.",
        clipboardError
      );

      const textarea =
        document.createElement("textarea");

      textarea.value = json;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";

      document.body.appendChild(
        textarea
      );

      textarea.select();

      const success =
        document.execCommand("copy");

      textarea.remove();

      setStatus(
        success
          ? "JSON berhasil disalin."
          : "Gagal menyalin JSON."
      );
    }
  }

  function downloadJson(
    data,
    filenamePrefix
  ) {
    const content = JSON.stringify(
      data,
      null,
      2
    );

    const blob = new Blob(
      [content],
      {
        type: "application/json;charset=utf-8"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    const timestamp =
      new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    anchor.href = url;
    anchor.download =
      `${filenamePrefix}-${timestamp}.json`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    setStatus(
      "File JSON berhasil di-download."
    );
  }

  // ============================================================
  // RESET
  // ============================================================

  async function resetData() {
    STATE.fields.clear();
    STATE.genericTexts.clear();
    STATE.buttons.clear();
    STATE.pages.clear();
    STATE.dropdowns.clear();
    STATE.branchStates.clear();
    STATE.renderedIdsByField.clear();

    STATE.scanCount = 0;
    STATE.dropdownScanCount = 0;
    STATE.branchScanCount = 0;

    STATE.latestResult = null;
    STATE.lastPageSignature = "";

    await scanCurrentPage("reset");

    setStatus(
      "Data scanner berhasil di-reset."
    );
  }

  // ============================================================
  // MUTATION OBSERVER
  // ============================================================

  function startMutationObserver() {
    if (STATE.observer) {
      STATE.observer.disconnect();
    }

    STATE.observer =
      new MutationObserver(
        (mutations) => {
          if (STATE.busy) return;

          const relevant =
            mutations.some((mutation) => {
              if (
                mutation.target instanceof
                  Element &&
                isScannerElement(
                  mutation.target
                )
              ) {
                return false;
              }

              if (
                mutation.type ===
                "childList"
              ) {
                return (
                  mutation.addedNodes
                    .length > 0 ||
                  mutation.removedNodes
                    .length > 0
                );
              }

              if (
                mutation.type ===
                "attributes"
              ) {
                return [
                  "class",
                  "style",
                  "hidden",
                  "aria-hidden",
                  "aria-expanded",
                  "aria-selected",
                  "aria-checked",
                  "disabled"
                ].includes(
                  mutation.attributeName
                );
              }

              return false;
            });

          if (relevant) {
            schedulePageScan(
              "mutation"
            );
          }
        }
      );

    STATE.observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          "class",
          "style",
          "hidden",
          "aria-hidden",
          "aria-expanded",
          "aria-selected",
          "aria-checked",
          "disabled"
        ]
      }
    );
  }

  // ============================================================
  // EVENT LISTENERS
  // ============================================================

  function startEventListeners() {
    document.addEventListener(
      "change",
      (event) => {
        if (
          event.target instanceof Element &&
          !isScannerElement(event.target)
        ) {
          schedulePageScan(
            "change-event"
          );
        }
      },
      true
    );

    document.addEventListener(
      "input",
      (event) => {
        if (
          event.target instanceof Element &&
          !isScannerElement(event.target)
        ) {
          schedulePageScan(
            "input-event"
          );
        }
      },
      true
    );

    document.addEventListener(
      "click",
      (event) => {
        const target =
          event.target instanceof Element
            ? event.target.closest(
                "button, [role='button'], [role='combobox'], input, label"
              )
            : null;

        if (
          !target ||
          isScannerElement(target)
        ) {
          return;
        }

        window.setTimeout(() => {
          schedulePageScan(
            "click-event"
          );
        }, 300);

        window.setTimeout(() => {
          schedulePageScan(
            "click-event-delayed"
          );
        }, 1000);
      },
      true
    );
  }

  // ============================================================
  // PANEL UI
  // ============================================================

  function setStatus(message) {
    STATE.statusMessage = message;
    updatePanel();

    log(message);
  }

  function addPanelStyles() {
    if (
      document.getElementById(
        STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        width: 380px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        overflow: hidden;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        background: #ffffff;
        color: #0f172a;
        box-shadow:
          0 20px 30px rgba(15, 23, 42, 0.18),
          0 8px 12px rgba(15, 23, 42, 0.10);
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
        font-size: 12px;
        line-height: 1.45;
      }

      #${PANEL_ID},
      #${PANEL_ID} * {
        box-sizing: border-box;
      }

      #${PANEL_ID} .fbaps-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
      }

      #${PANEL_ID} .fbaps-title {
        font-weight: 700;
        font-size: 13px;
      }

      #${PANEL_ID} .fbaps-badge {
        display: inline-flex;
        margin-left: 5px;
        padding: 2px 6px;
        border-radius: 999px;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 10px;
        font-weight: 700;
      }

      #${PANEL_ID} .fbaps-body {
        max-height: 520px;
        overflow-y: auto;
        padding: 12px;
      }

      #${PANEL_ID} .fbaps-page {
        margin-bottom: 10px;
        padding: 8px;
        border-radius: 8px;
        background: #f1f5f9;
      }

      #${PANEL_ID} .fbaps-summary {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 7px;
        margin-bottom: 10px;
      }

      #${PANEL_ID} .fbaps-card {
        padding: 7px;
        border: 1px solid #e2e8f0;
        border-radius: 7px;
        background: #ffffff;
      }

      #${PANEL_ID} .fbaps-card-label {
        display: block;
        color: #64748b;
        font-size: 9px;
      }

      #${PANEL_ID} .fbaps-card-value {
        display: block;
        margin-top: 1px;
        font-size: 16px;
        font-weight: 700;
      }

      #${PANEL_ID} .fbaps-section-title {
        margin: 10px 0 6px;
        color: #475569;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      #${PANEL_ID} .fbaps-actions {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 7px;
      }

      #${PANEL_ID} .fbaps-button {
        min-height: 34px;
        margin: 0;
        padding: 6px 8px;
        border: 1px solid #cbd5e1;
        border-radius: 7px;
        background: #ffffff;
        color: #0f172a;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      #${PANEL_ID} .fbaps-button:hover {
        background: #f1f5f9;
      }

      #${PANEL_ID} .fbaps-button-primary {
        border-color: #2563eb;
        background: #2563eb;
        color: #ffffff;
      }

      #${PANEL_ID} .fbaps-button-primary:hover {
        background: #1d4ed8;
      }

      #${PANEL_ID} .fbaps-button-warning {
        border-color: #d97706;
        background: #fffbeb;
        color: #92400e;
      }

      #${PANEL_ID} .fbaps-button-danger {
        border-color: #dc2626;
        color: #b91c1c;
      }

      #${PANEL_ID} .fbaps-full {
        grid-column: 1 / -1;
      }

      #${PANEL_ID} .fbaps-status {
        min-height: 42px;
        margin-top: 10px;
        padding: 8px;
        border-radius: 7px;
        background: #f8fafc;
        color: #334155;
        word-break: break-word;
      }

      #${PANEL_ID} .fbaps-footer {
        padding: 7px 12px;
        border-top: 1px solid #e2e8f0;
        background: #f8fafc;
        color: #64748b;
        font-size: 9px;
      }

      #${PANEL_ID}.fbaps-collapsed {
        width: auto;
      }

      #${PANEL_ID}.fbaps-collapsed .fbaps-body,
      #${PANEL_ID}.fbaps-collapsed .fbaps-footer {
        display: none;
      }

      @media (prefers-color-scheme: dark) {
        #${PANEL_ID} {
          border-color: #334155;
          background: #0f172a;
          color: #e2e8f0;
        }

        #${PANEL_ID} .fbaps-header,
        #${PANEL_ID} .fbaps-footer {
          border-color: #334155;
          background: #1e293b;
        }

        #${PANEL_ID} .fbaps-page,
        #${PANEL_ID} .fbaps-status {
          background: #1e293b;
          color: #e2e8f0;
        }

        #${PANEL_ID} .fbaps-card,
        #${PANEL_ID} .fbaps-button {
          border-color: #475569;
          background: #0f172a;
          color: #e2e8f0;
        }

        #${PANEL_ID} .fbaps-button:hover {
          background: #1e293b;
        }

        #${PANEL_ID} .fbaps-button-primary {
          border-color: #2563eb;
          background: #2563eb;
          color: #ffffff;
        }

        #${PANEL_ID} .fbaps-button-warning {
          border-color: #d97706;
          background: #422006;
          color: #fde68a;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createPanel() {
    if (!CONFIG.showPanel) return;

    addPanelStyles();

    if (
      document.getElementById(
        PANEL_ID
      )
    ) {
      return;
    }

    const panel =
      document.createElement("aside");

    panel.id = PANEL_ID;

    panel.innerHTML = `
      <div class="fbaps-header">
        <div>
          <span class="fbaps-title">
            FormBridge Scanner
          </span>
          <span class="fbaps-badge">
            V2 PREVIEW
          </span>
        </div>

        <button
          type="button"
          class="fbaps-button"
          data-fbaps-action="toggle"
          style="min-height:27px;padding:2px 8px;"
        >
          −
        </button>
      </div>

      <div class="fbaps-body">
        <div class="fbaps-page">
          Halaman:
          <strong data-fbaps-value="page">-</strong>
          /
          <strong data-fbaps-value="totalPages">-</strong>

          <br>

          Scan:
          <strong data-fbaps-value="scanCount">0</strong>
        </div>

        <div class="fbaps-summary">
          <div class="fbaps-card">
            <span class="fbaps-card-label">
              Fields
            </span>
            <span
              class="fbaps-card-value"
              data-fbaps-value="fields"
            >
              0
            </span>
          </div>

          <div class="fbaps-card">
            <span class="fbaps-card-label">
              Dropdowns
            </span>
            <span
              class="fbaps-card-value"
              data-fbaps-value="dropdowns"
            >
              0
            </span>
          </div>

          <div class="fbaps-card">
            <span class="fbaps-card-label">
              Options
            </span>
            <span
              class="fbaps-card-value"
              data-fbaps-value="options"
            >
              0
            </span>
          </div>

          <div class="fbaps-card">
            <span class="fbaps-card-label">
              JP Fields
            </span>
            <span
              class="fbaps-card-value"
              data-fbaps-value="jpFields"
            >
              0
            </span>
          </div>

          <div class="fbaps-card">
            <span class="fbaps-card-label">
              JP Options
            </span>
            <span
              class="fbaps-card-value"
              data-fbaps-value="jpOptions"
            >
              0
            </span>
          </div>

          <div class="fbaps-card">
            <span class="fbaps-card-label">
              Pages
            </span>
            <span
              class="fbaps-card-value"
              data-fbaps-value="pages"
            >
              0
            </span>
          </div>
        </div>

        <div class="fbaps-section-title">
          Scan halaman aktif
        </div>

        <div class="fbaps-actions">
          <button
            type="button"
            class="fbaps-button fbaps-button-primary"
            data-fbaps-action="scan-page"
          >
            Scan halaman
          </button>

          <button
            type="button"
            class="fbaps-button fbaps-button-primary"
            data-fbaps-action="scan-dropdowns"
          >
            Scan dropdown
          </button>

          <button
            type="button"
            class="fbaps-button fbaps-button-warning fbaps-full"
            data-fbaps-action="explore-branches"
          >
            Eksplorasi cabang halaman
          </button>
        </div>

        <div class="fbaps-section-title">
          Navigasi
        </div>

        <div class="fbaps-actions">
          <button
            type="button"
            class="fbaps-button"
            data-fbaps-action="previous"
          >
            ← Halaman sebelumnya
          </button>

          <button
            type="button"
            class="fbaps-button"
            data-fbaps-action="next"
          >
            Halaman berikutnya →
          </button>

          <button
            type="button"
            class="fbaps-button fbaps-full"
            data-fbaps-action="scan-next"
          >
            Scan dropdown + Next
          </button>

          <button
            type="button"
            class="fbaps-button fbaps-button-warning fbaps-full"
            data-fbaps-action="auto-walk"
          >
            Auto walk selama validasi memungkinkan
          </button>
        </div>

        <div class="fbaps-section-title">
          Export
        </div>

        <div class="fbaps-actions">
          <button
            type="button"
            class="fbaps-button"
            data-fbaps-action="console"
          >
            Tampilkan console
          </button>

          <button
            type="button"
            class="fbaps-button"
            data-fbaps-action="copy-result"
          >
            Copy full JSON
          </button>

          <button
            type="button"
            class="fbaps-button"
            data-fbaps-action="download-result"
          >
            Download full JSON
          </button>

          <button
            type="button"
            class="fbaps-button"
            data-fbaps-action="download-template"
          >
            Download template
          </button>

          <button
            type="button"
            class="fbaps-button fbaps-button-danger fbaps-full"
            data-fbaps-action="reset"
          >
            Reset seluruh hasil
          </button>
        </div>

        <div
          class="fbaps-status"
          data-fbaps-value="status"
        >
          Scanner siap.
        </div>
      </div>

      <div class="fbaps-footer">
        Scanner tidak pernah menekan Submit.
        Dropdown Headless UI didukung.
      </div>
    `;

    document.body.appendChild(panel);

    panel.addEventListener(
      "click",
      async (event) => {
        const button =
          event.target.closest(
            "[data-fbaps-action]"
          );

        if (!button) return;

        const action =
          button.dataset.fbapsAction;

        try {
          switch (action) {
            case "toggle": {
              panel.classList.toggle(
                "fbaps-collapsed"
              );

              button.textContent =
                panel.classList.contains(
                  "fbaps-collapsed"
                )
                  ? "+"
                  : "−";

              break;
            }

            case "scan-page": {
              setStatus(
                "Memindai halaman aktif..."
              );

              await scanCurrentPage(
                "manual"
              );

              setStatus(
                "Scan halaman selesai."
              );

              break;
            }

            case "scan-dropdowns": {
              await scanAllDropdowns();
              break;
            }

            case "explore-branches": {
              await exploreCurrentPageBranches();
              break;
            }

            case "previous": {
              await goToPreviousPage();
              break;
            }

            case "next": {
              await goToNextPage();
              break;
            }

            case "scan-next": {
              await scanAndGoNext();
              break;
            }

            case "auto-walk": {
              await autoWalkAvailablePages();
              break;
            }

            case "console": {
              STATE.latestResult =
                buildFinalResult();

              console.log(
                `[${CONFIG.name}] Full result:`,
                STATE.latestResult
              );

              console.table(
                STATE.latestResult.fields.map(
                  (field) => ({
                    fieldCode:
                      field.fieldCode,
                    label:
                      field.label,
                    type:
                      field.type,
                    options:
                      field.options?.length ||
                      0,
                    pages:
                      field.seenOnPages.join(
                        ", "
                      )
                  })
                )
              );

              setStatus(
                "Hasil ditampilkan di console."
              );

              break;
            }

            case "copy-result": {
              STATE.latestResult =
                buildFinalResult();

              await copyJson(
                STATE.latestResult
              );

              break;
            }

            case "download-result": {
              STATE.latestResult =
                buildFinalResult();

              downloadJson(
                STATE.latestResult,
                "formbridge-advanced-scan-result"
              );

              break;
            }

            case "download-template": {
              downloadJson(
                buildTranslationTemplate(),
                "formbridge-translation-template"
              );

              break;
            }

            case "reset": {
              await resetData();
              break;
            }

            default:
              break;
          }
        } catch (actionError) {
          error(
            "Panel action gagal.",
            action,
            actionError
          );

          setStatus(
            `Error: ${actionError.message}`
          );
        }
      }
    );
  }

  function setPanelValue(name, value) {
    const element =
      document.querySelector(
        `#${PANEL_ID} [data-fbaps-value="${name}"]`
      );

    if (element) {
      element.textContent =
        String(value);
    }
  }

  function updatePanel() {
    const result =
      STATE.latestResult ||
      buildFinalResult();

    setPanelValue(
      "page",
      STATE.currentPage ?? "-"
    );

    setPanelValue(
      "totalPages",
      STATE.totalPages ?? "-"
    );

    setPanelValue(
      "scanCount",
      STATE.scanCount
    );

    setPanelValue(
      "fields",
      result.summary.totalFields
    );

    setPanelValue(
      "dropdowns",
      result.summary.totalDropdowns
    );

    setPanelValue(
      "options",
      result.summary.totalOptions
    );

    setPanelValue(
      "jpFields",
      result.summary.japaneseFields
    );

    setPanelValue(
      "jpOptions",
      result.summary.japaneseOptions
    );

    setPanelValue(
      "pages",
      result.summary.pagesDiscovered
    );

    setPanelValue(
      "status",
      STATE.statusMessage ||
      "Scanner siap."
    );
  }

  // ============================================================
  // GLOBAL API
  // ============================================================

  function exposeGlobalApi() {
    window.FBAdvancedScanner = {
      version: CONFIG.version,

      scanPage() {
        return scanCurrentPage(
          "global-api"
        );
      },

      scanDropdowns() {
        return scanAllDropdowns();
      },

      exploreBranches() {
        return exploreCurrentPageBranches();
      },

      nextPage() {
        return goToNextPage();
      },

      previousPage() {
        return goToPreviousPage();
      },

      autoWalk() {
        return autoWalkAvailablePages();
      },

      getResult() {
        STATE.latestResult =
          buildFinalResult();

        return STATE.latestResult;
      },

      getFields() {
        return Array.from(
          STATE.fields.values()
        );
      },

      getDropdowns() {
        return Array.from(
          STATE.dropdowns.values()
        );
      },

      getTemplate() {
        return buildTranslationTemplate();
      },

      copyResult() {
        return copyJson(
          buildFinalResult()
        );
      },

      downloadResult() {
        return downloadJson(
          buildFinalResult(),
          "formbridge-advanced-scan-result"
        );
      },

      downloadTemplate() {
        return downloadJson(
          buildTranslationTemplate(),
          "formbridge-translation-template"
        );
      },

      reset() {
        return resetData();
      },

      stop() {
        STATE.observer?.disconnect();

        if (
          STATE.fallbackIntervalId
        ) {
          window.clearInterval(
            STATE.fallbackIntervalId
          );
        }

        setStatus(
          "Scanner dihentikan."
        );
      }
    };
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  async function initialize() {
    if (STATE.initialized) return;

    STATE.initialized = true;

    createPanel();
    exposeGlobalApi();
    startMutationObserver();
    startEventListeners();

    setStatus(
      "Melakukan scan awal..."
    );

    await scanCurrentPage(
      "initial-load"
    );

    STATE.fallbackIntervalId =
      window.setInterval(() => {
        if (!STATE.busy) {
          schedulePageScan(
            "fallback-interval"
          );
        }
      }, CONFIG.fallbackScanInterval);

    setStatus(
      `Scanner aktif. Halaman ${
        STATE.currentPage ?? "belum dikenali"
      }.`
    );

    log(
      `Scanner versi ${CONFIG.version} aktif.`,
      {
        globalApi:
          "window.FBAdvancedScanner",
        currentPage:
          STATE.currentPage,
        totalPages:
          STATE.totalPages
      }
    );
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        window.setTimeout(
          initialize,
          CONFIG.initialDelay
        );
      },
      {
        once: true
      }
    );
  } else {
    window.setTimeout(
      initialize,
      CONFIG.initialDelay
    );
  }
})();