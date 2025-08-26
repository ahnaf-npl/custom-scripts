(function () {
  "use strict";

  //   console.log("[kViewer] 🚀 Dynamic totalCount script loaded");

  // 1) Monkey-patch fetch
  const origFetch = window.fetch.bind(window);
  window.fetch = function (resource, init) {
    const url = typeof resource === "string" ? resource : resource.url;
    // console.log("[kViewer] ➡️ fetch:", url);

    return origFetch(resource, init).then((response) => {
      // Tangkap semua request ke toyokumo records (dengan atau tanpa query string)
      if (
        url.includes("/internal/public/api/view/") &&
        url.includes("/records")
      ) {
        // console.group("[kViewer] 🔍 records response intercepted");
        // console.log("URL:", url);

        // clone() supaya request asli tetap jalan
        response
          .clone()
          .json()
          .then((data) => {
            // console.log("Raw response data:", data);
            // sesuaikan properti totalCount jika berbeda
            const total =
              data.totalCount ??
              data.metadata?.totalCount ??
              data.count ??
              null;
            // console.log("Detected total:", total);

            if (typeof total === "number") {
              updateHeaderBadge(total);
            } else {
              console.warn("[kViewer] totalCount tidak ditemukan di response");
            }
          })
          .catch((err) => console.error("[kViewer] JSON parse error:", err));

        console.groupEnd();
      }

      return response;
    });
  };

  // 2) Fungsi untuk buat/update badge
  function updateHeaderBadge(total) {
    // console.log("[kViewer] updateHeaderBadge:", total);
    // sesuaikan selector header sesuai layout kamu
    const headerEl = document.querySelector(".kv-record-menu .flex.h-full");

    if (!headerEl) {
      console.warn("[kViewer] header element not found");
      return;
    }

    let badge = headerEl.querySelector(".badge-total");
    if (!badge) {
      //   console.log("[kViewer] Creating badge element");
      badge = document.createElement("span");
      badge.className = "badge-total";
      badge.style.cssText = `
       margin-left:1em;
        padding:0.3em 0.6em;
        background:#28a745;
        color:white;
        border-radius:0.25em;
        font-size:1em;
        font-weight: 600;
      `;
      headerEl.appendChild(badge);
    } else {
      //   console.log("[kViewer] Badge already exists, updating text");
    }

    badge.textContent = `全${total}件`;
    // console.log("[kViewer] Badge text set to:", badge.textContent);
  }

  //   console.log("[kViewer] 🎛️ Fetch interceptor ready");
})();
