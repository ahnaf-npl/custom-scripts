
(() => {
  'use strict';

  // =====================================================
  // CONFIGURATION
  // =====================================================
  const CONFIG = {
    tableCode: '家族',
    relationCode: '家族_続柄',

    // Actual Japanese dropdown values
    defaults: ['父', '母', '兄', '妹'],

    // Create-form URL must contain ?family_init=1
    createParam: 'family_init',

    buttonLabel: 'Tambah anggota keluarga',
    debug: true
  };

  const PREFIX = '[FamilyTable]';
  const TABLE = CONFIG.tableCode;
  const FIELD = CONFIG.relationCode;
  const PRESETS = CONFIG.defaults;

  const log = (...args) => {
    if (CONFIG.debug) console.log(PREFIX, ...args);
  };

  // =====================================================
  // CREATE URL GUARD
  // =====================================================
  const params = new URLSearchParams(location.search);

  if (params.get(CONFIG.createParam) !== '1') {
    log('Disabled: create parameter not present.');
    return;
  }

  // =====================================================
  // STATE
  // =====================================================
  let fb = null;
  let registered = false;
  let initialized = false;
  let autoAddingIndex = null;
  let observer = null;
  let decorationScheduled = false;
  let buttonStyled = false;

  // =====================================================
  // API DETECTION
  // =====================================================
  function resolveFormBridge() {
    try {
      if (
        typeof formBridge !== 'undefined' &&
        typeof formBridge.events?.on === 'function'
      ) {
        return formBridge;
      }
    } catch (_) {}

    try {
      if (
        window.formBridge &&
        typeof window.formBridge.events?.on === 'function'
      ) {
        return window.formBridge;
      }
    } catch (_) {}

    return null;
  }

  // =====================================================
  // HELPERS
  // =====================================================
  const sleep = ms =>
    new Promise(resolve => setTimeout(resolve, ms));

  async function waitUntil(fn, timeout = 4000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = fn();
      if (result) return result;
      await sleep(80);
    }

    return null;
  }

  function getRows() {
    try {
      return fb.fn.getRecord()?.[TABLE]?.value ?? [];
    } catch (_) {
      return [];
    }
  }

  function isFilled(value) {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return true;
  }

  // =====================================================
  // FIND NATIVE ADD-ROW BUTTON
  // =====================================================
  function isPlusButton(button) {
    if (!button || button.tagName !== 'BUTTON') {
      return false;
    }

    return [
      ...button.querySelectorAll('svg path[d]')
    ].some(path => {
      const d = (path.getAttribute('d') || '')
        .replace(/\s+/g, '');

      // Original FormBridge plus-circle SVG
      return d.includes('m511h-4v4h');
    });
  }

  function getAddButton() {
    // Primary: actual FormBridge button structure
    const primary = [
      ...document.querySelectorAll(
        'div.flex.justify-center.pl-10 > button[type="button"]'
      )
    ].filter(isPlusButton);

    const candidates = primary.length
      ? primary
      : [
          ...document.querySelectorAll(
            'button[type="button"]'
          )
        ].filter(isPlusButton);

    if (candidates.length === 1) {
      return candidates[0];
    }

    if (!candidates.length) return null;

    // Multiple subtables: locate the 家族 container
    const anchor = document.querySelector(
      `[data-table-code="${TABLE}"],` +
      `[data-field-code="${TABLE}"]`
    );

    if (!anchor) return null;

    let parent = anchor.parentElement;

    while (parent && parent !== document.body) {
      const matches = candidates.filter(button =>
        parent.contains(button)
      );

      if (matches.length === 1) {
        return matches[0];
      }

      parent = parent.parentElement;
    }

    return null;
  }

  // =====================================================
  // ADD BUTTON CSS
  // =====================================================
  function injectStyles() {
    if (document.getElementById('family-table-css')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'family-table-css';

    style.textContent = `
      .family-add-wrapper {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        padding-left: 0 !important;
        margin-top: 14px !important;
        margin-bottom: 10px !important;
        width: 100% !important;
      }

      button.family-add-button {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;

        width: auto !important;
        min-width: 230px !important;
        min-height: 46px !important;
        padding: 11px 20px !important;

        background: #f4f8ff !important;
        border: 1.5px dashed #93b4ed !important;
        border-radius: 10px !important;

        color: #2563eb !important;
        font-family: inherit !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.4 !important;

        cursor: pointer !important;
        box-shadow: none !important;

        transition:
          background-color .2s ease,
          border-color .2s ease,
          transform .15s ease !important;
      }

      button.family-add-button svg {
        width: 21px !important;
        height: 21px !important;
        color: #2563eb !important;
        flex-shrink: 0 !important;
      }

      button.family-add-button::after {
        content: "Tambah anggota keluarga";
        display: inline-block !important;
        color: #2563eb !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
      }

      button.family-add-button:hover {
        background: #e8f1ff !important;
        border-color: #2563eb !important;
      }

      button.family-add-button:active {
        background: #dbeafe !important;
        transform: scale(.98) !important;
      }

      button.family-add-button:focus-visible {
        outline: 2px solid #2563eb !important;
        outline-offset: 3px !important;
      }

      button.family-add-button:disabled {
        opacity: .5 !important;
        cursor: not-allowed !important;
      }

      @media (max-width: 480px) {
        button.family-add-button {
          width: 100% !important;
          max-width: 320px !important;
          min-width: 0 !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        button.family-add-button {
          transition: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // =====================================================
  // BUTTON DECORATION
  // =====================================================
  function decorateButton() {
    const button = getAddButton();

    if (!button) return false;

    button.classList.add('family-add-button');

    const wrapper = button.parentElement;

    if (wrapper) {
      wrapper.classList.add('family-add-wrapper');
    }

    if (
      button.getAttribute('aria-label') !==
      CONFIG.buttonLabel
    ) {
      button.setAttribute(
        'aria-label',
        CONFIG.buttonLabel
      );
    }

    if (
      button.getAttribute('title') !==
      CONFIG.buttonLabel
    ) {
      button.setAttribute('title', CONFIG.buttonLabel);
    }

    if (!buttonStyled) {
      buttonStyled = true;
      log('Add-row button styled successfully.');
    }

    return true;
  }

  function scheduleDecorate() {
    if (decorationScheduled) return;

    decorationScheduled = true;

    requestAnimationFrame(() => {
      decorationScheduled = false;
      decorateButton();
    });
  }

  function observeButton() {
    if (observer || !document.body) return;

    observer = new MutationObserver(scheduleDecorate);

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // =====================================================
  // PREFILL EXISTING ROWS
  // =====================================================
  function fillExistingRows(context) {
    const rows = getRows();

    rows.slice(0, PRESETS.length).forEach(
      (row, index) => {
        const field = row?.value?.[FIELD];

        if (!field) return;

        // Do not overwrite existing selections
        if (isFilled(field.value)) return;

        try {
          context.setSubtableFieldValue(
            TABLE,
            FIELD,
            index,
            PRESETS[index]
          );

          log(`Row ${index + 1}: ${PRESETS[index]}`);
        } catch (error) {
          console.error(
            PREFIX,
            `Failed to prefill row ${index + 1}`,
            error
          );
        }
      }
    );
  }

  // =====================================================
  // ENSURE FOUR ROWS
  // =====================================================
  async function ensureMinimumRows(context) {
    await sleep(150);

    for (let attempt = 0; attempt < PRESETS.length; attempt++) {
      const count = getRows().length;

      if (count >= PRESETS.length) break;

      const button = await waitUntil(
        getAddButton,
        4000
      );

      if (!button) {
        console.warn(
          PREFIX,
          'Native add-row button not found.'
        );
        break;
      }

      autoAddingIndex = count;

      try {
        button.click();

        const added = await waitUntil(
          () => getRows().length > count,
          4000
        );

        if (!added) {
          console.warn(
            PREFIX,
            'Row addition not confirmed.'
          );
          break;
        }

        log(`Added row ${count + 1}`);
      } catch (error) {
        console.error(PREFIX, 'Add row error:', error);
        break;
      } finally {
        autoAddingIndex = null;
      }
    }

    fillExistingRows(context);
    scheduleDecorate();

    log('Initialization finished', getRows().length);
  }

  // =====================================================
  // REGISTER EVENTS
  // =====================================================
  function registerEvents() {
    if (registered) return true;

    fb = resolveFormBridge();

    if (!fb) return false;

    registered = true;
    log('FormBridge V2 API ready');

    // -----------------------------------------------------
    // FORM SHOW
    // -----------------------------------------------------
    fb.events.on('form.show', context => {
      if (initialized) return;
      initialized = true;

      const record = fb.fn.getRecord();

      if (!record?.[TABLE]) {
        console.warn(
          PREFIX,
          'Subtable 家族 not found.'
        );
        return;
      }

      // Important:
      // No hasExistingData() check.
      // Create mode is controlled by family_init=1.
      // Each existing field is protected individually.

      injectStyles();
      observeButton();
      scheduleDecorate();

      fillExistingRows(context);

      void ensureMinimumRows(context).catch(error => {
        console.error(
          PREFIX,
          'Initialization error:',
          error
        );
      });
    });

    // -----------------------------------------------------
    // ADD ROW
    // -----------------------------------------------------
    fb.events.on(
      `form.subtable.addRow.${TABLE}`,
      context => {
        if (
          autoAddingIndex !== null &&
          autoAddingIndex < PRESETS.length
        ) {
          const field =
            context.newRow?.value?.[FIELD];

          if (field && !isFilled(field.value)) {
            field.value = PRESETS[autoAddingIndex];

            log(
              `New row ${autoAddingIndex + 1}:`,
              PRESETS[autoAddingIndex]
            );
          }
        }

        scheduleDecorate();
      }
    );

    // -----------------------------------------------------
    // REMOVE ROW
    // -----------------------------------------------------
    fb.events.on(
      `form.subtable.removeRow.${TABLE}`,
      () => {
        scheduleDecorate();
      }
    );

    return true;
  }

  // =====================================================
  // START
  // =====================================================
  if (registerEvents()) return;

  // Wait if FormBridge API has not loaded yet
  let attempts = 0;
  const maxAttempts = 100;

  const timer = setInterval(() => {
    attempts++;

    if (registerEvents()) {
      clearInterval(timer);
      return;
    }

    if (attempts >= maxAttempts) {
      clearInterval(timer);

      console.error(
        PREFIX,
        'FormBridge API could not be initialized.'
      );
    }
  }, 100);

})();
