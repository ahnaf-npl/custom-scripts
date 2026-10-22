
(() => {
  'use strict';

  // =========================================================
  // CONFIGURATION
  // =========================================================
  const CONFIG = {
    tableCode: '家族',
    relationCode: '家族_続柄',

    // Original Japanese dropdown values
    defaults: ['父', '母', '兄', '妹'],

    // Only activate with ?family_init=1
    createParam: 'family_init',

    // Add-row button text
    buttonLabel: 'Tambah anggota keluarga',

    // Debug logging
    debug: true
  };

  // =========================================================
  // CONSTANTS & STATE
  // =========================================================
  const PREFIX = '[FamilyTable]';
  const TABLE = CONFIG.tableCode;
  const RELATION = CONFIG.relationCode;
  const PRESETS = CONFIG.defaults;

  let fb = null;
  let registered = false;
  let initialized = false;
  let initializing = false;
  let autoAddingIndex = null;
  let observer = null;
  let decorationScheduled = false;
  let warnedMultipleButtons = false;

  const log = (...args) => {
    if (CONFIG.debug) {
      console.log(PREFIX, ...args);
    }
  };

  // =========================================================
  // CREATE URL GUARD
  // =========================================================
  const params = new URLSearchParams(
    window.location.search
  );

  if (params.get(CONFIG.createParam) !== '1') {
    log('Disabled: family_init=1 not present.');
    return;
  }

  // =========================================================
  // FORMBRIDGE API DETECTION
  // =========================================================

  // Important:
  // Do not rely exclusively on window.formBridge.
  // Resolve the actual FormBridge API when available.

  function resolveFormBridge() {
    try {
      if (
        typeof formBridge !== 'undefined' &&
        typeof formBridge?.events?.on === 'function'
      ) {
        return formBridge;
      }
    } catch (error) {
      // API not ready yet
    }

    try {
      const candidate = window.formBridge;

      if (
        candidate &&
        typeof candidate.events?.on === 'function'
      ) {
        return candidate;
      }
    } catch (error) {
      // API not available
    }

    return null;
  }

  // =========================================================
  // HELPERS
  // =========================================================
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function waitUntil(predicate, timeout = 4000) {
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
      return fb.fn.getRecord()?.[TABLE]?.value || [];
    } catch (error) {
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

    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }

    return true;
  }

  function hasExistingData(rows) {
    return rows.some(row => {
      return Object.values(row.value || {}).some(field => {
        return isFilled(field?.value);
      });
    });
  }

  // =========================================================
  // DETECT NATIVE ADD ROW BUTTON
  // =========================================================

  function isNativeAddButton(button) {
    if (!button || button.tagName !== 'BUTTON') {
      return false;
    }

    const paths = button.querySelectorAll('svg path[d]');

    return [...paths].some(path => {
      const d = (path.getAttribute('d') || '')
        .replace(/\s+/g, '');

      // Based on actual FormBridge V2 plus-circle SVG
      return (
        d.includes('m511h-4v4h') ||
        (
          d.startsWith('M122C6.48') &&
          d.includes('h-4v4h')
        )
      );
    });
  }

  function getTableAnchor() {
    const elements = document.querySelectorAll(
      '[data-table-code], [data-field-code]'
    );

    return [...elements].find(element => {
      return (
        element.getAttribute('data-table-code') === TABLE ||
        element.getAttribute('data-field-code') === TABLE
      );
    }) || null;
  }

  function getAddButton() {
    // Primary selector based on actual FormBridge HTML
    const primaryButtons = [
      ...document.querySelectorAll(
        'div.flex.justify-center.pl-10 > button[type="button"]'
      )
    ].filter(isNativeAddButton);

    // Fallback: find the SVG regardless of wrapper classes
    const candidates = primaryButtons.length > 0
      ? primaryButtons
      : [
          ...document.querySelectorAll(
            'button[type="button"]'
          )
        ].filter(isNativeAddButton);

    if (candidates.length === 0) {
      return null;
    }

    // If there is only one button, use it
    if (candidates.length === 1) {
      return candidates[0];
    }

    // If multiple subtables exist,
    // identify the button inside the family table.
    const anchor = getTableAnchor();

    if (anchor) {
      let parent = anchor.parentElement;

      while (parent && parent !== document.body) {
        const matches = candidates.filter(button => {
          return parent.contains(button);
        });

        if (matches.length === 1) {
          return matches[0];
        }

        parent = parent.parentElement;
      }
    }

    // Never accidentally style another subtable
    if (!warnedMultipleButtons) {
      warnedMultipleButtons = true;

      console.warn(
        PREFIX,
        'Multiple add-row buttons detected. ' +
        'Could not uniquely identify the family table.',
        candidates
      );
    }

    return null;
  }

  // =========================================================
  // BUTTON CSS
  // =========================================================
  function injectStyles() {
    if (
      document.getElementById('fb-family-add-styles')
    ) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'fb-family-add-styles';

    // Use CSS pseudo-element for text.
    // Do not modify children managed by React.
    style.textContent = `
      /* Wrapper */
      .fb-family-add-wrapper {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;

        padding-left: 0 !important;
        margin-top: 14px !important;
        margin-bottom: 10px !important;
        width: 100% !important;
      }

      /* Add row button */
      button.fb-family-add-button {
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

      /* Plus icon */
      button.fb-family-add-button svg {
        width: 21px !important;
        height: 21px !important;
        color: #2563eb !important;
        flex-shrink: 0 !important;
      }

      /* Button label */
      button.fb-family-add-button::after {
        content: "Tambah anggota keluarga";

        display: inline-block !important;

        color: #2563eb !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        line-height: 1.4 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
      }

      /* Hover */
      button.fb-family-add-button:hover {
        background: #e8f1ff !important;
        border-color: #2563eb !important;
        box-shadow:
          0 2px 8px rgba(37, 99, 235, .09) !important;
      }

      /* Active */
      button.fb-family-add-button:active {
        background: #dbeafe !important;
        transform: scale(.98) !important;
      }

      /* Keyboard focus */
      button.fb-family-add-button:focus-visible {
        outline: 2px solid #2563eb !important;
        outline-offset: 3px !important;
      }

      /* Disabled */
      button.fb-family-add-button:disabled {
        opacity: .5 !important;
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
  // DECORATE NATIVE BUTTON
  // =========================================================
  function decorateAddButton() {
    const button = getAddButton();

    if (!button) {
      return false;
    }

    button.classList.add('fb-family-add-button');

    const wrapper = button.parentElement;

    if (wrapper) {
      wrapper.classList.add('fb-family-add-wrapper');
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

    button.setAttribute(
      'title',
      CONFIG.buttonLabel
    );

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

  // =========================================================
  // OBSERVE FORMBRIDGE RERENDER
  // =========================================================
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

    rows.slice(0, PRESETS.length).forEach(
      (row, index) => {
        const field = row?.value?.[RELATION];

        if (!field) return;

        // Do not overwrite existing data
        if (isFilled(field.value)) {
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
          console.error(
            PREFIX,
            `Failed to fill row ${index + 1}`,
            error
          );
        }
      }
    );
  }

  // =========================================================
  // AUTO ADD MISSING ROWS
  // =========================================================
  async function ensureMinimumRows(context) {
    await sleep(150);

    for (
      let attempt = 0;
      attempt < PRESETS.length;
      attempt++
    ) {
      const count = getRows().length;

      if (count >= PRESETS.length) {
        break;
      }

      const button = await waitUntil(
        () => getAddButton(),
        4000
      );

      if (!button) {
        console.warn(
          PREFIX,
          'Native add-row button not found. ' +
          'Cannot add the remaining rows.'
        );

        break;
      }

      autoAddingIndex = count;

      try {
        // Click the original FormBridge button
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

          break;
        }

        log(`Added row ${count + 1}`);
      } catch (error) {
        console.error(
          PREFIX,
          'Failed to add row:',
          error
        );

        break;
      } finally {
        autoAddingIndex = null;
      }
    }

    // Fill all empty default relation fields
    fillExistingRows(context);

    // Reapply button design
    scheduleDecorate();

    initializing = false;

    log(
      'Initialization finished',
      getRows().length
    );
  }

  // =========================================================
  // INITIALIZATION
  // =========================================================
  function registerEvents() {
    if (registered) return true;

    fb = resolveFormBridge();

    if (!fb) {
      return false;
    }

    registered = true;

    log('FormBridge V2 API ready');

    // -------------------------------------------------------
    // FORM SHOW
    // -------------------------------------------------------
    fb.events.on('form.show', context => {
      if (initialized) return;

      initialized = true;

      const rows = getRows();

      // Protection: do not initialize a populated table.
      // Edit forms must not use the family_init URL parameter.
      if (hasExistingData(rows)) {
        log(
          'Existing family data detected. ' +
          'Customization skipped.'
        );

        return;
      }

      initializing = true;

      injectStyles();
      observeButton();
      scheduleDecorate();

      // Fill existing empty rows
      fillExistingRows(context);

      // Add missing rows to reach 4
      void ensureMinimumRows(context).catch(error => {
        initializing = false;

        console.error(
          PREFIX,
          'Initialization failed:',
          error
        );
      });
    });

    // -------------------------------------------------------
    // SUBTABLE ADD ROW
    // -------------------------------------------------------
    fb.events.on(
      `form.subtable.addRow.${TABLE}`,
      context => {
        if (
          initializing &&
          autoAddingIndex !== null &&
          autoAddingIndex < PRESETS.length
        ) {
          const field =
            context.newRow?.value?.[RELATION];

          if (field && !isFilled(field.value)) {
            // Use the original Japanese value
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

    // -------------------------------------------------------
    // SUBTABLE REMOVE ROW
    // -------------------------------------------------------
    fb.events.on(
      `form.subtable.removeRow.${TABLE}`,
      () => {
        scheduleDecorate();
      }
    );

    return true;
  }

  // =========================================================
  // WAIT FOR FORMBRIDGE API
  // =========================================================

  // Register immediately when available.
  if (registerEvents()) {
    return;
  }

  // Retry briefly if script loads before FormBridge API.
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
        'FormBridge API could not be initialized. ' +
        'Check the custom JavaScript loading order.'
      );
    }
  }, 100);

})();
