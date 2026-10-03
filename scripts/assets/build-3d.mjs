// Mengubah PNG 3D Microsoft Fluent Emoji (MIT) menjadi WebP 64/128/256 px di public/assets/3d.
// Pakai: node scripts/assets/build-3d.mjs <folder clone fluentui-emoji>
// Clone ringan: git clone --depth 1 --filter=blob:none --sparse https://github.com/microsoft/fluentui-emoji.git
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// nama folder Fluent; berkas keluaran memakai versi kebab-case. Harus sama dengan src/components/assets/asset-names.ts
export const FLUENT_FOLDERS = [
  "Abacus", "Airplane", "Alarm clock", "Automobile", "Baby bottle", "Balance scale", "Bank", "Bar chart", "Bell", "Books",
  "Briefcase", "Bullseye", "Bus", "Chart increasing", "Check mark button", "Classical building", "Clipboard",
  "Closed mailbox with lowered flag", "Coin", "Convenience store", "Counterclockwise arrows button", "Credit card",
  "Dollar banknote", "Droplet", "Envelope", "Fork and knife with plate", "Fuel pump", "Gear", "Gem stone",
  "Globe with meridians", "Graduation cap", "High voltage", "Hot beverage", "House", "House with garden", "Inbox tray",
  "Key", "Label", "Ledger", "Left-right arrow", "Light bulb", "Memo", "Mobile phone", "Money bag", "Money with wings",
  "Motor scooter", "Motorway", "Musical notes", "Open file folder", "Package", "Page facing up", "Party popper",
  "Paw prints", "People hugging", "Pill", "Popcorn", "Purse", "Receipt", "Red envelope", "Repeat button", "Running shoe",
  "Satellite antenna", "Seedling", "Shopping bags", "Shopping cart", "Spiral calendar", "Steaming bowl", "T-shirt",
  "Triangular flag", "Trophy", "Wrapped gift",
];

export const SIZES = [64, 128, 256];

const kebab = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const src = process.argv[2];
  if (!src) throw new Error("Berikan path clone fluentui-emoji");
  const out = path.resolve("public/assets/3d");
  fs.mkdirSync(out, { recursive: true });
  let total = 0;
  for (const folder of FLUENT_FOLDERS) {
    const dir = path.join(src, "assets", folder, "3D");
    const file = fs.readdirSync(dir).find((f) => f.endsWith(".png"));
    if (!file) throw new Error(`PNG 3D tidak ada: ${folder}`);
    for (const size of SIZES) {
      const dest = path.join(out, `${kebab(folder)}-${size}.webp`);
      // 256 adalah ukuran asli; lebih kecil diperkecil dengan lanczos supaya tepi tetap tajam
      await sharp(path.join(dir, file))
        .resize(size, size, { fit: "contain", kernel: "lanczos3", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: size === 256 ? 80 : 86, alphaQuality: 90, effort: 6, smartSubsample: true })
        .toFile(dest);
      total += fs.statSync(dest).size;
    }
  }
  console.log(`${FLUENT_FOLDERS.length} aset, ${FLUENT_FOLDERS.length * SIZES.length} berkas, ${(total / 1024).toFixed(1)} KB`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
