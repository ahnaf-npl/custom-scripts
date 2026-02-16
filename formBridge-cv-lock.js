(function() {
  "use strict";

  // Konfigurasi
  const LOCK_FIELD_CODE = 'status_lock';
  const LOCK_VALUE = 'LOCKED';

  // 1. Event saat Form Ditampilkan (form.show)
  // Dokumentasi: formBridge.events.on('form.show', ...)
  formBridge.events.on('form.show', function(context) {
    
    // Ambil data record menggunakan API terbaru
    // Dokumentasi: formBridge.fn.getRecord()
    const record = formBridge.fn.getRecord();
    const lockStatus = record[LOCK_FIELD_CODE] ? record[LOCK_FIELD_CODE].value : '';

    // Sembunyikan field 'status_lock' itu sendiri agar tidak terlihat user
    // Menggunakan class dari dokumentasi: fb-custom--field
    const lockFieldEl = document.querySelector(`[data-field-code="${LOCK_FIELD_CODE}"]`);
    if (lockFieldEl) {
      lockFieldEl.style.display = 'none';
    }

    // Cek Status
    if (lockStatus === LOCK_VALUE) {
      
      // A. Tampilkan SweetAlert
      // Kita beri sedikit delay agar library SweetAlert siap
      setTimeout(function() {
        if (typeof Swal !== 'undefined') {
          Swal.fire({
            icon: 'warning',
            title: 'Akses Terkunci',
            text: 'Data CV Anda sudah divalidasi. Anda tidak dapat melakukan perubahan.',
            allowOutsideClick: false,
            confirmButtonText: 'OK',
            confirmButtonColor: '#3085d6',
          });
        } else {
          alert("DATA TERKUNCI: Data CV sudah divalidasi.");
        }
      }, 300);

      // B. Matikan Interaksi Form (Disable UI)
      disableFormUI();
    }
  });

  // 2. Event Pencegah Submit (form.submit)
  // Ini layer keamanan kedua: Jika user berhasil mengakal UI, tombol submit tetap tidak akan jalan.
  // Dokumentasi: form.submit
  formBridge.events.on('form.submit', function(context) {
    const record = formBridge.fn.getRecord();
    const lockStatus = record[LOCK_FIELD_CODE] ? record[LOCK_FIELD_CODE].value : '';

    if (lockStatus === LOCK_VALUE) {
      // Batalkan proses submit
      // Dokumentasi: context.preventDefault()
      context.preventDefault(); 
      
      if (typeof Swal !== 'undefined') {
        Swal.fire('Gagal', 'Form terkunci, tidak bisa disimpan.', 'error');
      } else {
        alert('Form terkunci!');
      }
    }
  });

  // --- Fungsi Bantuan untuk Disable UI ---
  function disableFormUI() {
    // 1. Sembunyikan Tombol Submit
    // Dokumentasi class: fb-custom--button--submit
    const submitBtn = document.querySelector('.fb-custom--button--submit');
    if (submitBtn) submitBtn.style.display = 'none';

    // 2. Sembunyikan Tombol Confirm (jika ada)
    // Dokumentasi class: fb-custom--button--confirm
    const confirmBtn = document.querySelector('.fb-custom--button--confirm');
    if (confirmBtn) confirmBtn.style.display = 'none';

    // 3. Disable semua input fields
    // Dokumentasi class: fb-custom--field
    const inputs = document.querySelectorAll('.fb-custom--field input, .fb-custom--field select, .fb-custom--field textarea');
    inputs.forEach(function(el) {
      el.disabled = true;
      el.style.backgroundColor = '#f3f4f6';
      el.style.cursor = 'not-allowed';
    });
    
    // 4. Disable pointer events pada area konten utama agar tidak bisa diklik
    // Dokumentasi class: fb-custom--content
    const contentArea = document.querySelector('.fb-custom--content');
    if (contentArea) {
        contentArea.style.pointerEvents = 'none';
    }
  }

})();