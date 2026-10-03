import { createHash } from "node:crypto";

// penulis PDF minimal untuk fixture: teks Helvetica per sel, opsional enkripsi standar RC4 128-bit (R3)
// supaya fixture berpassword bisa dibuat tanpa qpdf atau dependensi baru

export interface PdfText {
  x: number;
  y: number;
  text: string;
  size?: number;
  bold?: boolean;
}

export interface PdfWriteOptions {
  userPassword?: string;
  ownerPassword?: string;
  /** Seed ID dokumen supaya byte fixture stabil antar generate. */
  idSeed: string;
}

const PAGE_W = 595;
const PAGE_H = 842;

// Algorithm 2 PDF 1.7: padding 32 byte untuk password
const PAD = Buffer.from(
  "28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A",
  "hex",
);

function md5(...parts: Buffer[]): Buffer {
  const h = createHash("md5");
  for (const p of parts) h.update(p);
  return h.digest();
}

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 0xff;
    [s[i], s[j]] = [s[j]!, s[i]!];
  }
  const out = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let n = 0; n < data.length; n++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]!) & 0xff;
    [s[i], s[j]] = [s[j]!, s[i]!];
    out[n] = data[n]! ^ s[(s[i]! + s[j]!) & 0xff]!;
  }
  return out;
}

function padPassword(pw: string): Buffer {
  return Buffer.concat([Buffer.from(pw, "latin1"), PAD]).subarray(0, 32);
}

function rc4Rounds(key: Buffer, data: Buffer): Buffer {
  let x = rc4(key, data);
  for (let i = 1; i <= 19; i++) x = rc4(Buffer.from(key.map((b) => b ^ i)), x);
  return x;
}

interface Security {
  key: Buffer;
  o: Buffer;
  u: Buffer;
  p: number;
}

function buildSecurity(user: string, owner: string, id0: Buffer): Security {
  const p = -3904;
  let ownerKey = md5(padPassword(owner));
  for (let i = 0; i < 50; i++) ownerKey = md5(ownerKey);
  const o = rc4Rounds(ownerKey, padPassword(user));
  const pBytes = Buffer.alloc(4);
  pBytes.writeInt32LE(p);
  let key = md5(padPassword(user), o, pBytes, id0);
  for (let i = 0; i < 50; i++) key = md5(key);
  const u = Buffer.concat([rc4Rounds(key, md5(PAD, id0)), Buffer.alloc(16)]);
  return { key, o, u, p };
}

function objectKey(sec: Security, num: number): Buffer {
  const suffix = Buffer.from([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, 0, 0]);
  return md5(sec.key, suffix);
}

function escapeText(s: string): string {
  return s.replace(/[\\()]/g, (c) => `\\${c}`);
}

function contentStream(items: PdfText[]): Buffer {
  const ops = items.map((t) => {
    const font = t.bold ? "F2" : "F1";
    return `BT /${font} ${t.size ?? 9} Tf ${t.x} ${t.y} Td (${escapeText(t.text)}) Tj ET`;
  });
  return Buffer.from(ops.join("\n"), "latin1");
}

/** PDF 1.4 satu halaman A4 per elemen `pages`; koordinat dari kiri bawah. */
export function writePdf(pages: PdfText[][], opts: PdfWriteOptions): Buffer {
  const id0 = md5(Buffer.from(opts.idSeed, "utf8"));
  const sec = opts.userPassword !== undefined ? buildSecurity(opts.userPassword, opts.ownerPassword ?? `${opts.userPassword}-pemilik`, id0) : null;

  const bodies = new Map<number, Buffer>();
  const pageIds = pages.map((_, i) => 5 + i * 2);
  bodies.set(1, Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"));
  bodies.set(2, Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`));
  bodies.set(3, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  bodies.set(4, Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));
  pages.forEach((items, i) => {
    const pageId = pageIds[i]!;
    const contentId = pageId + 1;
    bodies.set(
      pageId,
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`,
      ),
    );
    let data = contentStream(items);
    if (sec) data = rc4(objectKey(sec, contentId), data);
    bodies.set(
      contentId,
      Buffer.concat([Buffer.from(`<< /Length ${data.length} >>\nstream\n`), data, Buffer.from("\nendstream")]),
    );
  });
  const encryptId = sec ? 5 + pages.length * 2 : null;
  if (sec && encryptId) {
    bodies.set(
      encryptId,
      Buffer.from(
        `<< /Filter /Standard /V 2 /R 3 /Length 128 /O <${sec.o.toString("hex")}> /U <${sec.u.toString("hex")}> /P ${sec.p} >>`,
      ),
    );
  }

  const count = Math.max(...bodies.keys());
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "latin1")];
  let offset = chunks[0]!.length;
  const offsets: number[] = [];
  for (let n = 1; n <= count; n++) {
    const obj = Buffer.concat([Buffer.from(`${n} 0 obj\n`), bodies.get(n)!, Buffer.from("\nendobj\n")]);
    offsets[n] = offset;
    chunks.push(obj);
    offset += obj.length;
  }
  const xref = [`xref\n0 ${count + 1}\n`, "0000000000 65535 f \n", ...offsets.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
  const idHex = id0.toString("hex");
  const trailer = `trailer\n<< /Size ${count + 1} /Root 1 0 R${encryptId ? ` /Encrypt ${encryptId} 0 R` : ""} /ID [<${idHex}> <${idHex}>] >>\nstartxref\n${offset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref + trailer));
  return Buffer.concat(chunks);
}
