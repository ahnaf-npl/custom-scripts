
(() => {
  'use strict';

  // ======================================================
  // CONFIG
  // ======================================================
  const CONFIG = {
    tableCode: '家族',
    relationCode: '家族_続柄',

    defaults: ['父', '母', '兄', '妹'],

    // Script hanya aktif jika URL memiliki ?family_init=1
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

  // ======================================================
  // CREATE-ONLY PROTECTION
  // ======================================================

  const params = new URLSearchParams(window.location.search);

  if (params.get(CONFIG.createParam) !== '1') {
    log('Customization disabled: not a create-prefill URL.');
    return;
  }

  if (!window.formBridge?.events?.on) {
    console.error(PREFIX, 'FormBridge V2 API unavailable.');
    return;
  }

  let initialized = false;
  let initializationAllowed = false;
  let pendingRowIndex = null;
  let observer = null;
  let decorating = false;

  // ======================================================
  // RECORD HELPERS
  // ======================================================

  function getRows() {
    return formBridge.fn.getRecord()?.[TABLE]?.value ?? [];
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

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitUntil(fn, timeout = 4000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = fn();
      if (result) return result;
      await sleep(80);
    }

    return null;
  }

  // ======================================================
  // FIND NATIVE ADD-ROW BUTTON
  // ======================================================

  function isNativeAddButton(button) {
    const paths = button.querySelectorAll('svg path[d]');

    return [...paths].some(path => {
      const d = path.getAttribute('d') || '';
      return d.includes('M12 2C6.48');
    });
  }

  function getAddButton() {
    const buttons = [
      ...document.querySelectorAll('button')
    ].filter(isNativeAddButton);

    if (!buttons.length) return null;

    // Find anchors belonging to the target table
    const anchor =
      document.querySelector(
        `.fb-custom--row[data-table-code="${TABLE}"]`
      ) ||
      document.querySelector(
        `[data-table-code="${TABLE}"]`
      ) ||
      document.querySelector(
        `.fb-custom--field[data-field-code="${TABLE}"]`
      );

    // Prefer a plus button inside the table's own container
    if (anchor) {
      let parent = anchor.parentElement;

      while (parent && parent !== document.body) {
        const matches = buttons.filter(btn =>
          parent.contains(btn)
        );

        if (matches.length === 1) {
          return matches[0];
        }

        if (matches.length > 1) {
          return null;
        }

        parent = parent.parentElement;
      }
    }

    // Safe fallback: only when exactly one plus button exists
    if (buttons.length === 1) {
      return buttons[0];
    }

    return null;
  }

  // ======================================================
  // BUTTON APPEARANCE
  // ======================================================

  function addStyles() {
    if (document.getElementById('family-table-css')) return;

    const style = document.createElement('style');
    style.id = 'family-table-css';

    style.textContent = `
      .family-add-button {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 9px !important;
        padding: 11px 20px !important;
        min-height: 46px !important;
        border: 1px dashed #93b4ed !important;
        border-radius: 10px !important;
        background: #f4f8ff !important;
        color: #2563eb !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
      }

      .family-add-button:hover {
        background: #e8f1ff !important;
        border-color: #2563eb !important;
      }

      .family-add-button:focus-visible {
        outline: 2px solid #2563eb !important;
        outline-offset: 3px !important;
      }

      .family-add-button svg {
        width: 20px !important;
        height: 20px !important;
        color: #2563eb !important;
        flex-shrink: 0 !important;
      }

      .family-add-label {
        font-size: 14px;
        line-height: 1.4;
        white-space: nowrap;
        pointer-events: none;
      }

      .family-add-button-wrap {
        padding-left: 0 !important;
        margin-top: 12px !important;
        margin-bottom: 8px !important;
        justify-content: center !important;
      }

      @media (max-width: 480px) {
        .family-add-button {
          width: 100% !important;
          max-width: 300px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function decorateButton() {
    const button = getAddButton();

    if (!button) return;

    button.classList.add('family-add-button');
    button.parentElement?.classList.add(
      'family-add-button-wrap'
    );

    button.setAttribute('aria-label', CONFIG.buttonLabel);
    button.setAttribute('title', CONFIG.buttonLabel);

    let label = button.querySelector('.family-add-label');

    if (!label) {
      label = document.createElement('span');
      label.className = 'family-add-label';
      button.appendChild(label);
    }

    if (label.textContent !== CONFIG.buttonLabel) {
      label.textContent = CONFIG.buttonLabel;
    }
  }

  function scheduleDecorate() {
    if (decorating) return;
    decorating = true;

    requestAnimationFrame(() => {
      decorating = false;
      decorateButton();
    });
  }

  function startObserver() {
    if (observer || !document.body) return;

    observer = new MutationObserver(scheduleDecorate);

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // ======================================================
  // PREFILL EXISTING EMPTY ROWS
  // ======================================================

  function fillRows(context) {
    const rows = getRows();

    for (let i = 0; i < Math.min(rows.length, PRESETS.length); i++) {
      const field = rows[i]?.value?.[FIELD];

      if (!field || isFilled(field.value)) continue;

      try {
        context.setSubtableFieldValue(
          TABLE,
          FIELD,
          i,
          PRESETS[i]
        );

        log(`Prefilled row ${i + 1}: ${PRESETS[i]}`);
      } catch (error) {
        console.error(
          PREFIX,
          `Could not prefill row ${i + 1}`,
          error
        );
      }
    }
  }

  // ======================================================
  // ADD MISSING ROWS
  // ======================================================

  async function ensureRows() {
    for (let attempt = 0; attempt < PRESETS.length; attempt++) {
      const count = getRows().length;

      if (count >= PRESETS.length) {
        log('Minimum row count reached:', count);
        return;
      }

      const button = await waitUntil(getAddButton, 4000);

      if (!button) {
        console.warn(
          PREFIX,
          'Could not identify the native add-row button. ' +
          'No further changes will be made.'
        );
        return;
      }

      pendingRowIndex = count;

      try {
        button.click();

        const added = await waitUntil(
          () => getRows().length > count,
          4000
        );

        if (!added) {
          console.warn(
            PREFIX,
            'Row addition was not confirmed.'
          );
          return;
        }

        log(`Added row ${count + 1}`);
      } catch (error) {
        console.error(PREFIX, 'Add-row error:', error);
        return;
      } finally {
        pendingRowIndex = null;
      }
    }
  }

  // ======================================================
  // ADD ROW EVENT
  // ======================================================

  formBridge.events.on(
    `form.subtable.addRow.${TABLE}`,
    (context) => {
      if (!initializationAllowed) return;

      if (
        pendingRowIndex === null ||
        pendingRowIndex >= PRESETS.length
      ) {
        return;
      }

      const field = context.newRow?.value?.[FIELD];

      if (!field) {
        console.warn(PREFIX, 'New row relation field missing.');
        return;
      }

      // Set the ORIGINAL Japanese value
      if (!isFilled(field.value)) {
        field.value = PRESETS[pendingRowIndex];

        log(
          `New row ${pendingRowIndex + 1}:`,
          PRESETS[pendingRowIndex]
        );
      }
    }
  );

  // ======================================================
  // FORM SHOW
  // ======================================================

  formBridge.events.on('form.show', (context) => {
    if (initialized) return;
    initialized = true;

    const rows = getRows();

    if (!rows.length) {
      console.warn(PREFIX, 'Family table not found.');
      return;
    }

    // Critical safety check:
    // Never alter a subtable containing existing data.
    if (hasExistingData(rows)) {
      log('Existing family data detected. Skipping.');
      return;
    }

    initializationAllowed = true;

    addStyles();
    startObserver();
    scheduleDecorate();

    // Fill rows that already exist in FormBridge
    fillRows(context);

    // Add missing rows through the original FormBridge button
    void ensureRows().finally(() => {
      initializationAllowed = false;
      scheduleDecorate();

      log('Final row count:', getRows().length);
    });
  });

})();
