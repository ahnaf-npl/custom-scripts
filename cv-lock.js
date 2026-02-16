(function() {
  "use strict";

  // Fungsi pembungkus untuk menunggu object 'fb' siap
  function waitForFormBridge() {
    if (typeof fb === 'undefined') {
      // Jika 'fb' belum ada, tunggu 100ms lalu cek lagi
      setTimeout(waitForFormBridge, 100);
      return;
    }
    
    // Jika 'fb' sudah siap, jalankan inisialisasi
    initCustomization();
  }

  function initCustomization() {
    fb.events.form.mounted = [function(state) {
      
      // --- KONFIGURASI ---
      var fieldCode = 'status_lock'; // Field code Kintone
      var lockValue = 'LOCKED';      // Value penentu kunci
      // -------------------

      // Ambil value dari state record
      var currentStatus = state.record[fieldCode] ? state.record[fieldCode].value : '';

      // --- LOGIC UTAMA ---
      if (currentStatus === lockValue) {
        
        // 1. Tampilkan Sweet Alert
        // Kita gunakan setTimeout kecil agar tidak bentrok dengan rendering UI
        setTimeout(function() {
          if (typeof Swal !== 'undefined') {
            Swal.fire({
              icon: 'info',
              title: 'Akses Terkunci',
              text: 'Data CV Anda sudah terkunci. Anda tidak dapat melakukan perubahan data saat ini.',
              footer: 'Silakan hubungi admin jika ada perubahan mendesak.',
              allowOutsideClick: false,
              allowEscapeKey: false,
              confirmButtonText: 'Mengerti',
              confirmButtonColor: '#3085d6',
            });
          } else {
            // Fallback jika SweetAlert gagal load
            alert("⚠️ DATA TERKUNCI\nAnda tidak dapat mengubah data ini.");
          }
        }, 500);

        // 2. Disable Form
        disableForm(fieldCode);
      }

      // Sembunyikan tampilan field Status Lock itu sendiri (agar tidak mengganggu visual)
      var lockFieldElement = document.querySelector('[data-field-code="' + fieldCode + '"]');
      if (lockFieldElement) {
        lockFieldElement.style.display = 'none';
      }

      return state;
    }];
  }

  // Fungsi untuk mematikan interaksi form
  function disableForm(fieldCodeLock) {
    // Sembunyikan tombol Submit
    var submitBtns = document.querySelectorAll('.fb-submit, button[type="submit"]');
    submitBtns.forEach(function(btn) {
      btn.style.display = 'none';
    });

    // Disable input
    var allInputs = document.querySelectorAll('input, select, textarea');
    allInputs.forEach(function(el) {
      el.disabled = true;
      el.style.backgroundColor = "#f3f4f6"; // Warna abu-abu (sesuai tema Toyokumo)
      el.style.cursor = "not-allowed";
    });

    // Matikan klik pada konten form
    var formContent = document.querySelector('.fb-content');
    if (formContent) {
      formContent.style.pointerEvents = 'none';
    }
  }

  // Mulai proses menunggu
  waitForFormBridge();

})();