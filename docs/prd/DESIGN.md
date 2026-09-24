---
name: Kas Kita
base: Perplexity design.md (diadaptasi, kontradiksi diselesaikan)
modes: [light, dark]  # ikut prefers-color-scheme
colors:
  light:
    canvas: "#FDFBFA"
    surface: "#FFFFFF"
    surface-sunken: "rgba(39, 26, 0, 0.035)"
    text-primary: "#000000"
    text-secondary: "rgba(39, 37, 30, 0.68)"
    text-tertiary: "rgba(39, 37, 30, 0.52)"
    border: "rgba(39, 26, 0, 0.14)"
    border-strong: "rgba(39, 26, 0, 0.25)"
    accent: "#016A71"
    accent-hover: "#014F54"
    positive: "#2F7A4B"
    attention: "#A23544"
    due-soon: "#97431A"
    error: "#C40500"
  dark:
    canvas: "#000000"
    surface: "#111110"
    surface-sunken: "rgba(255, 255, 255, 0.04)"
    text-primary: "#FFFFFF"
    text-secondary: "rgba(255, 255, 255, 0.68)"
    text-tertiary: "rgba(255, 255, 255, 0.50)"
    border: "rgba(255, 255, 255, 0.12)"
    border-strong: "rgba(255, 255, 255, 0.22)"
    accent: "#45B8C0"
    accent-hover: "#6CCAD1"
    positive: "#6CC48A"
    attention: "#E07A86"
    due-soon: "#E0935F"
    error: "#FF6B61"
typography:
  family: "Geist"
  fallback: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  numerals: tabular
radius: { xs: 4px, sm: 6px, md: 8px, card: 12px, glass-bar: 22px, pill: 9999px }
spacing-base: 4px
---

# Sistem desain Kas Kita

Dasar sistem ini adalah design.md Perplexity: minimal, netral hangat, satu aksen teal, tipografi satu keluarga. Di atasnya ada satu lapisan liquid glass yang mengikuti aturan Apple: glass hanya untuk navigasi dan kontrol yang melayang di atas konten.

Kesan mewah datang dari tiga hal yang dipegang disiplin: angka yang rapi dan tenang, ruang kosong yang lega, dan glass yang hanya muncul di tempat yang tepat. Kalau ragu menambah efek, jangan tambahkan.

## 1. Perubahan dari design.md Perplexity

| Aturan asli | Masalah | Keputusan Kas Kita |
|---|---|---|
| Frontmatter surface `#000000`, teks putih; isi dokumen bilang latar off-white | Dua tema saling bertabrakan | Dua mode resmi: terang (off-white) dan gelap (hitam), ikut sistem |
| `#271A00` disebut warna primer dan warna teks, lalu dilarang untuk teks | Kontradiksi | `#271A00` hanya untuk border dan tint permukaan |
| Font `pplxSans` | Proprietary, tidak bisa dipakai | Geist (SIL OFL), angka tabular |
| Sukses `#539E55` | Kontras sekitar 3:1 di putih, gagal AA untuk teks kecil. Terlalu dekat dengan teal. | `positive` `#2F7A4B` (lebih gelap, bergeser ke hijau murni) |
| Error `#E10600` | Di dashboard keuangan, merah untuk semua pengeluaran jadi alarm permanen | Nominal pakai tinta netral dengan tanda. `attention` hanya untuk anggaran lewat dan tagihan telat. `error` hanya untuk validasi form. |
| "Satu shadow per elemen" | Glass butuh bayangan berlapis dan highlight dalam | Pengecualian eksplisit untuk komponen glass (bagian 5) |
| Top bar teal solid | Berat dan bertabrakan dengan glass | Toolbar glass netral |
| Border kiri 3 px dengan radius 8 px di nav aktif | Border satu sisi pada sudut membulat terlihat patah | Item aktif memakai isian glass yang lebih terang, tanpa border kiri |
| Aturan "jangan pakai opacity untuk variasi warna" | Sistem aslinya sendiri berbasis rgba | Dihapus. Opacity dipakai lewat token, tidak ditulis bebas. |
| Shadow "High" `oklch(... / 0)` | Alpha 0, tidak terlihat | Dihapus |

## 2. Warna

### 2.1 Peran

| Token | Dipakai untuk | Tidak dipakai untuk |
|---|---|---|
| `accent` | Tombol utama, fokus, tautan, elemen aktif yang bisa diklik | Angka, status, dekorasi |
| `positive` | Status "sesuai rencana", target tercapai | Semua pemasukan |
| `attention` | Anggaran lewat, tagihan lewat jatuh tempo, selisih rekonsiliasi besar | Semua pengeluaran |
| `due-soon` | Tagihan jatuh tempo 3 hari lagi | Peringatan umum |
| `error` | Pesan validasi form dan kegagalan sistem | Data keuangan |

Nominal transaksi memakai `text-primary`. Pemasukan diberi tanda `+`, pengeluaran diberi tanda `−` (U+2212, bukan tanda hubung). Warna di angka hanya muncul kalau angka itu butuh perhatian.

Maksimal satu tombol berwarna `accent` terisi per layar.

### 2.2 Warna identitas

Setiap pengguna memilih satu warna identitas di Pengaturan. Warna ini menandai kepemilikan: titik di baris transaksi, cincin avatar, dan medan ambien.

| Kunci | Terang | Gelap |
|---|---|---|
| `violet` | `#6E5BD6` | `#9A8CF0` |
| `rose` | `#C8577E` | `#E88AAB` |
| `gold` | `#B07A1F` | `#E0B55A` |
| `ocean` | `#2F7FB8` | `#6DB3E6` |
| `plum` | `#8E4E9E` | `#C08AD0` |
| `slate` | `#5C6B7A` | `#9AA8B6` |

Dua pengguna tidak boleh memilih warna yang sama. Akun Bersama tidak punya warna sendiri: titiknya berupa dua setengah lingkaran dengan warna kedua pengguna.

Tidak ada warna identitas hijau, merah, atau teal supaya tidak tertukar dengan warna status dan aksen.

## 3. Tipografi

Keluarga: **Geist**, self-host lewat `next/font`, dengan `font-feature-settings: "tnum" 1, "cv11" 1` di semua elemen angka. Agen wajib memverifikasi bahwa versi Geist yang dipakai mendukung `tnum`. Kalau tidak, ganti ke Inter dan catat di `docs/decisions/`.

SF Pro tidak dipakai karena lisensinya tidak mengizinkan embed di web.

| Peran | Ukuran | Berat | Line height | Tracking | Catatan |
|---|---|---|---|---|---|
| Angka hero | 48px (mobile 40px) | 600 | 52px | -0.02em | Hanya satu per layar |
| Angka besar | 28px | 600 | 34px | -0.01em | Kartu metrik |
| Judul halaman | 28px | 600 | 36px | 0 | |
| Judul bagian | 20px | 600 | 28px | 0 | |
| Judul kartu | 16px | 500 | 24px | 0 | |
| Body | 16px | 400 | 24px | 0 | |
| Body kecil | 14px | 400 | 20px | 0 | |
| Label kontrol | 15px | 500 | 20px | 0 | Tombol, item nav, toggle |
| Keterangan | 12px | 400 | 16px | 0 | Waktu, "diisi oleh" |

Aturan:
- Sentence case di semua label, tombol, dan judul. Tidak ada label huruf kapital semua.
- Tidak ada label kecil di atas setiap judul.
- Satuan "Rp" di angka hero dan angka besar ditulis 0,5 kali ukuran angka, berat 500, rata atas.
- Angka dalam tabel rata kanan.

## 4. Ruang, grid, radius

Skala spasi: 4, 8, 12, 16, 24, 32, 48, 64. Tidak ada nilai lain.

| Breakpoint | Lebar | Tata letak |
|---|---|---|
| Kecil | < 600px | Satu kolom, tab bar glass di bawah, bar quick-add melayang di atas tab bar |
| Sedang | 600-1023px | Dua kolom konten, sidebar glass bisa dilipat |
| Besar | ≥ 1024px | Sidebar glass melayang 248px dengan jarak 12px dari tepi, konten maksimal 1200px |

Radius konsentris: radius elemen di dalam glass = radius glass dikurangi padding di antaranya. Contoh: toggle cakupan radius 22px dengan padding 4px, maka indikator terpilih radius 18px.

| Token | Nilai | Pakai |
|---|---|---|
| `xs` | 4px | Badge kecil |
| `sm` | 6px | Tombol ikon |
| `md` | 8px | Input, baris yang bisa dipilih |
| `card` | 12px | Kartu konten, dialog |
| `glass-bar` | 22px | Sidebar, toolbar, tab bar, bar quick-add |
| `pill` | 9999px | Toggle, avatar |

## 5. Liquid glass

### 5.1 Di mana glass boleh dipakai

| Komponen | Glass | Alasan |
|---|---|---|
| Sidebar (besar) dan tab bar (kecil) | Ya | Navigasi utama melayang di atas konten |
| Toolbar atas | Ya | Kontrol yang berlaku untuk seluruh layar |
| Toggle cakupan Saya / Partner / Gabungan | Ya | Kontrol segmented |
| Bar quick-add | Ya | Kontrol input yang selalu tersedia |
| Sheet dan dialog | Ya, tipe `regular` | Lapisan kontrol sementara |
| Toast | Ya | |
| Menu dan popover | Ya | |
| Kartu metrik, kartu akun | Tidak | Konten |
| Tabel dan daftar transaksi | Tidak | Konten, di-scroll |
| Grafik | Tidak | Konten |
| Angka hero | Tidak | Angka tidak pernah diletakkan di atas glass |

Tidak ada glass di atas glass. Saat sheet terbuka di atas sidebar, konten dan sidebar diredupkan dengan lapisan `scrim` solid, lalu sheet glass tampil di atasnya.

Maksimal empat elemen glass aktif dalam satu layar (biasanya sidebar, toolbar, toggle, quick-add).

### 5.2 Tiga tingkat implementasi

| Tingkat | Kapan | Isi |
|---|---|---|
| G0 solid | `prefers-reduced-transparency: reduce`, atau `backdrop-filter` tidak didukung | Permukaan solid `surface`, border, bayangan |
| G1 frosted | Semua browser modern (Safari, Chrome, Edge, Firefox) | Blur, saturasi, isian semi-transparan, rim terang, highlight atas, bayangan berlapis |
| G2 refraksi | Chromium desktop dan Android dengan `navigator.deviceMemory >= 4`, dan hanya pada toggle cakupan, bar quick-add, dan tombol tambah | G1 + lensa SVG `feDisplacementMap` lewat `backdrop-filter: url()` di tepi elemen |

G1 adalah desain utama dan wajib terlihat lengkap di Safari iPhone. G2 hanya bonus dan tidak boleh membawa informasi apa pun.

### 5.3 Token glass

| Token | Terang | Gelap |
|---|---|---|
| `glass-fill` | `rgba(255, 255, 255, 0.58)` | `rgba(30, 30, 32, 0.52)` |
| `glass-fill-active` | `rgba(255, 255, 255, 0.82)` | `rgba(255, 255, 255, 0.14)` |
| `glass-blur` | `24px` | `28px` |
| `glass-saturate` | `180%` | `160%` |
| `glass-rim` | `rgba(255, 255, 255, 0.70)` | `rgba(255, 255, 255, 0.14)` |
| `glass-highlight` | `rgba(255, 255, 255, 0.95)` | `rgba(255, 255, 255, 0.22)` |
| `glass-shadow` | `0 1px 2px rgba(39,26,0,0.06), 0 10px 32px rgba(39,26,0,0.10)` | `0 1px 2px rgba(0,0,0,0.5), 0 12px 36px rgba(0,0,0,0.55)` |
| `scrim` | `rgba(253, 251, 250, 0.72)` | `rgba(0, 0, 0, 0.64)` |

### 5.4 CSS G1

```css
.glass {
  background: var(--glass-fill);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border-radius: var(--radius-glass-bar);
  box-shadow:
    inset 0 0 0 1px var(--glass-rim),
    inset 0 1px 0 0 var(--glass-highlight),
    var(--glass-shadow);
  isolation: isolate;
}

/* sheen tipis dari arah cahaya atas-kiri, memberi volume tanpa gradient dekoratif penuh */
.glass::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(160deg, var(--glass-highlight) 0%, transparent 38%);
  opacity: 0.35;
  mix-blend-mode: soft-light;
}

@media (prefers-reduced-transparency: reduce) {
  .glass {
    background: var(--surface);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  .glass::before { display: none; }
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass { background: var(--surface); }
}
```

Catatan implementasi:
- Elemen dengan `backdrop-filter` tidak boleh punya ancestor dengan `overflow: hidden` yang memotong area belakangnya.
- `backdrop-filter` membuat containing block baru. Jangan taruh elemen `position: fixed` di dalamnya.
- Pengaturan aksesibilitas "Reduce transparency" di iOS dan macOS dibaca lewat media query di atas oleh Safari. Tambahkan juga toggle manual "Kurangi transparansi" di Pengaturan app yang memberi atribut `data-transparency="reduced"` pada `<html>`.

### 5.5 G2 refraksi

Komponen `GlassLens` membungkus toggle cakupan, bar quick-add, dan tombol tambah.

1. Deteksi: `CSS.supports('backdrop-filter', 'url(#x)')` bernilai benar dan `navigator.userAgentData?.brands` berisi Chromium. Selain itu, pakai G1.
2. Peta displacement dibuat di canvas saat mount berdasarkan ukuran dan radius elemen: netral (128) di tengah, membengkok ke luar di pita tepi selebar 10px.
3. Filter SVG: `feImage` → `feDisplacementMap` (`scale` 18, kanal R dan G) → `feGaussianBlur` 0,6 → gabung dengan blur G1.
4. `color-interpolation-filters="sRGB"` wajib pada filter supaya tidak ada displacement hantu.
5. Region filter diperluas sebesar skala displacement supaya tepi tidak kosong.
6. Peta dibuat ulang saat ukuran berubah (ResizeObserver, debounce 100ms).
7. Dimatikan saat `prefers-reduced-motion` atau `prefers-reduced-transparency` aktif.

### 5.6 Perilaku glass

- **Tekan:** elemen glass membesar ke `scale(1.02)` dengan pegas (bagian 7), dan `glass-fill` naik ke `glass-fill-active` selama ditekan.
- **Indikator toggle cakupan:** indikator terpilih berupa kapsul `glass-fill-active` yang meluncur antar segmen dengan pegas, meregang sedikit ke arah gerak (`scaleX` sampai 1.08) lalu kembali. Ini satu-satunya momen "cair" yang dianimasikan.
- **Scroll:** toolbar atas menambah `glass-fill` 8% saat konten di bawahnya di-scroll lebih dari 8px, supaya teks toolbar tetap terbaca di atas angka.
- **Sheet:** muncul dari elemen pemicunya (morph dari tombol), bukan dari tepi layar.

### 5.7 Keterbacaan di atas glass

- Teks di atas glass minimal 15px berat 500.
- Kontras teks terhadap warna efektif glass diuji di atas tiga latar: kanvas kosong, tabel transaksi, dan grafik. Semua harus lolos 4,5:1.
- Kalau tidak lolos, naikkan `glass-fill`, jangan tambahkan text-shadow.

## 6. Medan ambien

Glass butuh sesuatu untuk dibiaskan. Di belakang seluruh app ada satu lapisan `AmbientField` yang tetap (tidak ikut scroll) dan membawa informasi cakupan.

| Cakupan | Isi medan |
|---|---|
| Saya | Dua cahaya radial besar warna identitas pengguna login |
| Partner | Dua cahaya radial warna identitas partner |
| Gabungan | Satu cahaya warna pengguna login di kiri atas, satu warna partner di kanan bawah |

Spesifikasi:
- Opasitas cahaya: 0,16 di mode terang, 0,22 di mode gelap. Blur 120px. Ukuran 60vmax.
- Pergantian cakupan: crossfade 480ms dengan `ease-out`.
- Medan tidak bergerak sendiri. Tidak ada animasi berulang.
- Kartu konten tetap solid di atas medan, jadi medan hanya terlihat di celah antar kartu dan melalui glass.
- G0: medan dimatikan, kanvas polos.

## 7. Gerak

| Token | Nilai | Pakai |
|---|---|---|
| `dur-fast` | 120ms | Hover, perubahan warna |
| `dur-base` | 220ms | Buka menu, toast |
| `dur-slow` | 480ms | Crossfade ambien |
| `ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Umum |
| `spring-glass` | stiffness 420, damping 32, mass 1 | Tekan glass, indikator toggle, morph sheet |

Tidak ada animasi masuk untuk setiap kartu saat halaman dimuat. Satu-satunya animasi saat memuat adalah angka hero yang menghitung naik dari nilai sebelumnya dalam 400ms, dan hanya kalau nilainya berubah.

`prefers-reduced-motion: reduce`: semua pegas menjadi crossfade 120ms.

## 8. Komponen

### Tombol

| Varian | Tampilan | Pakai |
|---|---|---|
| Utama | Isi `accent`, teks putih (gelap: teks `#001F21`), tinggi 40px, radius 12px | Satu per layar |
| Sekunder | Isi `surface-sunken`, border `border`, teks `text-primary` | Aksi lain |
| Hantu | Tanpa isi, teks `text-secondary` | Aksi tersier, ikon |
| Bahaya | Isi `surface-sunken`, teks `error` | Hapus, dengan dialog konfirmasi |

Tombol di dalam glass memakai varian hantu atau `glass-fill-active`, tidak pernah isi solid kecuali tombol tambah.

Target sentuh minimal 44x44px di layar kecil.

### Kartu konten

Isi `surface`, border 1px `border`, radius 12px, padding 20px (kecil: 16px), tanpa bayangan. Hierarki antar kartu dibuat lewat ukuran dan posisi, bukan bayangan atau warna.

Kartu tidak semuanya sama ukuran. Angka hero berdiri tanpa kartu, langsung di kanvas.

### Angka (`Amount`)

- Format `Rp 1.250.000` di angka lengkap, `1,25 jt` di sumbu grafik dan ruang sempit (`COPY.md` bagian 3).
- Tanda `+` atau `−` hanya muncul di daftar transaksi dan delta.
- Delta periode: `↑ 12% dari 1-10 Agu`, warna `text-secondary`. Warna `attention` hanya kalau delta pengeluaran melewati 15% dan kategori itu punya anggaran.

### Baris transaksi

Tinggi 56px. Kiri: ikon kategori 32px dalam lingkaran `surface-sunken` dengan titik identitas pemilik 8px di sudut kanan bawah. Tengah: nama merchant atau catatan, di bawahnya kategori dan akun (keterangan). Kanan: nominal, di bawahnya waktu. Kalau pencatat berbeda dari pemilik: "diisi oleh Rizz" di keterangan.

### Grafik

- Garis 2px, tanpa titik kecuali titik hover.
- Grid horizontal saja, warna `border`, 3 sampai 4 garis.
- Warna seri: pemasukan `text-primary`, pengeluaran `text-secondary` putus-putus, saldo kumulatif `accent`. Dengan begitu grafik tetap terbaca untuk buta warna.
- Donut tidak dipakai. Rincian kategori memakai batang horizontal berurutan, label penuh tanpa terpotong.
- Tooltip memakai glass G1 (satu-satunya glass di area konten, karena melayang sementara).

### Input nominal

Keyboard numerik di mobile (`inputmode="decimal"`). Nilai terformat saat mengetik (`25000` menjadi `25.000`). Singkatan "rb", "jt", "k" diterima.

### Titik identitas

Lingkaran 8px warna identitas dengan ring 2px `surface` supaya terbaca di atas ikon.

## 9. Ikon

Lucide, stroke 1,75px, ukuran 20px di kontrol dan 16px di keterangan. Tidak ada emoji di UI.

## 10. Aksesibilitas

- WCAG 2.2 AA. Kontras diuji untuk kedua mode dan untuk teks di atas glass (bagian 5.7).
- Fokus: ring 2px `accent` dengan offset 2px, terlihat juga di atas glass.
- Toggle cakupan adalah `radiogroup` dengan navigasi panah.
- Semua grafik punya tabel data alternatif yang bisa dibuka.
- Status tidak pernah hanya dibawa warna: selalu ada teks atau ikon.

## 11. Panduan untuk agen

1. Semua warna, radius, spasi, dan durasi diambil dari token di `src/styles/tokens.css`. Nilai hex atau px bebas di komponen ditolak saat review.
2. Komponen glass hanya dibuat lewat `<GlassSurface>`. Menulis `backdrop-filter` di luar `glass.css` ditolak.
3. Sebelum menambah glass ke komponen baru, cek tabel bagian 5.1. Kalau komponennya konten, jawabannya tidak.
4. Setiap layar diuji di Safari iOS (WebKit Playwright) dan Chrome, dalam mode terang dan gelap, dengan dan tanpa reduced transparency.
