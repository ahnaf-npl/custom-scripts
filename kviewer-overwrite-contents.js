(function () {
  "use strict";

  // Daftar kata yang ingin diubah
  // Format: 'Teks Asli': 'Teks Baru'
  const translations = {
    詳細: "Details",
    メニュー: "Menu",
    ソート: "Sort",
  };

  // Fungsi untuk mencari dan mengganti teks
  function replaceText() {
    // Ambil semua elemen <div> di dalam halaman
    const allDivs = document.getElementsByTagName("div");

    // Loop melalui setiap div
    for (let i = 0; i < allDivs.length; i++) {
      const div = allDivs[i];

      // Cek apakah teks di dalam div cocok dengan salah satu kunci di 'translations'
      // .trim() digunakan untuk menghapus spasi kosong di awal atau akhir
      const originalText = div.textContent.trim();

      if (translations[originalText]) {
        // Jika cocok, ganti teksnya
        div.textContent = translations[originalText];
      }
    }
  }

  // Karena elemen KViewer mungkin dimuat secara dinamis (setelah halaman utama),
  // kita perlu sedikit trik untuk memastikan kode ini berjalan pada waktu yang tepat.
  // Kita gunakan MutationObserver untuk memantau perubahan pada body dokumen.
  const observer = new MutationObserver(function (mutations, me) {
    // Jalankan fungsi penggantian teks
    replaceText();

    // Anda bisa membiarkan observer ini aktif atau menghentikannya jika
    // penggantian hanya perlu dilakukan sekali.
    // Untuk amannya, biarkan aktif jika ada kemungkinan elemen muncul lagi.
    // me.disconnect(); // Hapus komentar ini jika ingin berhenti setelah jalan sekali
  });

  // Mulai mengamati perubahan pada elemen body dan semua turunannya
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Jalankan juga sekali saat awal untuk elemen yang mungkin sudah ada
  replaceText();
})();
