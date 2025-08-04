(function () {
  "use strict";

  const translations = {
    詳細: "Lihat Detail",
    メニュー: "Menu",
    並べ替え: "Urutkan",
  };

  // Fungsi untuk mengganti teks dengan cara yang lebih aman
  function replaceTextInNode(node) {
    // Hanya proses node yang merupakan elemen (tipe 1)
    if (node.nodeType !== 1) {
      return;
    }

    // Cek semua anak dari node ini
    for (const child of node.childNodes) {
      // Jika anak adalah node teks (tipe 3)...
      if (child.nodeType === 3) {
        const originalText = child.nodeValue.trim();
        if (translations[originalText]) {
          // Ganti hanya nilai teksnya, ini tidak akan merusak event listener
          child.nodeValue = translations[originalText];
        }
      }
      // Jika anak adalah elemen lain, jalankan fungsi ini lagi untuk anak tersebut (rekursif)
      else if (child.nodeType === 1) {
        replaceTextInNode(child);
      }
    }
  }

  const observer = new MutationObserver(function (mutationsList) {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        // Untuk setiap node yang baru ditambahkan, jalankan penggantian teks
        mutation.addedNodes.forEach((node) => replaceTextInNode(node));
      }
    }
  });

  // Mulai mengamati perubahan pada seluruh dokumen
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Jalankan juga sekali di awal untuk konten yang sudah ada saat halaman dimuat
  replaceTextInNode(document.body);
})();
