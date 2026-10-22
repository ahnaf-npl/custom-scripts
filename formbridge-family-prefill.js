
(() => {
  'use strict';

  // =========================================================
  // CONFIG
  // =========================================================
  const CONFIG = {
    tableCode: '家族',
    relationCode: '家族_続柄',

    defaults: ['父', '母', '兄', '妹'],

    // Only initialize on URLs with ?family_init=1
    // Do not add this parameter to edit form URLs.
    createParam: 'family_init',

    buttonLabel: 'Tambah anggota keluarga',

    debug: true
  };

  const PREFIX = '[FamilyTable]';
  const TABLE = CONFIG.tableCode;
  const RELATION = CONFIG.relationCode;
  const PRESETS = CONFIG.defaults;

  const log = (...args) => {
    if (CONFIG.debug) console.log(PREFIX, ...args);
  };

  // =========================================================
  // CREATE FORM GUARD
  // =========================================================
  const params = new URLSearchParams(window.location.search);

  if (params.get(CONFIG.createParam) !== '1') {
    log('Disabled: create parameter not present.');
    return;
  }

  if (!window.formBridge?.events?.on) {
    console.error(PREFIX, 'FormBridge V2 API unavailable');
    return;
  }

  let initialized = false;
  let initializing = false;
  let autoAddingIndex = null;
  let observer = null;
  let decorationScheduled = false;

  // =========================================================
  // HELPERS
  // =========================================================
  function getRows() {
    return formBridge.fn.getRecord()?.[TABLE]?.value || [];
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitUntil(predicate, timeout = 3000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = predicate();
      if (result) return result;
      await sleep(80);
    }

    return null;
  }

  function isFilled(value) {
    if (value === null || value === undefined || value === '') {
      return false;
    }

    if (Array.isArray(value)) return value.length > 0;

    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }

    return true;
  }

  function hasExistingData(rows) {
    return rows.some(row =>
      Object.values(row.value || {}).some(field =>
        isFilled(field?.value)
      )
    );
  }

  // =========================================================
  // DETECT NATIVE ADD-ROW BUTTON
  // =========================================================

  // Match the actual Material Design plus-circle path.
  // This intentionally avoids the minus-circle button.
  const PLUS_PATH =
    'm511h-4v4h-2v-4H7v-2h4V7h2v4h4z';

  function isNativeAddButton(button) {
    const paths = button.querySelectorAll('svg path[d]');

    return [...paths].some(path => {
      const d = (path.getAttribute('d') || '')
        .replace(/\s+/g, '');

      return d.includes(PLUS_PATH);
    });
  }

  function getAddButton() {
    // First: exact structure from the user's FormBridge HTML
    const primary = [
      ...document.querySelectorAll(
        'div.flex.justify-center.pl-10 > button[type="button"]'
      )
    ].filter(isNativeAddButton);

    const candidates = primary.length
      ? primary
      : [...document.querySelectorAll(
          'button[type="button"]'
        )].filter(isNativeAddButton);

    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    // Multiple subtables:
    // Try to find the button belonging to 家族.
    const anchor =
      document.querySelector(
        `[data-table-code="${TABLE}"]`
      ) ||
      document.querySelector(
        `.fb-custom--field[data-field-code="${TABLE}"]`
      );

    if (anchor) {
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
    }

    // Fail safely rather than altering another subtable
    return null;
  }

  // =========================================================
  // BUTTON STYLING
  // =========================================================
  function injectStyles() {
    if (document.getElementById('fb-family-style')) return;

    const style = document.createElement('style');
    style.id = 'fb-family-style';

    style.textContent = `
      /* Add button wrapper */
      .fb-family-add-wrap {
        padding-left: 0 !important;
        display: flex !important;
        justify-content: center !important;
        width: 100% !important;
        margin-top: 14px !important;
        margin-bottom: 10px !important;
      }

      /* Native add button */
      button.fb-family-add-button {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 9px !important;

        width: auto !important;
        min-width: 230px !important;
        min-height: 46px !important;

        padding: 11px 20px !important;

        background: #f3f8ff !important;
        border: 1.5px dashed #91b7f1 !important;
        border-radius: 10px !important;

        color: #2563eb !important;
        font-family: inherit !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.4 !important;

        box-shadow: none !important;
        cursor: pointer !important;

        transition:
          background-color 0.2s ease,
          border-color 0.2s ease,
          box-shadow 0.2s ease,
          transform 0.2s ease !important;
      }

      /* Plus icon */
      button.fb-family-add-button svg {
        width: 20px !important;
        height: 20px !important;
        color: #2563eb !important;
        flex-shrink: 0 !important;
      }

      /* Text label - CSS only, no React DOM modification */
      button.fb-family-add-button::after {
        content: "Tambah anggota keluarga";
        display: inline-block;
        color: #2563eb;
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
        white-space: nowrap;
        pointer-events: none;
      }

      /* Hover */
      button.fb-family-add-button:hover {
        background: #e5f0ff !important;
        border-color: #2563eb !important;
        box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08)
          !important;
      }

      /* Active */
      button.fb-family-add-button:active {
        transform: scale(0.98) !important;
        background: #dbeafe !important;
      }

      /* Keyboard focus */
      button.fb-family-add-button:focus-visible {
        outline: 2px solid #2563eb !important;
        outline-offset: 3px !important;
      }

      /* Disabled */
      button.fb-family-add-button:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }

      /* Mobile */
      @media (max-width: 480px) {
        button.fb-family-add-button {
          width: 100% !important;
          max-width: 320px !important;
          min-width: 0 !important;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        button.fb-family-add-button {
          transition: none !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // =========================================================
  // DECORATE BUTTON
  // =========================================================
  function decorateAddButton() {
    const button = getAddButton();

    if (!button) return false;

    button.classList.add('fb-family-add-button');

    if (
      button.getAttribute('aria-label') !==
      CONFIG.buttonLabel
    ) {
      button.setAttribute(
        'aria-label',
        CONFIG.buttonLabel
      );
    }

    const wrapper = button.parentElement;

    if (wrapper) {
      wrapper.classList.add('fb-family-add-wrap');
    }

    return true;
  }

  function scheduleDecorate() {
    if (decorationScheduled) return;

    decorationScheduled = true;

    requestAnimationFrame(() => {
      decorationScheduled = false;
      decorateAddButton();
    });
  }

  // FormBridge uses React.
  // Button nodes may be recreated after subtable changes.
  function observeButton() {
    if (observer || !document.body) return;

    observer = new MutationObserver(() => {
      scheduleDecorate();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // =========================================================
  // PREFILL EXISTING ROWS
  // =========================================================
  function fillExistingRows(context) {
    const rows = getRows();

    rows.slice(0, PRESETS.length).forEach((row, index) => {
      const field = row?.value?.[RELATION];

      if (!field) return;

      // Never overwrite existing values
      if (isFilled(field.value)) return;

      try {
        context.setSubtableFieldValue(
          TABLE,
          RELATION,
          index,
          PRESETS[index]
        );

        log(`Row ${index + 1}: ${PRESETS[index]}`);
      } catch (error) {
        console.warn(
          PREFIX,
          `Failed to prefill row ${index + 1}`,
          error
        );
      }
    });
  }

  // =========================================================
  // ENSURE MINIMUM FOUR ROWS
  // =========================================================
  async function ensureMinimumRows(context) {
    await sleep(150);

    for (let attempt = 0; attempt < PRESETS.length; attempt++) {
      const count = getRows().length;

      if (count >= PRESETS.length) break;

      const button = await waitUntil(
        () => getAddButton(),
        4000
      );

      if (!button) {
        console.warn(
          PREFIX,
          'Native add button not found.'
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
            'New row was not confirmed.'
          );
          break;
        }

        log(`Added row ${count + 1}`);
      } catch (error) {
        console.error(PREFIX, 'Add row failed', error);
        break;
      } finally {
        autoAddingIndex = null;
      }
    }

    // Fill remaining empty rows with original JP values
    fillExistingRows(context);

    // Apply styling after the table is ready
    scheduleDecorate();

    initializing = false;

    log('Initialization finished', getRows().length);
  }

  // =========================================================
  // FORM SHOW EVENT
  // =========================================================
  formBridge.events.on('form.show', (context) => {
    if (initialized) return;
    initialized = true;

    const rows = getRows();

    if (!rows.length) {
      console.warn(PREFIX, 'Subtable not available.');
      return;
    }

    // Avoid changing existing records or populated tables
    if (hasExistingData(rows)) {
      log('Existing data detected. Prefill skipped.');
      return;
    }

    initializing = true;

    injectStyles();
    observeButton();
    scheduleDecorate();

    // Set values for rows already rendered
    fillExistingRows(context);

    // Add missing rows if needed
    void ensureMinimumRows(context);
  });

  // =========================================================
  // SUBTABLE ADD ROW EVENT
  // =========================================================
  formBridge.events.on(
    `form.subtable.addRow.${TABLE}`,
    (context) => {
      // Only automatically fill rows during initialization
      if (
        initializing &&
        autoAddingIndex !== null &&
        autoAddingIndex < PRESETS.length
      ) {
        const field =
          context.newRow?.value?.[RELATION];

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

  // =========================================================
  // SUBTABLE REMOVE ROW EVENT
  // =========================================================
  formBridge.events.on(
    `form.subtable.removeRow.${TABLE}`,
    () => {
      scheduleDecorate();
    }
  );

})();
