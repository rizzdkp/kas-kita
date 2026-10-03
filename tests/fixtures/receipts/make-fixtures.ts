import { writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

// struk sintetis berisi teks yang sama dengan tests/fixtures/ai/receipt.json; EXIF GPS sengaja ditanam untuk tes pembuangan metadata
const lines = [
  "INDOMARET MERDEKA RAYA",
  "20.09.26 19:42",
  "INDOMIE GORENG 5PCS    15.500",
  "BERAS SANIA 5KG        72.900",
  "TELUR AYAM 10S         28.500",
  "AQUA 1500ML 2X          9.000",
  "CHITATO SAPI BBQ 68G   11.900",
  "SUNLIGHT JERUK 755ML   17.500",
  "PEPSODENT 190G         14.300",
  "HEMAT INDOMIE          -1.600",
  "TOTAL                 168.000",
];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1400"><rect width="100%" height="100%" fill="#fbfaf6"/>${lines
  .map((l, i) => `<text x="60" y="${120 + i * 100}" font-family="monospace" font-size="40" fill="#222" xml:space="preserve">${l}</text>`)
  .join("")}</svg>`;

const out = join(process.cwd(), "tests/fixtures/receipts");
const jpeg = await sharp(Buffer.from(svg))
  .jpeg({ quality: 85 })
  .withExif({ IFD0: { Make: "KasKitaTes", Model: "Kamera" }, IFD3: { GPSLatitudeRef: "S", GPSLatitude: "6/1 10/1 0/1" } })
  .toBuffer();
writeFileSync(join(out, "indomaret.jpg"), jpeg);
writeFileSync(join(out, "bukan-gambar.jpg"), "ini file teks yang namanya diganti menjadi jpg\n");
console.log("fixtures", jpeg.length);
