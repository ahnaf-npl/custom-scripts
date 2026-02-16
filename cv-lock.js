(function() {
  "use strict";

  // Event saat form selesai dimuat
  fb.events.form.mounted = [function(state) {
    
    // --- KONFIGURASI ---
    var fieldCode = 'status_lock'; // Field code di Kintone
    var lockValue = 'LOCKED';      // Value yang men-trigger lock
    // -------------------

    // Ambil value dari record saat ini
    // Pastikan field 'status_lock' sudah ditambahkan ke Form Bridge (bisa diset hidden)
    var currentStatus = state.record[fieldCode] ? state.record[fieldCode].value : '';

    // Logika Penguncian
    if (currentStatus === lockValue) {
      
      // 1. Tampilkan Sweet Alert
      // Kita bungkus dalam setTimeout agar render form selesai dulu baru alert muncul
      setTimeout(function() {
        Swal.fire({
          icon: 'info', // Ikon: info, warning, error, success
          title: 'Akses Terkunci',
          text: 'Data CV Anda sedang dalam proses verifikasi atau sudah terkunci. Anda tidak dapat melakukan perubahan data saat ini.',
          footer: 'Silakan hubungi admin jika ada perubahan mendesak.',
          allowOutsideClick: false, // User tidak bisa tutup modal dengan klik luar
          allowEscapeKey: false,    // User tidak bisa tutup dengan tombol ESC
          confirmButtonText: 'Mengerti',
          confirmButtonColor: '#3085d6',
        });
      }, 500);

      // 2. Matikan Fungsi Edit (Disable Form)
      disableForm();
    }

    return state;
  }];

  // Fungsi untuk mematikan interaksi pada form
  function disableForm() {
    // Sembunyikan tombol Submit/Confirm
    var submitBtns = document.querySelectorAll('.fb-submit, button[type="submit"]');
    submitBtns.forEach(function(btn) {
      btn.style.display = 'none';
    });

    // Disable semua input, select, dan textarea
    var allInputs = document.querySelectorAll('input, select, textarea');
    allInputs.forEach(function(el) {
      el.disabled = true;
      el.style.backgroundColor = "#f0f0f0"; // Opsional: Beri warna abu-abu agar terlihat disabled
      el.style.cursor = "not-allowed";
    });

    // Opsional: Matikan pointer events pada seluruh konten form agar tidak bisa diklik sama sekali
    var formContent = document.querySelector('.fb-content');
    if (formContent) {
      formContent.style.pointerEvents = 'none';
      formContent.style.opacity = '0.7'; // Sedikit transparan
    }
  }

})();