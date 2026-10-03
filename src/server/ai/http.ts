import type { AiContentPart } from "./types";

// batas waktu ARCHITECTURE 5; objek bisa diubah tes supaya tes timeout tidak menunggu 30 detik
export const aiTimeouts = { models: 10_000, text: 30_000, vision: 60_000 };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | AiContentPart[] };

export type HttpOutcome =
  | { kind: "ok"; json: unknown }
  | { kind: "http"; status: number; message: string }
  | { kind: "network"; reason: "timeout" | "unreachable" };

const MAX_SERVER_MESSAGE = 300;

export function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

/** Pesan server dipotong dan dibersihkan dari key; tetap ditampilkan di hasil tes koneksi. */
export function sanitizeServerMessage(message: string, apiKey: string): string {
  let out = message.replace(/\s+/g, " ").trim();
  if (apiKey.length >= 4) out = out.split(apiKey).join("••••");
  return out.length > MAX_SERVER_MESSAGE ? `${out.slice(0, MAX_SERVER_MESSAGE)}…` : out;
}

function errorMessageFrom(text: string): string {
  try {
    const body = JSON.parse(text) as unknown;
    if (body && typeof body === "object") {
      const err = (body as { error?: unknown; message?: unknown; detail?: unknown }).error;
      if (typeof err === "string") return err;
      if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") return (err as { message: string }).message;
      const msg = (body as { message?: unknown }).message ?? (body as { detail?: unknown }).detail;
      if (typeof msg === "string") return msg;
    }
  } catch {
    // bukan JSON; pakai teks mentah
  }
  return text;
}

export async function requestJson(
  url: string,
  init: { method: "GET" | "POST"; apiKey: string; body?: unknown; timeoutMs: number },
): Promise<HttpOutcome> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: {
        authorization: `Bearer ${init.apiKey}`,
        accept: "application/json",
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs),
      cache: "no-store",
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return { kind: "network", reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable" };
  }
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    return { kind: "network", reason: name === "TimeoutError" || name === "AbortError" ? "timeout" : "unreachable" };
  }
  if (!res.ok) {
    return { kind: "http", status: res.status, message: sanitizeServerMessage(errorMessageFrom(text) || res.statusText, init.apiKey) };
  }
  try {
    return { kind: "ok", json: JSON.parse(text) as unknown };
  } catch {
    return { kind: "http", status: res.status, message: "Balasan server bukan JSON" };
  }
}
