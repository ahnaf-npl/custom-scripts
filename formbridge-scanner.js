/**
 * ============================================================
 * FormBridge New Version — Preview Form Scanner
 * ============================================================
 *
 * Tujuan:
 * - Scan field, label, description, placeholder, dan opsi.
 * - Aktif hanya di halaman preview/private FormBridge.
 * - Menangani step form dan conditional branching.
 * - Tidak mengubah value atau tampilan form.
 * - Menampilkan hasil di console dan panel UI.
 * - Bisa copy atau download hasil scan dalam format JSON.
 *
 * Halaman yang diizinkan:
 * https://formbridge.kintoneapp.com/private/...
 *
 * Catatan:
 * Script ini dibuat untuk scanner tahap awal.
 * Script terjemahan public sebaiknya dibuat sebagai file terpisah.
 */

(function () {
  "use strict";

  // ============================================================
  // CONFIGURATION
  // ============================================================

  const CONFIG = {
    scannerName: "FB Preview Scanner",
    version: "1.0.0",

    /**
     * Scanner hanya berjalan pada preview/private.
     */
    allowedHostnames: [
      "formbridge.kintoneapp.com"
    ],

    allowedPathPrefixes: [
      "/private/"
    ],

    /**
     * Delay untuk menunggu FormBridge selesai render ulang.
     */
    scanDelay: 350,

    /**
     * Interval fallback.
     * Berguna jika perubahan DOM tertentu tidak tertangkap observer.
     *
     * Set 0 untuk menonaktifkan.
     */
    fallbackInterval: 3000,

    /**
     * Tampilkan panel scanner.
     */
    showPanel: true,

    /**
     * Log detail ke console.
     */
    debug: true,

    /**
     * Abaikan elemen yang tidak terlihat.
     */
    scanVisibleElementsOnly: true,

    /**
     * Maksimal panjang teks yang dicatat.
     */
    maxTextLength: 500
  };

  // ============================================================
  // RUNTIME STATE
  // ============================================================

  const STATE = {
    initialized: false,
    scanTimer: null,
    observer: null,
    intervalId: null,
    lastSignature: "",
    scanCount: 0,
    currentStep: null,
    collectedFields: new Map(),
    collectedTexts: new Map(),
    collectedButtons: new Map(),
    latestResult: null
  };

  const PANEL_ID = "fb-preview-scanner-panel";
  const STYLE_ID = "fb-preview-scanner-style";

  // ============================================================
  // ENVIRONMENT CHECK
  // ============================================================

  function isAllowedPreviewPage() {
    const hostnameAllowed = CONFIG.allowedHostnames.includes(
      window.location.hostname
    );

    const pathnameAllowed = CONFIG.allowedPathPrefixes.some((prefix) =>
      window.location.pathname.startsWith(prefix)
    );

    return hostnameAllowed && pathnameAllowed;
  }

  if (!isAllowedPreviewPage()) {
    console.info(
      `[${CONFIG.scannerName}] Scanner tidak dijalankan karena halaman ini bukan preview/private FormBridge.`,
      {
        hostname: window.location.hostname,
        pathname: window.location.pathname
      }
    );

    return;
  }

  // ============================================================
  // BASIC UTILITIES
  // ============================================================

  function log(...args) {
    if (!CONFIG.debug) return;

    console.log(
      `%c[${CONFIG.scannerName}]`,
      "background:#2563eb;color:#fff;padding:2px 6px;border-radius:4px;",
      ...args
    );
  }

  function warn(...args) {
    console.warn(`[${CONFIG.scannerName}]`, ...args);
  }

  function normalizeText(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/\u00a0/g, " ")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, CONFIG.maxTextLength);
  }

  function escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(String(value));
    }

    return String(value).replace(
      /([ #;?%&,.+*~\\':"!^$[\]()=>|/@])/g,
      "\\$1"
    );
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
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

    if (element.hidden) {
      return false;
    }

    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    const rect = element.getBoundingClientRect();

    return rect.width > 0 || rect.height > 0;
  }

  function shouldScanElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    if (element.closest(`#${PANEL_ID}`)) {
      return false;
    }

    if (
      CONFIG.scanVisibleElementsOnly &&
      !isVisible(element)
    ) {
      return false;
    }

    return true;
  }

  function getOwnText(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    const parts = [];

    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = normalizeText(node.textContent);

        if (text) {
          parts.push(text);
        }
      }
    }

    return normalizeText(parts.join(" "));
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

  function createStableKey(parts) {
    return parts
      .map((part) => normalizeText(part))
      .filter(Boolean)
      .join("::");
  }

  function simpleHash(value) {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(index);
      hash |= 0;
    }

    return Math.abs(hash).toString(36);
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
      current.nodeType === Node.ELEMENT_NODE &&
      current !== document.body &&
      depth < 6
    ) {
      let selector = current.tagName.toLowerCase();

      if (current.id && current.id !== PANEL_ID) {
        selector += `#${current.id}`;
        parts.unshift(selector);
        break;
      }

      const stableClasses = Array.from(current.classList)
        .filter((className) =>
          !className.includes("active") &&
          !className.includes("selected") &&
          !className.includes("focus") &&
          !className.match(/[0-9]{4,}/)
        )
        .slice(0, 2);

      if (stableClasses.length) {
        selector += `.${stableClasses.join(".")}`;
      }

      const parent = current.parentElement;

      if (parent) {
        const sameTagSiblings = Array.from(parent.children)
          .filter((child) => child.tagName === current.tagName);

        if (sameTagSiblings.length > 1) {
          selector += `:nth-of-type(${
            sameTagSiblings.indexOf(current) + 1
          })`;
        }
      }

      parts.unshift(selector);
      current = current.parentElement;
      depth += 1;
    }

    return parts.join(" > ");
  }

  // ============================================================
  // JAPANESE TEXT DETECTION
  // ============================================================

  function containsJapanese(text) {
    const normalized = normalizeText(text);

    if (!normalized) {
      return false;
    }

    /**
     * Hiragana:
     * \u3040-\u309F
     *
     * Katakana:
     * \u30A0-\u30FF
     *
     * Katakana extensions:
     * \u31F0-\u31FF
     *
     * Common CJK:
     * \u4E00-\u9FFF
     */
    return /[\u3040-\u30FF\u31F0-\u31FF\u4E00-\u9FFF]/u.test(
      normalized
    );
  }

  function detectLanguages(text) {
    const normalized = normalizeText(text);

    return {
      hasJapanese: containsJapanese(normalized),
      hasLatin: /[A-Za-z]/.test(normalized),
      hasNumber: /[0-9]/.test(normalized)
    };
  }

  // ============================================================
  // FORM ELEMENT DETECTION
  // ============================================================

  function getControlType(control) {
    if (!(control instanceof Element)) {
      return "unknown";
    }

    const tagName = control.tagName.toLowerCase();

    if (tagName === "select") {
      return control.multiple ? "multi-select" : "select";
    }

    if (tagName === "textarea") {
      return "textarea";
    }

    if (tagName === "button") {
      return "button";
    }

    if (tagName === "input") {
      return control.type || "text";
    }

    if (
      control.getAttribute("role") === "combobox"
    ) {
      return "custom-combobox";
    }

    if (
      control.getAttribute("role") === "radiogroup"
    ) {
      return "radio-group";
    }

    return tagName;
  }

  function findAssociatedLabel(control) {
    if (!(control instanceof Element)) {
      return "";
    }

    const labels = [];

    // 1. Label berdasarkan id/for.
    if (control.id) {
      const label = document.querySelector(
        `label[for="${escapeSelector(control.id)}"]`
      );

      if (label && shouldScanElement(label)) {
        labels.push(label.innerText);
      }
    }

    // 2. Control berada di dalam label.
    const wrappingLabel = control.closest("label");

    if (wrappingLabel && shouldScanElement(wrappingLabel)) {
      const clone = wrappingLabel.cloneNode(true);

      clone.querySelectorAll(
        "input, select, textarea, button, svg"
      ).forEach((element) => element.remove());

      labels.push(clone.textContent);
    }

    // 3. aria-label.
    labels.push(control.getAttribute("aria-label"));

    // 4. aria-labelledby.
    const labelledBy = normalizeText(
      control.getAttribute("aria-labelledby")
    );

    if (labelledBy) {
      labelledBy.split(/\s+/).forEach((id) => {
        const target = document.getElementById(id);

        if (target && shouldScanElement(target)) {
          labels.push(target.innerText || target.textContent);
        }
      });
    }

    // 5. Container field terdekat.
    const container = findFieldContainer(control);

    if (container) {
      const candidates = container.querySelectorAll(
        [
          "label",
          "legend",
          "[class*='label']",
          "[class*='Label']",
          "[class*='title']",
          "[class*='Title']",
          "[data-testid*='label']"
        ].join(",")
      );

      for (const candidate of candidates) {
        if (!shouldScanElement(candidate)) continue;

        const text = normalizeText(
          candidate.innerText ||
          candidate.textContent
        );

        if (text) {
          labels.push(text);
          break;
        }
      }
    }

    return uniqueStrings(labels)[0] || "";
  }

  function findFieldContainer(control) {
    if (!(control instanceof Element)) {
      return null;
    }

    const selectors = [
      "[data-field-code]",
      "[data-field-id]",
      "[data-testid*='field']",
      "[class*='form-field']",
      "[class*='FormField']",
      "[class*='field-wrapper']",
      "[class*='fieldWrapper']",
      "[class*='field-container']",
      "[class*='fieldContainer']",
      ".field",
      "fieldset"
    ];

    for (const selector of selectors) {
      const match = control.closest(selector);

      if (
        match &&
        !match.closest(`#${PANEL_ID}`)
      ) {
        return match;
      }
    }

    return control.parentElement;
  }

  function getFieldIdentifiers(control, container) {
    const identifiers = {
      id: normalizeText(control.id),
      name: normalizeText(control.getAttribute("name")),
      fieldCode: "",
      fieldId: "",
      testId: normalizeText(
        control.getAttribute("data-testid")
      )
    };

    const sources = [
      control,
      container
    ].filter(Boolean);

    for (const source of sources) {
      if (!identifiers.fieldCode) {
        identifiers.fieldCode = normalizeText(
          source.getAttribute("data-field-code") ||
          source.dataset?.fieldCode
        );
      }

      if (!identifiers.fieldId) {
        identifiers.fieldId = normalizeText(
          source.getAttribute("data-field-id") ||
          source.dataset?.fieldId
        );
      }
    }

    return identifiers;
  }

  function getFieldDescription(control, container) {
    const values = [];

    values.push(
      control.getAttribute("aria-description"),
      control.getAttribute("title")
    );

    const describedBy = normalizeText(
      control.getAttribute("aria-describedby")
    );

    if (describedBy) {
      describedBy.split(/\s+/).forEach((id) => {
        const element = document.getElementById(id);

        if (element && shouldScanElement(element)) {
          values.push(
            element.innerText ||
            element.textContent
          );
        }
      });
    }

    if (container) {
      const candidates = container.querySelectorAll(
        [
          "[class*='description']",
          "[class*='Description']",
          "[class*='help']",
          "[class*='Help']",
          "[class*='note']",
          "[class*='Note']",
          "small"
        ].join(",")
      );

      for (const candidate of candidates) {
        if (!shouldScanElement(candidate)) continue;

        values.push(
          candidate.innerText ||
          candidate.textContent
        );
      }
    }

    return uniqueStrings(values);
  }

  function getSelectOptions(select) {
    if (!(select instanceof HTMLSelectElement)) {
      return [];
    }

    return Array.from(select.options).map(
      (option, index) => ({
        index,
        text: normalizeText(option.textContent),
        value: option.value,
        selected: option.selected,
        disabled: option.disabled,
        languages: detectLanguages(option.textContent)
      })
    );
  }

  function getRadioCheckboxOptions(control, container) {
    if (
      !(control instanceof HTMLInputElement) ||
      !["radio", "checkbox"].includes(control.type)
    ) {
      return [];
    }

    const root = container || control.parentElement;

    if (!root) {
      return [];
    }

    const name = control.name;

    let controls = [];

    if (name) {
      controls = Array.from(
        root.querySelectorAll(
          `input[type="${control.type}"][name="${escapeSelector(name)}"]`
        )
      );
    }

    if (!controls.length) {
      controls = Array.from(
        root.querySelectorAll(
          `input[type="${control.type}"]`
        )
      );
    }

    return controls.map((input, index) => ({
      index,
      text: findAssociatedLabel(input),
      value: input.value,
      checked: input.checked,
      disabled: input.disabled,
      languages: detectLanguages(
        findAssociatedLabel(input)
      )
    }));
  }

  function getCustomOptions(control, container) {
    const root = container || control;

    const optionCandidates = root.querySelectorAll(
      [
        "[role='option']",
        "[role='radio']",
        "[role='checkbox']",
        "[class*='option']",
        "[class*='Option']"
      ].join(",")
    );

    const options = [];

    optionCandidates.forEach((element, index) => {
      if (!shouldScanElement(element)) return;

      const text = normalizeText(
        element.innerText ||
        element.textContent
      );

      if (!text) return;

      options.push({
        index,
        text,
        value:
          element.getAttribute("data-value") ||
          element.getAttribute("value") ||
          "",
        selected:
          element.getAttribute("aria-selected") === "true" ||
          element.getAttribute("aria-checked") === "true",
        disabled:
          element.getAttribute("aria-disabled") === "true",
        languages: detectLanguages(text)
      });
    });

    return options;
  }

  function extractField(control, index) {
    const container = findFieldContainer(control);
    const identifiers = getFieldIdentifiers(
      control,
      container
    );

    const type = getControlType(control);
    const label = findAssociatedLabel(control);
    const placeholder = normalizeText(
      control.getAttribute("placeholder")
    );

    let options = [];

    if (control instanceof HTMLSelectElement) {
      options = getSelectOptions(control);
    } else if (
      control instanceof HTMLInputElement &&
      ["radio", "checkbox"].includes(control.type)
    ) {
      options = getRadioCheckboxOptions(
        control,
        container
      );
    } else if (
      ["custom-combobox", "radio-group"].includes(type)
    ) {
      options = getCustomOptions(
        control,
        container
      );
    }

    const path = getElementPath(control);

    const baseKey = createStableKey([
      identifiers.fieldCode,
      identifiers.fieldId,
      identifiers.name,
      identifiers.id,
      label,
      type,
      path
    ]);

    const key = baseKey
      ? `field-${simpleHash(baseKey)}`
      : `field-index-${index}`;

    return {
      key,
      index,
      type,
      label,
      placeholder,
      description: getFieldDescription(
        control,
        container
      ),
      identifiers,
      required:
        control.required ||
        control.getAttribute("aria-required") === "true",
      disabled:
        control.disabled ||
        control.getAttribute("aria-disabled") === "true",
      readonly:
        control.readOnly ||
        control.getAttribute("aria-readonly") === "true",
      visible: isVisible(control),
      options,
      languages: {
        label: detectLanguages(label),
        placeholder: detectLanguages(placeholder)
      },
      dom: {
        tagName: control.tagName.toLowerCase(),
        inputType:
          control instanceof HTMLInputElement
            ? control.type
            : "",
        path
      }
    };
  }

  // ============================================================
  // FIELD SCANNING
  // ============================================================

  function getCandidateControls() {
    const selector = [
      "input:not([type='hidden'])",
      "select",
      "textarea",
      "[role='combobox']",
      "[role='radiogroup']"
    ].join(",");

    const candidates = Array.from(
      document.querySelectorAll(selector)
    );

    const filtered = candidates.filter(
      (element) =>
        shouldScanElement(element) &&
        !element.closest(`#${PANEL_ID}`)
    );

    /**
     * Hindari radio/checkbox dengan name yang sama tercatat
     * sebagai field terpisah berulang kali.
     */
    const seenGroups = new Set();

    return filtered.filter((element) => {
      if (
        element instanceof HTMLInputElement &&
        ["radio", "checkbox"].includes(element.type) &&
        element.name
      ) {
        const container = findFieldContainer(element);
        const groupKey = createStableKey([
          element.type,
          element.name,
          getElementPath(container || element.parentElement)
        ]);

        if (seenGroups.has(groupKey)) {
          return false;
        }

        seenGroups.add(groupKey);
      }

      return true;
    });
  }

  function scanFields() {
    const controls = getCandidateControls();

    return controls.map((control, index) =>
      extractField(control, index)
    );
  }

  // ============================================================
  // GENERIC TEXT SCANNING
  // ============================================================

  function scanGenericTexts() {
    const selector = [
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "legend",
      "label",
      "p",
      "span",
      "small",
      "[class*='description']",
      "[class*='Description']",
      "[class*='help']",
      "[class*='Help']",
      "[class*='title']",
      "[class*='Title']"
    ].join(",");

    const results = [];
    const seen = new Set();

    document.querySelectorAll(selector).forEach(
      (element) => {
        if (!shouldScanElement(element)) return;

        if (
          element.closest(
            "button, option, select, input, textarea"
          )
        ) {
          return;
        }

        let text = getOwnText(element);

        if (!text) {
          const childElements = Array.from(
            element.children
          );

          if (childElements.length <= 2) {
            text = normalizeText(element.textContent);
          }
        }

        if (!text) return;

        const path = getElementPath(element);

        const key = createStableKey([
          text,
          path
        ]);

        if (!key || seen.has(key)) {
          return;
        }

        seen.add(key);

        results.push({
          key: `text-${simpleHash(key)}`,
          text,
          hasJapanese: containsJapanese(text),
          languages: detectLanguages(text),
          tagName: element.tagName.toLowerCase(),
          path
        });
      }
    );

    return results;
  }

  // ============================================================
  // BUTTON SCANNING
  // ============================================================

  function scanButtons() {
    const selector = [
      "button",
      "input[type='button']",
      "input[type='submit']",
      "input[type='reset']",
      "[role='button']",
      "a[class*='button']",
      "a[class*='Button']"
    ].join(",");

    const results = [];
    const seen = new Set();

    document.querySelectorAll(selector).forEach(
      (element) => {
        if (!shouldScanElement(element)) return;

        const text = normalizeText(
          element instanceof HTMLInputElement
            ? element.value
            : (
                element.innerText ||
                element.textContent ||
                element.getAttribute("aria-label")
              )
        );

        if (!text) return;

        const path = getElementPath(element);
        const key = createStableKey([text, path]);

        if (seen.has(key)) return;

        seen.add(key);

        results.push({
          key: `button-${simpleHash(key)}`,
          text,
          hasJapanese: containsJapanese(text),
          languages: detectLanguages(text),
          type:
            element.getAttribute("type") ||
            element.getAttribute("role") ||
            element.tagName.toLowerCase(),
          disabled:
            element.disabled ||
            element.getAttribute("aria-disabled") === "true",
          path
        });
      }
    );

    return results;
  }

  // ============================================================
  // STEP DETECTION
  // ============================================================

  function detectCurrentStep() {
    const candidates = [
      "[aria-current='step']",
      "[class*='step'][class*='active']",
      "[class*='Step'][class*='active']",
      "[class*='step'][class*='current']",
      "[class*='Step'][class*='current']",
      "[data-current-step]",
      "[data-step].active"
    ];

    for (const selector of candidates) {
      const element = document.querySelector(selector);

      if (!element || !isVisible(element)) continue;

      const value = normalizeText(
        element.getAttribute("data-current-step") ||
        element.getAttribute("data-step") ||
        element.innerText ||
        element.textContent
      );

      if (value) {
        return value;
      }
    }

    /**
     * Fallback berdasarkan indikator angka step.
     */
    const progressBars = Array.from(
      document.querySelectorAll(
        "[role='progressbar'], progress"
      )
    );

    for (const progress of progressBars) {
      const value =
        progress.getAttribute("aria-valuenow") ||
        progress.value;

      const max =
        progress.getAttribute("aria-valuemax") ||
        progress.max;

      if (value !== null && value !== undefined) {
        return max
          ? `${value}/${max}`
          : String(value);
      }
    }

    return `unknown-${window.location.pathname}`;
  }

  // ============================================================
  // RESULT AGGREGATION
  // ============================================================

  function mergeField(field) {
    const existing = STATE.collectedFields.get(field.key);

    if (!existing) {
      STATE.collectedFields.set(field.key, {
        ...field,
        seenOnSteps: [STATE.currentStep],
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString()
      });

      return;
    }

    const mergedOptions = new Map();

    [
      ...(existing.options || []),
      ...(field.options || [])
    ].forEach((option) => {
      const optionKey = createStableKey([
        option.value,
        option.text
      ]);

      if (!mergedOptions.has(optionKey)) {
        mergedOptions.set(optionKey, option);
      }
    });

    STATE.collectedFields.set(field.key, {
      ...existing,
      ...field,
      options: Array.from(mergedOptions.values()),
      description: uniqueStrings([
        ...(existing.description || []),
        ...(field.description || [])
      ]),
      seenOnSteps: uniqueStrings([
        ...(existing.seenOnSteps || []),
        STATE.currentStep
      ]),
      firstSeenAt: existing.firstSeenAt,
      lastSeenAt: new Date().toISOString()
    });
  }

  function mergeGenericText(item) {
    const existing = STATE.collectedTexts.get(item.key);

    if (!existing) {
      STATE.collectedTexts.set(item.key, {
        ...item,
        seenOnSteps: [STATE.currentStep]
      });

      return;
    }

    existing.seenOnSteps = uniqueStrings([
      ...(existing.seenOnSteps || []),
      STATE.currentStep
    ]);

    STATE.collectedTexts.set(item.key, existing);
  }

  function mergeButton(item) {
    const existing = STATE.collectedButtons.get(item.key);

    if (!existing) {
      STATE.collectedButtons.set(item.key, {
        ...item,
        seenOnSteps: [STATE.currentStep]
      });

      return;
    }

    existing.seenOnSteps = uniqueStrings([
      ...(existing.seenOnSteps || []),
      STATE.currentStep
    ]);

    STATE.collectedButtons.set(item.key, existing);
  }

  function buildTranslationTemplate(fields) {
    const translations = {
      labels: {},
      placeholders: {},
      descriptions: {},
      optionsByField: {},
      genericTexts: {},
      buttons: {}
    };

    fields.forEach((field) => {
      const fieldKey =
        field.identifiers.fieldCode ||
        field.identifiers.name ||
        field.identifiers.id ||
        field.key;

      if (
        field.label &&
        containsJapanese(field.label)
      ) {
        translations.labels[field.label] = "";
      }

      if (
        field.placeholder &&
        containsJapanese(field.placeholder)
      ) {
        translations.placeholders[
          field.placeholder
        ] = "";
      }

      field.description.forEach((description) => {
        if (containsJapanese(description)) {
          translations.descriptions[
            description
          ] = "";
        }
      });

      const japaneseOptions = field.options.filter(
        (option) => containsJapanese(option.text)
      );

      if (japaneseOptions.length) {
        translations.optionsByField[fieldKey] = {
          fieldLabel: field.label,
          translations: {}
        };

        japaneseOptions.forEach((option) => {
          translations.optionsByField[
            fieldKey
          ].translations[option.text] = "";
        });
      }
    });

    Array.from(STATE.collectedTexts.values())
      .filter((item) => item.hasJapanese)
      .forEach((item) => {
        translations.genericTexts[item.text] = "";
      });

    Array.from(STATE.collectedButtons.values())
      .filter((item) => item.hasJapanese)
      .forEach((item) => {
        translations.buttons[item.text] = "";
      });

    return translations;
  }

  function buildFinalResult() {
    const fields = Array.from(
      STATE.collectedFields.values()
    );

    const genericTexts = Array.from(
      STATE.collectedTexts.values()
    );

    const buttons = Array.from(
      STATE.collectedButtons.values()
    );

    const japaneseFields = fields.filter(
      (field) =>
        field.languages.label.hasJapanese ||
        field.languages.placeholder.hasJapanese ||
        field.description.some(containsJapanese) ||
        field.options.some((option) =>
          containsJapanese(option.text)
        )
    );

    return {
      metadata: {
        scanner: CONFIG.scannerName,
        scannerVersion: CONFIG.version,
        generatedAt: new Date().toISOString(),
        pageUrl: window.location.href,
        hostname: window.location.hostname,
        pathname: window.location.pathname,
        scanCount: STATE.scanCount,
        currentStep: STATE.currentStep,
        userAgent: navigator.userAgent
      },

      summary: {
        totalFields: fields.length,
        japaneseFields: japaneseFields.length,
        totalOptions: fields.reduce(
          (total, field) =>
            total + field.options.length,
          0
        ),
        japaneseOptions: fields.reduce(
          (total, field) =>
            total +
            field.options.filter((option) =>
              containsJapanese(option.text)
            ).length,
          0
        ),
        genericTexts: genericTexts.length,
        japaneseGenericTexts:
          genericTexts.filter(
            (item) => item.hasJapanese
          ).length,
        buttons: buttons.length,
        japaneseButtons:
          buttons.filter(
            (item) => item.hasJapanese
          ).length
      },

      fields,
      japaneseFields,
      genericTexts,
      buttons,

      translationTemplate:
        buildTranslationTemplate(fields)
    };
  }

  // ============================================================
  // SCAN EXECUTION
  // ============================================================

  function createCurrentSignature(fields) {
    const simplified = fields.map((field) => ({
      key: field.key,
      label: field.label,
      type: field.type,
      visible: field.visible,
      options: field.options.map((option) => ({
        text: option.text,
        value: option.value
      }))
    }));

    return JSON.stringify(simplified);
  }

  function performScan(reason = "manual") {
    STATE.scanCount += 1;
    STATE.currentStep = detectCurrentStep();

    const currentFields = scanFields();
    const currentTexts = scanGenericTexts();
    const currentButtons = scanButtons();

    currentFields.forEach(mergeField);
    currentTexts.forEach(mergeGenericText);
    currentButtons.forEach(mergeButton);

    const signature =
      createCurrentSignature(currentFields);

    const changed =
      signature !== STATE.lastSignature;

    STATE.lastSignature = signature;
    STATE.latestResult = buildFinalResult();

    updatePanel();

    if (changed || reason === "manual") {
      log(`Scan #${STATE.scanCount}`, {
        reason,
        currentStep: STATE.currentStep,
        currentVisibleFields:
          currentFields.length,
        totalCollectedFields:
          STATE.latestResult.summary.totalFields,
        japaneseFields:
          STATE.latestResult.summary.japaneseFields,
        japaneseOptions:
          STATE.latestResult.summary.japaneseOptions,
        result: STATE.latestResult
      });

      console.groupCollapsed(
        `%c[${CONFIG.scannerName}] Hasil scan`,
        "color:#2563eb;font-weight:bold;"
      );

      console.table(
        STATE.latestResult.fields.map((field) => ({
          key: field.key,
          fieldCode:
            field.identifiers.fieldCode,
          name: field.identifiers.name,
          type: field.type,
          label: field.label,
          options: field.options.length,
          japanese:
            field.languages.label.hasJapanese ||
            field.options.some((option) =>
              containsJapanese(option.text)
            ),
          steps: field.seenOnSteps.join(", ")
        }))
      );

      console.log(
        "Full result:",
        STATE.latestResult
      );

      console.log(
        "Translation template:",
        STATE.latestResult.translationTemplate
      );

      console.groupEnd();
    }

    return STATE.latestResult;
  }

  function scheduleScan(reason = "dom-change") {
    clearTimeout(STATE.scanTimer);

    STATE.scanTimer = window.setTimeout(() => {
      performScan(reason);
    }, CONFIG.scanDelay);
  }

  // ============================================================
  // MUTATION OBSERVER
  // ============================================================

  function startObserver() {
    if (STATE.observer) {
      STATE.observer.disconnect();
    }

    STATE.observer = new MutationObserver(
      (mutations) => {
        const relevantMutation = mutations.some(
          (mutation) => {
            if (
              mutation.target instanceof Element &&
              mutation.target.closest(`#${PANEL_ID}`)
            ) {
              return false;
            }

            if (mutation.type === "childList") {
              return (
                mutation.addedNodes.length > 0 ||
                mutation.removedNodes.length > 0
              );
            }

            if (mutation.type === "attributes") {
              return [
                "class",
                "style",
                "hidden",
                "aria-hidden",
                "aria-expanded",
                "aria-selected",
                "aria-checked",
                "disabled"
              ].includes(mutation.attributeName);
            }

            return false;
          }
        );

        if (relevantMutation) {
          scheduleScan("mutation");
        }
      }
    );

    STATE.observer.observe(document.body, {
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
    });
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
          !event.target.closest(`#${PANEL_ID}`)
        ) {
          scheduleScan("change-event");
        }
      },
      true
    );

    document.addEventListener(
      "input",
      (event) => {
        if (
          event.target instanceof Element &&
          !event.target.closest(`#${PANEL_ID}`)
        ) {
          scheduleScan("input-event");
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
                "button, [role='button'], input[type='submit'], input[type='button'], a"
              )
            : null;

        if (
          !target ||
          target.closest(`#${PANEL_ID}`)
        ) {
          return;
        }

        /**
         * Tunggu perpindahan step atau conditional render selesai.
         */
        window.setTimeout(
          () => scheduleScan("button-click"),
          150
        );

        window.setTimeout(
          () => scheduleScan("button-click-delayed"),
          700
        );
      },
      true
    );

    window.addEventListener("popstate", () => {
      scheduleScan("popstate");
    });

    window.addEventListener("hashchange", () => {
      scheduleScan("hashchange");
    });
  }

  // ============================================================
  // CLIPBOARD AND DOWNLOAD
  // ============================================================

  async function copyJsonToClipboard(data) {
    const json = JSON.stringify(data, null, 2);

    try {
      await navigator.clipboard.writeText(json);
      showPanelMessage("JSON berhasil disalin.");
    } catch (error) {
      warn("Clipboard API gagal.", error);

      const textarea =
        document.createElement("textarea");

      textarea.value = json;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";

      document.body.appendChild(textarea);
      textarea.select();

      const successful =
        document.execCommand("copy");

      textarea.remove();

      showPanelMessage(
        successful
          ? "JSON berhasil disalin."
          : "Gagal menyalin JSON."
      );
    }
  }

  function downloadJson(data, type = "scan") {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob(
      [json],
      { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    const date = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    anchor.href = url;
    anchor.download =
      `formbridge-${type}-${date}.json`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);

    showPanelMessage(
      `${type} JSON berhasil di-download.`
    );
  }

  // ============================================================
  // PANEL UI
  // ============================================================

  function addPanelStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        width: 340px;
        max-width: calc(100vw - 32px);
        max-height: calc(100vh - 32px);
        overflow: hidden;
        box-sizing: border-box;
        border: 1px solid rgba(15, 23, 42, 0.18);
        border-radius: 12px;
        background: #ffffff;
        color: #0f172a;
        box-shadow:
          0 20px 25px -5px rgba(15, 23, 42, 0.16),
          0 8px 10px -6px rgba(15, 23, 42, 0.12);
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
        font-size: 13px;
        line-height: 1.45;
      }

      #${PANEL_ID},
      #${PANEL_ID} * {
        box-sizing: border-box;
      }

      #${PANEL_ID} .fb-scanner-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 11px 12px;
        border-bottom: 1px solid #e2e8f0;
        background: #f8fafc;
      }

      #${PANEL_ID} .fb-scanner-title {
        font-size: 13px;
        font-weight: 700;
      }

      #${PANEL_ID} .fb-scanner-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 7px;
        border-radius: 999px;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 11px;
        font-weight: 700;
      }

      #${PANEL_ID} .fb-scanner-body {
        max-height: 420px;
        overflow-y: auto;
        padding: 12px;
      }

      #${PANEL_ID} .fb-scanner-summary {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 10px;
      }

      #${PANEL_ID} .fb-scanner-card {
        padding: 8px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #ffffff;
      }

      #${PANEL_ID} .fb-scanner-card-label {
        display: block;
        margin-bottom: 2px;
        color: #64748b;
        font-size: 10px;
      }

      #${PANEL_ID} .fb-scanner-card-value {
        color: #0f172a;
        font-size: 16px;
        font-weight: 700;
      }

      #${PANEL_ID} .fb-scanner-meta {
        margin-bottom: 10px;
        padding: 8px;
        border-radius: 8px;
        background: #f8fafc;
        word-break: break-word;
      }

      #${PANEL_ID} .fb-scanner-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
      }

      #${PANEL_ID} .fb-scanner-button {
        min-height: 34px;
        margin: 0;
        padding: 6px 8px;
        border: 1px solid #cbd5e1;
        border-radius: 7px;
        background: #ffffff;
        color: #0f172a;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      #${PANEL_ID} .fb-scanner-button:hover {
        background: #f1f5f9;
      }

      #${PANEL_ID} .fb-scanner-button-primary {
        border-color: #2563eb;
        background: #2563eb;
        color: #ffffff;
      }

      #${PANEL_ID} .fb-scanner-button-primary:hover {
        background: #1d4ed8;
      }

      #${PANEL_ID} .fb-scanner-message {
        min-height: 18px;
        margin-top: 8px;
        color: #166534;
        font-size: 11px;
      }

      #${PANEL_ID} .fb-scanner-footer {
        padding: 8px 12px;
        border-top: 1px solid #e2e8f0;
        color: #64748b;
        background: #f8fafc;
        font-size: 10px;
      }

      #${PANEL_ID}.fb-scanner-collapsed {
        width: auto;
      }

      #${PANEL_ID}.fb-scanner-collapsed .fb-scanner-body,
      #${PANEL_ID}.fb-scanner-collapsed .fb-scanner-footer {
        display: none;
      }

      @media (prefers-color-scheme: dark) {
        #${PANEL_ID} {
          border-color: rgba(148, 163, 184, 0.28);
          background: #0f172a;
          color: #e2e8f0;
        }

        #${PANEL_ID} .fb-scanner-header,
        #${PANEL_ID} .fb-scanner-footer {
          border-color: #334155;
          background: #1e293b;
        }

        #${PANEL_ID} .fb-scanner-card {
          border-color: #334155;
          background: #0f172a;
        }

        #${PANEL_ID} .fb-scanner-card-value,
        #${PANEL_ID} .fb-scanner-button {
          color: #e2e8f0;
        }

        #${PANEL_ID} .fb-scanner-meta {
          background: #1e293b;
        }

        #${PANEL_ID} .fb-scanner-button {
          border-color: #475569;
          background: #1e293b;
        }

        #${PANEL_ID} .fb-scanner-button:hover {
          background: #334155;
        }

        #${PANEL_ID} .fb-scanner-button-primary {
          border-color: #2563eb;
          background: #2563eb;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createPanel() {
    if (!CONFIG.showPanel) return;

    addPanelStyles();

    if (document.getElementById(PANEL_ID)) {
      return;
    }

    const panel = document.createElement("aside");

    panel.id = PANEL_ID;

    panel.innerHTML = `
      <div class="fb-scanner-header">
        <div>
          <span class="fb-scanner-title">
            FormBridge Scanner
          </span>
          <span class="fb-scanner-badge">
            PREVIEW
          </span>
        </div>

        <button
          type="button"
          class="fb-scanner-button"
          data-fb-scanner-action="toggle"
          aria-label="Minimize scanner"
          style="min-height:28px;padding:3px 8px;"
        >
          −
        </button>
      </div>

      <div class="fb-scanner-body">
        <div class="fb-scanner-meta">
          <div>
            Step:
            <strong data-fb-scanner-value="step">-</strong>
          </div>
          <div>
            Scan:
            <strong data-fb-scanner-value="scanCount">0</strong>
          </div>
        </div>

        <div class="fb-scanner-summary">
          <div class="fb-scanner-card">
            <span class="fb-scanner-card-label">
              Total fields
            </span>
            <span
              class="fb-scanner-card-value"
              data-fb-scanner-value="fields"
            >
              0
            </span>
          </div>

          <div class="fb-scanner-card">
            <span class="fb-scanner-card-label">
              Japanese fields
            </span>
            <span
              class="fb-scanner-card-value"
              data-fb-scanner-value="japaneseFields"
            >
              0
            </span>
          </div>

          <div class="fb-scanner-card">
            <span class="fb-scanner-card-label">
              Total options
            </span>
            <span
              class="fb-scanner-card-value"
              data-fb-scanner-value="options"
            >
              0
            </span>
          </div>

          <div class="fb-scanner-card">
            <span class="fb-scanner-card-label">
              Japanese options
            </span>
            <span
              class="fb-scanner-card-value"
              data-fb-scanner-value="japaneseOptions"
            >
              0
            </span>
          </div>
        </div>

        <div class="fb-scanner-actions">
          <button
            type="button"
            class="fb-scanner-button fb-scanner-button-primary"
            data-fb-scanner-action="scan"
          >
            Scan sekarang
          </button>

          <button
            type="button"
            class="fb-scanner-button"
            data-fb-scanner-action="console"
          >
            Tampilkan console
          </button>

          <button
            type="button"
            class="fb-scanner-button"
            data-fb-scanner-action="copy-scan"
          >
            Copy full JSON
          </button>

          <button
            type="button"
            class="fb-scanner-button"
            data-fb-scanner-action="download-scan"
          >
            Download full JSON
          </button>

          <button
            type="button"
            class="fb-scanner-button"
            data-fb-scanner-action="copy-template"
          >
            Copy template
          </button>

          <button
            type="button"
            class="fb-scanner-button"
            data-fb-scanner-action="download-template"
          >
            Download template
          </button>

          <button
            type="button"
            class="fb-scanner-button"
            data-fb-scanner-action="reset"
            style="grid-column:1 / -1;"
          >
            Reset hasil scan
          </button>
        </div>

        <div
          class="fb-scanner-message"
          data-fb-scanner-value="message"
        ></div>
      </div>

      <div class="fb-scanner-footer">
        Scanner hanya aktif pada halaman /private/.
        Value form tidak diubah.
      </div>
    `;

    document.body.appendChild(panel);

    panel.addEventListener("click", async (event) => {
      const button =
        event.target.closest(
          "[data-fb-scanner-action]"
        );

      if (!button) return;

      const action =
        button.dataset.fbScannerAction;

      switch (action) {
        case "toggle": {
          panel.classList.toggle(
            "fb-scanner-collapsed"
          );

          button.textContent =
            panel.classList.contains(
              "fb-scanner-collapsed"
            )
              ? "+"
              : "−";

          break;
        }

        case "scan": {
          performScan("manual");
          showPanelMessage(
            "Scan manual selesai."
          );
          break;
        }

        case "console": {
          console.log(
            `[${CONFIG.scannerName}] Full result:`,
            STATE.latestResult
          );

          console.table(
            STATE.latestResult?.fields || []
          );

          showPanelMessage(
            "Hasil ditampilkan di console."
          );
          break;
        }

        case "copy-scan": {
          await copyJsonToClipboard(
            STATE.latestResult
          );
          break;
        }

        case "download-scan": {
          downloadJson(
            STATE.latestResult,
            "scan-result"
          );
          break;
        }

        case "copy-template": {
          await copyJsonToClipboard(
            STATE.latestResult
              ?.translationTemplate || {}
          );
          break;
        }

        case "download-template": {
          downloadJson(
            STATE.latestResult
              ?.translationTemplate || {},
            "translation-template"
          );
          break;
        }

        case "reset": {
          resetScannerData();
          break;
        }

        default:
          break;
      }
    });
  }

  function setPanelValue(name, value) {
    const element = document.querySelector(
      `#${PANEL_ID} [data-fb-scanner-value="${name}"]`
    );

    if (element) {
      element.textContent = String(value);
    }
  }

  function showPanelMessage(message) {
    setPanelValue("message", message);

    window.clearTimeout(
      showPanelMessage.timer
    );

    showPanelMessage.timer =
      window.setTimeout(() => {
        setPanelValue("message", "");
      }, 3500);
  }

  function updatePanel() {
    if (
      !CONFIG.showPanel ||
      !STATE.latestResult
    ) {
      return;
    }

    const { summary } = STATE.latestResult;

    setPanelValue(
      "step",
      STATE.currentStep || "-"
    );

    setPanelValue(
      "scanCount",
      STATE.scanCount
    );

    setPanelValue(
      "fields",
      summary.totalFields
    );

    setPanelValue(
      "japaneseFields",
      summary.japaneseFields
    );

    setPanelValue(
      "options",
      summary.totalOptions
    );

    setPanelValue(
      "japaneseOptions",
      summary.japaneseOptions
    );
  }

  // ============================================================
  // RESET
  // ============================================================

  function resetScannerData() {
    STATE.collectedFields.clear();
    STATE.collectedTexts.clear();
    STATE.collectedButtons.clear();
    STATE.scanCount = 0;
    STATE.lastSignature = "";
    STATE.latestResult = null;

    performScan("reset");

    showPanelMessage(
      "Data scanner berhasil di-reset."
    );

    log("Scanner data di-reset.");
  }

  // ============================================================
  // GLOBAL DEBUG API
  // ============================================================

  function exposeGlobalApi() {
    window.FBPreviewScanner = {
      version: CONFIG.version,

      scan() {
        return performScan("global-api");
      },

      getResult() {
        return STATE.latestResult;
      },

      getFields() {
        return STATE.latestResult?.fields || [];
      },

      getJapaneseFields() {
        return (
          STATE.latestResult?.japaneseFields ||
          []
        );
      },

      getTranslationTemplate() {
        return (
          STATE.latestResult
            ?.translationTemplate || {}
        );
      },

      copyResult() {
        return copyJsonToClipboard(
          STATE.latestResult
        );
      },

      copyTemplate() {
        return copyJsonToClipboard(
          STATE.latestResult
            ?.translationTemplate || {}
        );
      },

      downloadResult() {
        return downloadJson(
          STATE.latestResult,
          "scan-result"
        );
      },

      downloadTemplate() {
        return downloadJson(
          STATE.latestResult
            ?.translationTemplate || {},
          "translation-template"
        );
      },

      reset() {
        return resetScannerData();
      },

      stop() {
        if (STATE.observer) {
          STATE.observer.disconnect();
        }

        if (STATE.intervalId) {
          window.clearInterval(
            STATE.intervalId
          );
        }

        log("Scanner dihentikan.");
      }
    };
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function initialize() {
    if (STATE.initialized) {
      return;
    }

    STATE.initialized = true;

    createPanel();
    exposeGlobalApi();
    startObserver();
    startEventListeners();

    performScan("initial-load");

    if (CONFIG.fallbackInterval > 0) {
      STATE.intervalId =
        window.setInterval(() => {
          scheduleScan("fallback-interval");
        }, CONFIG.fallbackInterval);
    }

    log(
      `Scanner aktif. Versi ${CONFIG.version}`,
      {
        url: window.location.href,
        globalApi: "window.FBPreviewScanner"
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        window.setTimeout(initialize, 500);
      },
      { once: true }
    );
  } else {
    window.setTimeout(initialize, 500);
  }
})();