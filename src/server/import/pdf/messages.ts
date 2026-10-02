// teks siap tampil untuk impor PDF (COPY.md bagian 4, Error dan Impor mutasi)
export const PDF_MESSAGES = {
  unrecognized: "Format mutasi ini belum dikenali. Coba impor CSV, atau baca dengan AI dan cek hasilnya baris per baris.",
  wrongPassword: "Password tidak cocok. Password e-statement biasanya dikirim bank lewat email atau SMS.",
  empty: "File kosong. Pilih file e-statement PDF.",
  tooLarge: "File lebih dari 20 MB. Unduh e-statement per bulan lalu unggah satu per satu.",
  notPdf: "File ini bukan PDF. Pilih file e-statement berformat PDF.",
  unreadable: "PDF ini tidak bisa dibuka. Unduh ulang e-statement dari bank lalu coba lagi.",
  noText: "PDF ini berisi gambar tanpa teks, jadi tidak bisa dibaca. Unduh e-statement versi teks dari bank atau impor CSV.",
  tooManyPages: "PDF ini lebih dari 30 halaman. Unduh e-statement per bulan lalu baca dengan AI satu per satu.",
  aiNoRows: "Model AI tidak menemukan baris transaksi di PDF ini. Coba impor CSV atau isi transaksi sendiri.",
  aiQueueFailed: "Pembacaan dengan AI belum bisa dimulai. Coba lagi sebentar lagi.",
} as const;
