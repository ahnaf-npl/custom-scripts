(function() {
  "use strict";

  // LOGGING: Mulai Script
  console.log("[DEBUG-LOCK] Script mulai dijalankan...");

  // Gunakan interval untuk mengecek apakah 'fb' sudah siap
  // Cek setiap 200ms
  var retryCount = 0;
  var maxRetries = 50; // Stop setelah 10 detik (50 * 200ms)

  var checkInterval = setInterval(function() {
    retryCount++;
    console.log("[DEBUG-LOCK] Percobaan ke-" + retryCount + " mencari object 'fb'...");

    // PENTING: Pakai window.fb untuk menghindari ReferenceError
    if (window.fb) {
      console.log("[DEBUG-LOCK] BERHASIL! Object 'fb' ditemukan.");
      
      // Hentikan interval pengecekan
      clearInterval(checkInterval);
      
      // Jalankan fungsi utama
      initLockSystem();
    } else {
      console.warn("[DEBUG-LOCK] Object 'fb' belum ditemukan. Menunggu...");
      
      if (retryCount >= maxRetries) {
        console.error("[DEBUG-LOCK] GAGAL TOTAL. 'fb' tidak ditemukan setelah 10 detik. Cek koneksi atau urutan load script.");
        clearInterval(checkInterval);
      }
    }
  }, 200);


  // Fungsi Utama
  function initLockSystem() {
    try {
      console.log("[DEBUG-LOCK] Mendaftarkan event listener fb.events.form.mounted...");

      window.fb.events.form.mounted = [function(state) {
        console.log("[DEBUG-LOCK] Event Form Mounted TRIGGERED!");
        console.log("[DEBUG-LOCK] State Record saat ini:", state.record);

        // --- KONFIGURASI ---
        var fieldCode = 'status_lock'; 
        var lockValue = 'LOCKED';
        // -------------------

        // Cek apakah field ada
        if (!state.record[fieldCode]) {
          console.error("[DEBUG-LOCK] Field '" + fieldCode + "' TIDAK DITEMUKAN di form ini. Pastikan field code benar dan field dimasukkan ke FormBridge.");
          return state;
        }

        var currentStatus = state.record[fieldCode].value;
        console.log("[DEBUG-LOCK] Value status saat ini: '" + currentStatus + "'");
        console.log("[DEBUG-LOCK] Value yang dicari: '" + lockValue + "'");

        if (currentStatus === lockValue) {
          console.log("[DEBUG-LOCK] KONDISI MATCH! Memulai proses penguncian...");
          
          // 1. Alert
          setTimeout(function() {
            if (typeof Swal !== 'undefined') {
              console.log("[DEBUG-LOCK] Menampilkan SweetAlert.");
              Swal.fire({
                icon: 'info',
                title: 'Akses Terkunci',
                text: 'Data CV Anda sudah terkunci.',
                allowOutsideClick: false,
                confirmButtonText: 'OK'
              });
            } else {
              console.log("[DEBUG-LOCK] SweetAlert tidak load, pakai alert biasa.");
              alert("DATA TERKUNCI");
            }
          }, 500);

          // 2. Disable Form
          disableFormElements();
        } else {
            console.log("[DEBUG-LOCK] Kondisi tidak match. Form tetap terbuka.");
        }

        return state;
      }];
      
      console.log("[DEBUG-LOCK] Event listener berhasil didaftarkan.");

    } catch (err) {
      console.error("[DEBUG-LOCK] Error fatal di dalam initLockSystem:", err);
    }
  }

  function disableFormElements() {
    console.log("[DEBUG-LOCK] Menjalankan disableFormElements...");
    
    // Sembunyikan Submit
    var submitBtns = document.querySelectorAll('.fb-submit, button[type="submit"]');
    if(submitBtns.length > 0) {
        console.log("[DEBUG-LOCK] Tombol submit ditemukan ("+submitBtns.length+"), disembunyikan.");
        submitBtns.forEach(function(btn) { btn.style.display = 'none'; });
    } else {
        console.warn("[DEBUG-LOCK] Tombol submit TIDAK ditemukan.");
    }

    // Disable Input
    var allInputs = document.querySelectorAll('input, select, textarea');
    console.log("[DEBUG-LOCK] Mengunci " + allInputs.length + " elemen input.");
    allInputs.forEach(function(el) {
      el.disabled = true;
      el.style.backgroundColor = "#e0e0e0";
    });
    
    // Matikan pointer events
    var content = document.querySelector('.fb-content');
    if(content) {
        content.style.pointerEvents = 'none';
        console.log("[DEBUG-LOCK] Content pointer-events dimatikan.");
    }
  }

})();