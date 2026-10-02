import { describe, expect, it } from "vitest";
import { decodeCsv, detectEncoding, looksLikeText } from "@/server/import/csv/encoding";
import { tokenizeCsv } from "@/server/import/csv/tokenize";

describe("tokenizeCsv (RFC 4180)", () => {
  it("field ber-kutip dengan pemisah, kutip ganda, dan baris baru", () => {
    const text = 'a,"b, c","say ""hi""","line1\nline2"\r\n1,2,3,4';
    expect(tokenizeCsv(text, ",")).toEqual([
      ["a", "b, c", 'say "hi"', "line1\nline2"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("CRLF, LF, dan CR; baris baru di akhir tidak menambah baris kosong", () => {
    expect(tokenizeCsv("a;b\r\nc;d\ne;f\rg;h\n", ";")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
      ["g", "h"],
    ]);
  });

  it("sel kosong dan baris kosong tetap terbaca", () => {
    expect(tokenizeCsv("a,,c\n\n,,", ",")).toEqual([["a", "", "c"], [""], ["", "", ""]]);
  });

  it("tab sebagai pemisah dan kutip di tengah field dibaca apa adanya", () => {
    expect(tokenizeCsv('5" layar\tb', "\t")).toEqual([['5" layar', "b"]]);
  });

  it("maxRows berhenti lebih awal", () => {
    expect(tokenizeCsv("1\n2\n3\n", ",", 2)).toEqual([["1"], ["2"]]);
  });
});

describe("encoding", () => {
  const cafeUtf8 = new TextEncoder().encode("Café");
  const cafe1252 = Uint8Array.from([0x43, 0x61, 0x66, 0xe9]);

  it("UTF-8 valid dan UTF-8 ber-BOM", () => {
    expect(detectEncoding(cafeUtf8)).toBe("utf-8");
    const bom = Uint8Array.from([0xef, 0xbb, 0xbf, ...cafeUtf8]);
    expect(detectEncoding(bom)).toBe("utf-8");
    expect(decodeCsv(bom, "utf-8")).toBe("Café");
  });

  it("byte yang bukan UTF-8 valid dibaca sebagai Windows-1252", () => {
    expect(detectEncoding(cafe1252)).toBe("windows-1252");
    expect(decodeCsv(cafe1252, "windows-1252")).toBe("Café");
  });

  it("looksLikeText menolak biner dan UTF-16", () => {
    expect(looksLikeText(new TextEncoder().encode("a,b\n1,2"))).toBe(true);
    expect(looksLikeText(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x00, 0x01]))).toBe(false);
    expect(looksLikeText(Uint8Array.from([0xff, 0xfe, 0x61, 0x00]))).toBe(false);
    expect(looksLikeText(new Uint8Array())).toBe(false);
  });
});
