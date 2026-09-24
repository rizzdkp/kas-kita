/** Kamus kata kunci quick-add. Nama kategori mengikuti seed DATA-MODEL.md bagian 4. */

export const INCOME_KEYWORDS = new Set([
  "gaji", "gajian", "bonus", "thr", "terima", "diterima", "masuk", "cashback", "refund",
  "pemasukan", "dividen", "bunga", "komisi",
]);

export const TRANSFER_KEYWORDS = new Set(["transfer", "tf", "trf", "pindah", "topup", "top-up"]);

// kata sambung yang dibuang kalau menempel pada akun atau tanggal
export const CONNECTORS = new Set(["pakai", "pake", "pk", "via", "dari", "ke", "di", "dgn", "dengan", "lewat", "tgl", "tanggal", "hari", "pada"]);

export const BENEFICIARY_PREFIXES = new Set(["untuk", "buat", "utk", "bwt"]);
export const SHARED_WORDS = new Set(["bersama", "berdua", "bareng"]);
export const OWNER_WORDS = new Set(["saya", "aku", "sendiri", "gue", "gw"]);

// kata umum di nama akun yang tidak cukup khas untuk mencocokkan akun
export const GENERIC_ACCOUNT_WORDS = new Set([
  "bank", "rekening", "rek", "akun", "utama", "tabungan", "dompet", "kartu", "kredit", "digital", "saya", "bersama",
]);

// sinonim akun: kata di input -> kata yang dicari di nama akun
export const ACCOUNT_SYNONYMS: Record<string, string[]> = {
  tunai: ["tunai", "cash", "dompet"],
  cash: ["tunai", "cash", "dompet"],
  cas: ["tunai", "cash"],
  dompet: ["dompet", "tunai", "cash"],
  gopay: ["gopay", "go-pay"],
  ovo: ["ovo"],
  dana: ["dana"],
  shopeepay: ["shopeepay", "spay"],
  spay: ["shopeepay", "spay"],
  jago: ["jago"],
  bca: ["bca"],
  mandiri: ["mandiri"],
  bni: ["bni"],
  bri: ["bri"],
};

export const EXPENSE_CATEGORY_KEYWORDS: Record<string, string> = {
  kopi: "Kopi dan jajan", jajan: "Kopi dan jajan", snack: "Kopi dan jajan", boba: "Kopi dan jajan",
  es: "Kopi dan jajan", teh: "Kopi dan jajan", roti: "Kopi dan jajan", cemilan: "Kopi dan jajan",
  makan: "Makan di luar", "makan siang": "Makan di luar", "makan malam": "Makan di luar", sarapan: "Makan di luar",
  lunch: "Makan di luar", dinner: "Makan di luar", warteg: "Makan di luar", gofood: "Makan di luar",
  grabfood: "Makan di luar", bakso: "Makan di luar", nasi: "Makan di luar", mie: "Makan di luar",
  belanja: "Belanja dapur", sayur: "Belanja dapur", indomaret: "Belanja dapur", alfamart: "Belanja dapur",
  pasar: "Belanja dapur", beras: "Belanja dapur", galon: "Belanja dapur", supermarket: "Belanja dapur",
  "belanja bulanan": "Belanja dapur", telur: "Belanja dapur",
  bensin: "Bensin", pertalite: "Bensin", pertamax: "Bensin", bbm: "Bensin",
  gojek: "Ojek dan taksi", grab: "Ojek dan taksi", ojek: "Ojek dan taksi", ojol: "Ojek dan taksi",
  gocar: "Ojek dan taksi", grabcar: "Ojek dan taksi", taksi: "Ojek dan taksi", taxi: "Ojek dan taksi",
  maxim: "Ojek dan taksi", krl: "Ojek dan taksi", mrt: "Ojek dan taksi",
  parkir: "Parkir dan tol", tol: "Parkir dan tol", etoll: "Parkir dan tol", "e-toll": "Parkir dan tol",
  sewa: "Sewa atau cicilan", kos: "Sewa atau cicilan", kost: "Sewa atau cicilan", kontrakan: "Sewa atau cicilan",
  cicilan: "Sewa atau cicilan", kpr: "Sewa atau cicilan",
  listrik: "Listrik", pln: "Listrik", token: "Listrik",
  pdam: "Air", air: "Air",
  internet: "Internet", indihome: "Internet", wifi: "Internet", biznet: "Internet", firstmedia: "Internet",
  netflix: "Tagihan dan langganan", spotify: "Tagihan dan langganan", youtube: "Tagihan dan langganan",
  langganan: "Tagihan dan langganan", pulsa: "Tagihan dan langganan", kuota: "Tagihan dan langganan",
  icloud: "Tagihan dan langganan", bpjs: "Kesehatan",
  obat: "Kesehatan", dokter: "Kesehatan", apotek: "Kesehatan", klinik: "Kesehatan", vitamin: "Kesehatan",
  sekolah: "Pendidikan", kursus: "Pendidikan", buku: "Pendidikan", spp: "Pendidikan",
  baju: "Belanja pribadi", sepatu: "Belanja pribadi", skincare: "Belanja pribadi", shopee: "Belanja pribadi",
  tokopedia: "Belanja pribadi", potong: "Belanja pribadi",
  bioskop: "Hiburan", nonton: "Hiburan", game: "Hiburan", konser: "Hiburan", liburan: "Hiburan",
  kado: "Hadiah dan donasi", donasi: "Hadiah dan donasi", sedekah: "Hadiah dan donasi", zakat: "Hadiah dan donasi",
  infaq: "Hadiah dan donasi", kondangan: "Hadiah dan donasi",
  ortu: "Keluarga", orangtua: "Keluarga", mama: "Keluarga", papa: "Keluarga", ibu: "Keluarga",
  admin: "Biaya bank dan admin", biaya: "Biaya bank dan admin",
  pajak: "Pajak", pbb: "Pajak", samsat: "Pajak",
};

export const INCOME_CATEGORY_KEYWORDS: Record<string, string> = {
  gaji: "Gaji", gajian: "Gaji",
  bonus: "Bonus", thr: "Bonus", komisi: "Bonus",
  freelance: "Usaha sampingan", jualan: "Usaha sampingan", proyek: "Usaha sampingan", project: "Usaha sampingan",
  hadiah: "Hadiah", angpao: "Hadiah",
  bunga: "Bunga dan imbal hasil", dividen: "Bunga dan imbal hasil",
  refund: "Pengembalian dana", cashback: "Pengembalian dana", reimburse: "Pengembalian dana",
};

export const WEEKDAYS: Record<string, number> = {
  minggu: 0, ahad: 0, senin: 1, selasa: 2, rabu: 3, kamis: 4, jumat: 5, "jum'at": 5, sabtu: 6,
};

export const MONTH_WORDS: Record<string, number> = {
  jan: 0, januari: 0, feb: 1, februari: 1, mar: 2, maret: 2, apr: 3, april: 3, mei: 4,
  jun: 5, juni: 5, jul: 6, juli: 6, agu: 7, agt: 7, agus: 7, agustus: 7, ags: 7,
  sep: 8, sept: 8, september: 8, okt: 9, oktober: 9, nov: 10, november: 10, des: 11, desember: 11,
};
