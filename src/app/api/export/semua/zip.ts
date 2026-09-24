import { crc32, deflateRawSync } from "node:zlib";

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  /** Gambar dan PDF sudah terkompresi, jadi disimpan apa adanya. */
  compress: boolean;
}

interface CentralRecord {
  name: Buffer;
  crc: number;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

// tanggal DOS tetap 1 Jan 1980; waktu ekspor ada di data.json
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
// bit 11: nama file UTF-8
const FLAGS = 0x0800;

function localHeader(rec: CentralRecord): Buffer {
  const b = Buffer.alloc(30);
  b.writeUInt32LE(0x04034b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(FLAGS, 6);
  b.writeUInt16LE(rec.method, 8);
  b.writeUInt16LE(DOS_TIME, 10);
  b.writeUInt16LE(DOS_DATE, 12);
  b.writeUInt32LE(rec.crc, 14);
  b.writeUInt32LE(rec.compressedSize, 18);
  b.writeUInt32LE(rec.size, 22);
  b.writeUInt16LE(rec.name.length, 26);
  b.writeUInt16LE(0, 28);
  return Buffer.concat([b, rec.name]);
}

function centralHeader(rec: CentralRecord): Buffer {
  const b = Buffer.alloc(46);
  b.writeUInt32LE(0x02014b50, 0);
  b.writeUInt16LE(20, 4);
  b.writeUInt16LE(20, 6);
  b.writeUInt16LE(FLAGS, 8);
  b.writeUInt16LE(rec.method, 10);
  b.writeUInt16LE(DOS_TIME, 12);
  b.writeUInt16LE(DOS_DATE, 14);
  b.writeUInt32LE(rec.crc, 16);
  b.writeUInt32LE(rec.compressedSize, 20);
  b.writeUInt32LE(rec.size, 24);
  b.writeUInt16LE(rec.name.length, 28);
  b.writeUInt32LE(rec.offset, 42);
  return Buffer.concat([b, rec.name]);
}

function endOfCentral(count: number, size: number, offset: number): Buffer {
  const b = Buffer.alloc(22);
  b.writeUInt32LE(0x06054b50, 0);
  b.writeUInt16LE(count, 8);
  b.writeUInt16LE(count, 10);
  b.writeUInt32LE(size, 12);
  b.writeUInt32LE(offset, 16);
  return b;
}

/**
 * ZIP tanpa dependensi: satu entri dibaca per langkah supaya lampiran tidak dimuat sekaligus.
 * Tanpa ZIP64, jadi total arsip dibatasi 4 GB dan 65.535 file; jauh di atas target 2.000 lampiran.
 */
export function zipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const records: CentralRecord[] = [];
  let offset = 0;
  const iterator = entries[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();
      if (!next.done) {
        const entry = next.value;
        const body = entry.compress ? deflateRawSync(entry.data) : entry.data;
        const rec: CentralRecord = {
          name: Buffer.from(entry.name, "utf8"),
          crc: crc32(entry.data) >>> 0,
          method: entry.compress ? 8 : 0,
          compressedSize: body.length,
          size: entry.data.length,
          offset,
        };
        const header = localHeader(rec);
        records.push(rec);
        offset += header.length + body.length;
        controller.enqueue(new Uint8Array(header));
        controller.enqueue(new Uint8Array(body));
        return;
      }
      const central = Buffer.concat(records.map(centralHeader));
      controller.enqueue(new Uint8Array(central));
      controller.enqueue(new Uint8Array(endOfCentral(records.length, central.length, offset)));
      controller.close();
    },
  });
}
