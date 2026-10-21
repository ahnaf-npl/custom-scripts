
(() => {
  'use strict';

  // =========================================================
  // CONFIG
  // =========================================================
  const CONFIG = {
    // Field code subtable dan kolom hubungan
    tableCode: 'family_table',
    relationCode: 'hubungan',

    // Value ASLI Jepang, bukan label terjemahan
    defaults: ['父', '母', '兄', '妹'],

    // false: otomatis setiap form dibuka
    // true: hanya URL dengan ?prefill_family=1
    onlyWithUrlParam: false,
    urlParam: 'prefill_family',

    // Label tombol (UI saja)
    buttonLabel: 'Tambah anggota keluarga',

    // Debug console
    debug: true
  };

  // =========================================================
  // STATE
  // =========================================================
  if (typeof formBridge === 'undefined' ||
      !formBridge.events?.on) {
    console.error('[FamilyTable] FormBridge V2 not found');
    return;
  }

  const log = (...args) => {
    if (CONFIG.debug) console.log('[FamilyTable]', ...args);
  };

  const TABLE = CONFIG.tableCode;
  const RELATION = CONFIG.relationCode;
  const PRESETS = CONFIG.defaults;
  const MIN_ROWS = PRESETS.length;

  let initialized = false;
  let autoAddingIndex = null;
  let observer = null;
  let decorateScheduled = false;

  // =========================================================
  // HELPERS
  // =========================================================
  const getRows = () =>
    formBridge.fn.getRecord()?.[TABLE]?.value ?? [];

  const shouldPrefill = () => {
    if (!CONFIG.onlyWithUrlParam) return true;
    return new URLSearchParams(location.search)
      .get(CONFIG.urlParam) === '1';
  };

  const escapeAttr = (value) =>
    String(value).replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');

  const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

  async function waitUntil(predicate, timeout = 2500) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = predicate();
      if (result) return result;
      await sleep(70);
    }

    return null;
  }

  // =========================================================
  // FIND NATIVE ADD BUTTON
  // =========================================================
  function isAddButton(button) {
    const path = button.querySelector('svg path[d]');

    if (!path) return false;

    // Native FormBridge plus-circle icon
    const d = path.getAttribute('d') || '';

    // Some SVGs contain an invisible first path
    const paths = [...button.querySelectorAll('svg path[d]')];

    return d.startsWith('M12 2C6.48') ||
      paths.some(p =>
        (p.getAttribute('d') || '')
          .startsWith('M12 2C6.48')
      );
  }

  function findAddIn(container) {
    if (!container) return null;

    const buttons = container.querySelectorAll(
      'button[type="button"]'
    );

    return [...buttons].find(isAddButton) || null;
  }

  function getAddButton() {
    const code = escapeAttr(TABLE);

    // Try direct table field container
    const tableField = document.querySelector(
      `.fb-custom--field[data-field-code="${code}"]`
    );

    const direct = findAddIn(tableField);
    if (direct) return direct;

    // Fallback: find nearest ancestor of this table's row
    const row = document.querySelector(
      `.fb-custom--row[data-table-code="${code}"]`
    );

    let current = row?.parentElement;

    while (current && current !== document.body) {
      const button = findAddIn(current);
      if (button) return button;
      current = current.parentElement;
    }

    return null;
  }

  // =========================================================
  // BUTTON DESIGN
  // =========================================================
  function injectStyles() {
    if (document.getElementById('fb-family-styles')) return;

    const style = document.createElement('style');
    style.id = 'fb-family-styles';

    style.textContent = `
      .fb-family-add-wrap {
        padding-left: 0 !important;
        justify-content: center !important;
        margin-top: 14px !important;
        margin-bottom: 6px !important;
      }

      .fb-family-add-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 9px !important;
        width: auto !important;
        min-height: 44px !important;
        padding: 10px 18px !important;
        border: 1px dashed #93b4ed !important;
        border-radius: 10px !important;
        background: #f5f9ff !important;
        color: #2563eb !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.4 !important;
        cursor: pointer !important;
        transition: background .15s ease,
                    border-color .15s ease !important;
      }

      .fb-family-add-btn:hover {
        background: #eaf2ff !important;
        border-color: #2563eb !important;
      }

      .fb-family-add-btn:focus-visible {
        outline: 2px solid #2563eb !important;
        outline-offset: 3px !important;
      }

      .fb-family-add-btn svg {
        width: 20px !important;
        height: 20px !important;
        flex-shrink: 0 !important;
        color: #2563eb !important;
      }

      .fb-family-add-label {
        white-space: nowrap;
        pointer-events: none;
      }

      @media (max-width: 480px) {
        .fb-family-add-btn {
          width: 100% !important;
          max-width: 320px !important;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function decorateAddButton() {
    const button = getAddButton();
    if (!button) return;

    button.classList.add('fb-family-add-btn');

    button.setAttribute(
      'aria-label', CONFIG.buttonLabel
    );

    button.setAttribute(
      'title', CONFIG.buttonLabel
    );

    const wrapper = button.parentElement;
    wrapper?.classList.add('fb-family-add-wrap');

    let label = button.querySelector(
      '.fb-family-add-label'
    );

    if (!label) {
      label = document.createElement('span');
      label.className = 'fb-family-add-label';
      button.appendChild(label);
    }

    if (label.textContent !== CONFIG.buttonLabel) {
      label.textContent = CONFIG.buttonLabel;
    }
  }

  function scheduleDecorate() {
    if (decorateScheduled) return;
    decorateScheduled = true;

    requestAnimationFrame(() => {
      decorateScheduled = false;
      decorateAddButton();
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

  // =========================================================
  // INITIAL RELATION VALUES
  // =========================================================
  function fillExistingRows(context) {
    const rows = getRows();

    rows.slice(0, MIN_ROWS).forEach((row, index) => {
      const cell = row?.value?.[RELATION];
      if (!cell) return;

      // Never overwrite an existing selection
      if (cell.value !== '' &&
          cell.value !== null &&
          cell.value !== undefined) {
        return;
      }

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
          '[FamilyTable] Failed to set row',
          index,
          error
        );
      }
    });
  }

  // =========================================================
  // ENSURE FOUR INITIAL ROWS
  // =========================================================
  async function ensureMinimumRows(context) {
    // Allow FormBridge to finish initial rendering
    await sleep(150);

    for (let attempt = 0; attempt < MIN_ROWS; attempt++) {
      const count = getRows().length;

      if (count >= MIN_ROWS) break;

      const button = await waitUntil(
        () => getAddButton()
      );

      if (!button) {
        console.warn(
          '[FamilyTable] Native add button not found. ' +
          'Set minimum rows to 4 in FormBridge settings.'
        );
        return;
      }

      // Mark index for the addRow event
      autoAddingIndex = count;

      try {
        button.click();

        const added = await waitUntil(
          () => getRows().length > count
        );

        if (!added) {
          console.warn(
            '[FamilyTable] Row addition timed out.'
          );
          return;
        }

        log('Added row', count + 1);
      } finally {
        autoAddingIndex = null;
      }
    }

    // Fill any remaining empty relation fields
    fillExistingRows(context);
    scheduleDecorate();

    log('Initialization finished', getRows().length);
  }

  // =========================================================
  // FORMBRIDGE EVENTS
  // =========================================================

  // Initial form display
  formBridge.events.on('form.show', (context) => {
    injectStyles();
    observeButton();
    scheduleDecorate();

    if (initialized || !shouldPrefill()) return;
    if (!getRows().length) return;

    initialized = true;

    // Existing rows
    fillExistingRows(context);

    // Add missing rows
    void ensureMinimumRows(context);
  });

  // When FormBridge creates a new row
  formBridge.events.on(
    `form.subtable.addRow.${TABLE}`,
    (context) => {
      if (
        autoAddingIndex !== null &&
        autoAddingIndex < MIN_ROWS
      ) {
        const cell =
          context.newRow?.value?.[RELATION];

        if (cell) {
          cell.value = PRESETS[autoAddingIndex];
        }
      }

      scheduleDecorate();
    }
  );

  // Preserve button design after removing a row
  formBridge.events.on(
    `form.subtable.removeRow.${TABLE}`,
    () => {
      scheduleDecorate();
    }
  );

})();
