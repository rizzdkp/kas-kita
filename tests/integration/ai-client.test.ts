import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { closeDb, resetDb, testDb } from "../helpers/db";
import { createHousehold, type Household } from "../helpers/fixtures";
import { aiCalls, aiSettings } from "@/server/db/schema";
import { completeStructured, getAiConfig, listModels } from "@/server/ai/client";
import { aiTimeouts } from "@/server/ai/http";
import type { AiConfig, StructuredRequest } from "@/server/ai/types";
import { saveAiSettings } from "@/server/mutations/ai-settings";

process.env.APP_ENCRYPTION_KEY ??= randomBytes(32).toString("base64");

type Body = { model: string; messages: Array<{ role: string; content: unknown }>; response_format?: { type: string } };
type Reply = { status: number; body: unknown; delayMs?: number };
type Handler = (body: Body, index: number) => Reply;

const SECRET_KEY = "sk-rahasia-sekali-1234";
let server: Server;
let baseUrl: string;
let handler: Handler;
let requests: Body[];
let modelsReply: Reply;
let h: Household;

function chat(content: string): Reply {
  return { status: 200, body: { choices: [{ message: { role: "assistant", content } }], usage: { prompt_tokens: 12, completion_tokens: 7 } } };
}
const rejectFormat = (type: string): Reply => ({ status: 400, body: { error: { message: `response_format ${type} is not supported` } } });

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

beforeAll(async () => {
  server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const reply =
      req.method === "GET"
        ? modelsReply
        : await readBody(req).then((raw) => {
            const body = JSON.parse(raw) as Body;
            requests.push(body);
            return handler(body, requests.length - 1);
          });
    if (reply.delayMs) await new Promise((r) => setTimeout(r, reply.delayMs));
    if (res.destroyed) return;
    res.writeHead(reply.status, { "content-type": "application/json" });
    res.end(JSON.stringify(reply.body));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  await closeDb();
});

beforeEach(async () => {
  await resetDb();
  h = await createHousehold(testDb);
  requests = [];
  handler = () => chat('{"nama":"kopi","jumlah":2}');
  modelsReply = { status: 200, body: { data: [{ id: "zeta" }, { id: "Alpha" }, { id: "beta" }] } };
});

afterEach(() => {
  aiTimeouts.text = 30_000;
  aiTimeouts.models = 10_000;
});

const schema = z.object({ nama: z.string(), jumlah: z.number().int() });
const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;

function request(overrides: Partial<StructuredRequest<z.infer<typeof schema>>> = {}): StructuredRequest<z.infer<typeof schema>> {
  return { purpose: "quick_add", kind: "text", system: "Baca transaksi.", user: "kopi 2", schemaName: "tes_skema", schema, jsonSchema, ...overrides };
}

async function configWith(supportsJsonSchema: boolean | null = null): Promise<AiConfig> {
  await saveAiSettings(h.rizz, { baseUrl, apiKey: SECRET_KEY, textModel: "model-teks", visionModel: "model-vision", version: null }, testDb);
  if (supportsJsonSchema !== null) await testDb.update(aiSettings).set({ supportsJsonSchema });
  const config = await getAiConfig(testDb);
  if (!config) throw new Error("config kosong");
  return config;
}

async function storedSupport() {
  const [row] = await testDb.select({ v: aiSettings.supportsJsonSchema }).from(aiSettings);
  return row?.v;
}

const systemOf = (b: Body) => String(b.messages.find((m) => m.role === "system")?.content);

describe("getAiConfig", () => {
  it("null bila belum ada pengaturan, lalu key terdekripsi setelah disimpan", async () => {
    expect(await getAiConfig(testDb)).toBeNull();
    const config = await configWith();
    expect(config).toMatchObject({ baseUrl, apiKey: SECRET_KEY, textModel: "model-teks", visionModel: "model-vision", supportsJsonSchema: null });
  });
});

describe("listModels", () => {
  it("mengurutkan ID model secara alfabet", async () => {
    expect(await listModels({ baseUrl, apiKey: SECRET_KEY })).toEqual({ ok: true, models: ["Alpha", "beta", "zeta"] });
  });

  it("daftar kosong menawarkan input ID manual", async () => {
    modelsReply = { status: 200, body: { data: [] } };
    const res = await listModels({ baseUrl, apiKey: SECRET_KEY });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/ketik ID model secara manual/i);
  });

  it("server mati dan timeout menawarkan input ID manual", async () => {
    const dead = await listModels({ baseUrl: "http://127.0.0.1:9/v1", apiKey: SECRET_KEY });
    expect(dead).toEqual({ ok: false, message: expect.stringMatching(/ketik ID model secara manual/i) });
    aiTimeouts.models = 100;
    modelsReply = { status: 200, body: { data: [] }, delayMs: 400 };
    expect((await listModels({ baseUrl, apiKey: SECRET_KEY })).ok).toBe(false);
  });
});

describe("completeStructured", () => {
  it("json_schema diterima: satu panggilan, supports_json_schema = true, ai_calls hanya metadata", async () => {
    const res = await completeStructured(await configWith(), request(), testDb);
    expect(res).toEqual({ ok: true, data: { nama: "kopi", jumlah: 2 } });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.response_format?.type).toBe("json_schema");
    expect(await storedSupport()).toBe(true);
    const calls = await testDb.select().from(aiCalls);
    expect(calls).toEqual([expect.objectContaining({ purpose: "quick_add", model: "model-teks", inputTokens: 12, outputTokens: 7, ok: true, error: null })]);
    expect(JSON.stringify(calls)).not.toContain("kopi");
    expect(JSON.stringify(calls)).not.toContain(SECRET_KEY);
  });

  it("server menolak json_schema: fallback json_object dengan baris schema di system prompt, supports_json_schema = false", async () => {
    handler = (b) => (b.response_format?.type === "json_schema" ? rejectFormat("json_schema") : chat('{"nama":"kopi","jumlah":2}'));
    const res = await completeStructured(await configWith(), request(), testDb);
    expect(res.ok).toBe(true);
    expect(requests.map((r) => r.response_format?.type)).toEqual(["json_schema", "json_object"]);
    expect(systemOf(requests[1]!)).toContain("schema: tes_skema");
    expect(await storedSupport()).toBe(false);
    const errors = (await testDb.select().from(aiCalls).orderBy(aiCalls.createdAt)).map((c) => c.error);
    expect(errors).toEqual(["format_rejected", null]);
  });

  it("server menolak keduanya: dikirim tanpa response_format dengan instruksi JSON", async () => {
    handler = (b) => (b.response_format ? rejectFormat(b.response_format.type) : chat('```json\n{"nama":"kopi","jumlah":2}\n```'));
    const res = await completeStructured(await configWith(), request(), testDb);
    expect(res).toEqual({ ok: true, data: { nama: "kopi", jumlah: 2 } });
    expect(requests.map((r) => r.response_format?.type ?? "none")).toEqual(["json_schema", "json_object", "none"]);
    expect(systemOf(requests[2]!)).toMatch(/objek JSON[\s\S]*schema: tes_skema/);
    expect(await storedSupport()).toBe(false);
  });

  it("supports_json_schema = false: request berikutnya langsung tanpa json_schema", async () => {
    await completeStructured(await configWith(false), request(), testDb);
    expect(requests.map((r) => r.response_format?.type)).toEqual(["json_object"]);
  });

  it("JSON rusak dua kali: satu retry lalu invalid_output tanpa partial", async () => {
    handler = () => chat('{"rusak": ');
    const res = await completeStructured(await configWith(), request(), testDb);
    expect(res).toEqual({ ok: false, error: { code: "invalid_output", message: expect.any(String) }, partial: undefined });
    expect(requests).toHaveLength(2);
  });

  it("gagal validasi: retry melampirkan pesan validasi, gagal lagi mengembalikan partial", async () => {
    handler = (_b, i) => chat(i === 0 ? '{"nama":"kopi","jumlah":"dua"}' : '{"nama":"kopi susu"}');
    const res = await completeStructured(await configWith(), request(), testDb);
    expect(res).toMatchObject({ ok: false, error: { code: "invalid_output" }, partial: { nama: "kopi susu" } });
    const retry = requests[1]!.messages;
    expect(retry.at(-2)).toEqual({ role: "assistant", content: '{"nama":"kopi","jumlah":"dua"}' });
    expect(String(retry.at(-1)!.content)).toContain("jumlah:");
    const calls = await testDb.select().from(aiCalls);
    expect(calls.map((c) => c.error)).toEqual(["invalid_output", "invalid_output"]);
  });

  it("gagal validasi lalu retry berhasil", async () => {
    handler = (_b, i) => chat(i === 0 ? "Berikut hasilnya: {}" : 'Hasil: {"nama":"kopi","jumlah":2} selesai');
    expect(await completeStructured(await configWith(), request(), testDb)).toEqual({ ok: true, data: { nama: "kopi", jumlah: 2 } });
  });

  it("model tanpa vision: no_vision dengan pesan COPY", async () => {
    handler = () => ({ status: 400, body: { error: { message: "This model does not support image input" } } });
    const res = await completeStructured(
      await configWith(),
      request({ purpose: "receipt", kind: "vision", user: [{ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } }] }),
      testDb,
    );
    expect(res).toMatchObject({
      ok: false,
      error: { code: "no_vision", message: "Model model-vision tidak bisa membaca gambar. Pilih model vision lain di pengaturan AI.", serverMessage: "This model does not support image input" },
    });
  });

  it("timeout dan server tidak bisa dihubungi: unreachable dengan pesan COPY", async () => {
    aiTimeouts.text = 150;
    handler = () => ({ ...chat("{}"), delayMs: 600 });
    const config = await configWith();
    const expected = { ok: false, error: { code: "unreachable", message: "Model AI tidak merespons. Cek pengaturan AI atau isi field yang kosong sendiri." } };
    expect(await completeStructured(config, request(), testDb)).toEqual(expected);
    expect(await completeStructured({ ...config, baseUrl: "http://127.0.0.1:9/v1" }, request(), testDb)).toEqual(expected);
    const errors = (await testDb.select().from(aiCalls).orderBy(aiCalls.createdAt)).map((c) => c.error);
    expect(errors).toEqual(["timeout", "unreachable"]);
  });

  it("HTTP 401: http_error dengan pesan server tanpa key", async () => {
    handler = () => ({ status: 401, body: { error: { message: `Incorrect API key provided: ${SECRET_KEY}` } } });
    const res = await completeStructured(await configWith(), request(), testDb);
    expect(res).toMatchObject({ ok: false, error: { code: "http_error" } });
    if (!res.ok) expect(res.error.serverMessage).toBe("Incorrect API key provided: ••••");
  });

  it("model belum dipilih: not_configured tanpa request", async () => {
    const config = await configWith();
    const res = await completeStructured({ ...config, visionModel: null }, request({ kind: "vision" }), testDb);
    expect(res).toMatchObject({ ok: false, error: { code: "not_configured" } });
    expect(requests).toHaveLength(0);
  });
});
