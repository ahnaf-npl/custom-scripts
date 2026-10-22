
(() => {
  'use strict';

  // =====================================================
  // CONFIGURATION
  // =====================================================
  const CONFIG = {
    tableCode: '家族',
    relationCode: '家族_続柄',

    // Original Japanese values
    defaults: ['父', '母', '兄', '妹'],

    // Run only with ?family_init=1
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
  // URL GUARD
  // =====================================================
  const params = new URLSearchParams(location.search);

  if (params.get(CONFIG.createParam) !== '1') {
    log('Disabled: family_init=1 not present.');
    return;
  }

  // =====================================================
  // STATE
  // =====================================================
  let fb = null;
  let registered = false;
  let initialized = false;
  let autoAddingIndex = null;
  let buttonObserver = null;

  // =====================================================
  // FORMBRIDGE API DETECTION
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
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitUntil(predicate, timeout = 5000) {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = predicate();

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

  function isEmpty(value) {
    return (
      value === undefined ||
      value === null ||
      value === ''
    );
  }

  // =====================================================
  // TARGET FAMILY TABLE
  // =====================================================
  function getTableElement() {
    return document.querySelector(
      '.fb-custom--field' +
      '[data-field-code="家族"]' +
      '[data-field-type="SUBTABLE"]'
    );
  }

  // =====================================================
  // VISIBILITY DETECTION
  // =====================================================

  // FormBridge renders both mobile and desktop
  // layouts in the DOM. One layout can be hidden.
  //
  // We must select ONLY the visible add-row button
  // when triggering an automatic click.

  function isVisible(element) {
    if (!element || !element.isConnected) {
      return false;
    }

    if (element.getClientRects().length === 0) {
      return false;
    }

    let current = element;

    while (current && current.nodeType === 1) {
      const style = getComputedStyle(current);

      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse'
      ) {
        return false;
      }

      current = current.parentElement;
    }

    return true;
  }

  // =====================================================
  // FIND ADD-ROW BUTTONS
  // =====================================================
  function getAddButtons() {
    const table = getTableElement();

    if (!table) return [];

    // Exact structure confirmed from the actual
    // HTML of the 家族 subtable.
    //
    // Both desktop and mobile buttons are returned.
    return [
      ...table.querySelectorAll(
        'div.flex.justify-center.pl-10 > ' +
        'button[type="button"]'
      )
    ];
  }

  function getVisibleAddButton() {
    const buttons = getAddButtons();

    const visibleButtons = buttons.filter(button => {
      return isVisible(button) && !button.disabled;
    });

    if (visibleButtons.length === 1) {
      return visibleButtons[0];
    }

    // Do not click another button by guessing.
    return null;
  }

  // =====================================================
  // BUTTON CSS
  // =====================================================
  function injectStyles() {
    if (
      document.getElementById('fb-family-custom-css')
    ) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'fb-family-custom-css';

    style.textContent = `
      /* ==============================================
         FAMILY SUBTABLE ADD-ROW BUTTON
         Scoped strictly to 家族
         ============================================== */

      .fb-custom--field[data-field-code="家族"]
      div.flex.justify-center.pl-10 {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;

        width: 100% !important;
        padding-left: 0 !important;

        margin-top: 14px !important;
        margin-bottom: 10px !important;
      }

      .fb-custom--field[data-field-code="家族"]
      div.flex.justify-center.pl-10
      > button[type="button"] {
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

        box-shadow: none !important;
        cursor: pointer !important;

        transition:
          background-color .2s ease,
          border-color .2s ease,
          box-shadow .2s ease,
          transform .15s ease !important;
      }

      /* Icon */
      .fb-custom--field[data-field-code="家族"]
      div.flex.justify-center.pl-10
      > button[type="button"] svg {
        width: 21px !important;
        height: 21px !important;

        color: #2563eb !important;
        flex-shrink: 0 !important;
      }

      /* Text label */
      .fb-custom--field[data-field-code="家族"]
      div.flex.justify-center.pl-10
      > button[type="button"]::after {
        content: "Tambah anggota keluarga";

        display: inline-block !important;

        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.4 !important;
        color: #2563eb !important;

        white-space: nowrap !important;
        pointer-events: none !important;
      }

      /* Hover */
      .fb-custom--field[data-field-code="家族"]
      div.flex.justify-center.pl-10
      > button[type="button"]:hover {
        background: #e8f1ff !important;
        border-color: #2563eb !important;

        box-shadow:
          0 2px 8px rgba(37,99,235,.09) !important;
      }

      /* Active */
      .fb-custom--field[data-field-code="家族"]
      div.flex.justify-center.pl-10
      > button[type="button"]:active {
        background: #dbeafe !important;
        transform: scale(.98) !important;
      }

      /* Focus */
      .fb-custom--field[data-field-code="家族"]
      div.flex.justify-center.pl-10
      > button[type="button"]:focus-visible {
        outline: 2px solid #2563eb !important;
        outline-offset: 3px !important;
      }

      /* Disabled */
      .fb-custom--field[data-field-code="家族"]
      div.flex.justify-center.pl-10
      > button[type="button"]:disabled {
        opacity: .5 !important;
        cursor: not-allowed !important;
      }

      /* Mobile */
      @media (max-width: 480px) {
        .fb-custom--field[data-field-code="家族"]
        div.flex.justify-center.pl-10
        > button[type="button"] {
          width: 100% !important;
          max-width: 320px !important;
          min-width: 0 !important;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .fb-custom--field[data-field-code="家族"]
        div.flex.justify-center.pl-10
        > button[type="button"] {
          transition: none !important;
        }
      }
    `;

    document.head.appendChild(style);

    log('Button CSS installed.');
  }

  // =====================================================
  // ACCESSIBILITY LABEL
  // =====================================================
  function enhanceButtons() {
    const buttons = getAddButtons();

    buttons.forEach(button => {
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
        button.setAttribute(
          'title',
          CONFIG.buttonLabel
        );
      }
    });

    return buttons.length;
  }

  function observeButtons() {
    if (buttonObserver) return;

    const table = getTableElement();

    if (!table) return;

    enhanceButtons();

    // Observe child replacement only.
    // CSS automatically styles newly rendered buttons.
    buttonObserver = new MutationObserver(() => {
      enhanceButtons();
    });

    buttonObserver.observe(table, {
      childList: true,
      subtree: true
    });
  }

  // =====================================================
  // FILL EXISTING EMPTY ROWS
  // =====================================================
  function fillExistingRows(context) {
    const rows = getRows();

    for (
      let index = 0;
      index < Math.min(rows.length, PRESETS.length);
      index++
    ) {
      const field = rows[index]?.value?.[FIELD];

      if (!field || !isEmpty(field.value)) {
        continue;
      }

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
          `Failed to fill row ${index + 1}`,
          error
        );
      }
    }
  }

  // =====================================================
  // AUTOMATIC ROW CREATION
  // =====================================================
  async function ensureMinimumRows(context) {
    // Wait for FormBridge layout to finish rendering.
    await sleep(200);

    // At most four attempts are needed.
    for (
      let attempt = 0;
      attempt < PRESETS.length;
      attempt++
    ) {
      const rows = getRows();
      const currentCount = rows.length;

      if (currentCount >= PRESETS.length) {
        break;
      }

      // Find the visible button INSIDE 家族.
      // Ignore the hidden responsive layout.
      const button = await waitUntil(
        getVisibleAddButton,
        5000
      );

      if (!button) {
        const buttons = getAddButtons();

        console.warn(
          PREFIX,
          'Visible add-row button not found.',
          {
            totalButtons: buttons.length,
            visibleButtons:
              buttons.filter(isVisible).length,
            tableFound: !!getTableElement()
          }
        );

        break;
      }

      // Index of the row about to be created.
      autoAddingIndex = currentCount;

      try {
        // Click the native FormBridge button.
        button.click();

        // Wait until FormBridge confirms the new row.
        const added = await waitUntil(
          () => getRows().length > currentCount,
          5000
        );

        if (!added) {
          console.warn(
            PREFIX,
            `Row ${currentCount + 1} was not confirmed.`
          );

          break;
        }

        log(
          `Added row ${currentCount + 1} successfully.`
        );

      } catch (error) {
        console.error(
          PREFIX,
          'Automatic row creation failed:',
          error
        );

        break;
      } finally {
        autoAddingIndex = null;
      }

      // Allow React to complete its update
      // before creating the next row.
      await sleep(100);
    }

    // Fill any existing empty relation fields.
    fillExistingRows(context);

    enhanceButtons();

    const finalRows = getRows();

    log('Initialization finished', finalRows.length);

    log(
      'Final relationship values:',
      finalRows.map(row =>
        row.value?.[FIELD]?.value ?? null
      )
    );
  }

  // =====================================================
  // REGISTER FORMBRIDGE EVENTS
  // =====================================================
  function registerEvents() {
    if (registered) return true;

    fb = resolveFormBridge();

    if (!fb) return false;

    registered = true;

    log('FormBridge V2 API ready');

    // ---------------------------------------------------
    // INITIAL FORM DISPLAY
    // ---------------------------------------------------
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

      injectStyles();

      // First row already exists by default.
      fillExistingRows(context);

      // Create the remaining rows.
      void ensureMinimumRows(context).catch(error => {
        console.error(
          PREFIX,
          'Initialization failed:',
          error
        );
      });

      // Styling / accessibility labels
      requestAnimationFrame(() => {
        enhanceButtons();
        observeButtons();
      });
    });

    // ---------------------------------------------------
    // SUBTABLE ADD ROW EVENT
    // ---------------------------------------------------
    fb.events.on(
      `form.subtable.addRow.${TABLE}`,
      context => {
        // Only prefill when the row is created
        // by our initialization script.
        //
        // Manual user additions remain unchanged.
        if (
          autoAddingIndex === null ||
          autoAddingIndex >= PRESETS.length
        ) {
          return;
        }

        const field =
          context.newRow?.value?.[FIELD];

        if (!field) {
          console.warn(
            PREFIX,
            'New row relation field not found.'
          );

          return;
        }

        // This row was just created automatically,
        // so assign the intended original JP value.
        field.value = PRESETS[autoAddingIndex];

        log(
          `Row ${autoAddingIndex + 1}:`,
          PRESETS[autoAddingIndex]
        );
      }
    );

    return true;
  }

  // =====================================================
  // INITIALIZE
  // =====================================================
  if (registerEvents()) return;

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
        'FormBridge API initialization timed out.'
      );
    }
  }, 100);

})();
