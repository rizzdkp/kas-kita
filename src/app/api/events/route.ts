import { getViewerFromHeaders } from "@/server/auth/session";
import { subscribeChanges } from "@/server/realtime/listener";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// di bawah batas idle proxy umum (30-60 dtk) supaya koneksi tidak diputus diam-diam
const HEARTBEAT_MS = 25_000;
// jeda sambung ulang yang disarankan ke EventSource
const RETRY_MS = 3_000;

const SESSION_ENDED = "Sesimu berakhir. Masuk lagi untuk melanjutkan.";

/** SSE perubahan data antar pengguna (ARCHITECTURE 8): mengirim {entity, id}; klien memanggil router.refresh(). */
export async function GET(request: Request): Promise<Response> {
  const viewer = await getViewerFromHeaders(request.headers);
  if (!viewer) {
    return new Response(SESSION_ENDED, {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const heartbeat = setInterval(() => {
        // sesi dicabut di perangkat lain: hentikan aliran supaya klien tidak terus menerima event
        void getViewerFromHeaders(request.headers).then(
          (v) => (v ? write(": ping\n\n") : close()),
          () => write(": ping\n\n"),
        );
      }, HEARTBEAT_MS);
      function close() {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe?.();
        request.signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // sudah ditutup oleh runtime
        }
      }
      cleanup = close;
      request.signal.addEventListener("abort", close);

      write(`retry: ${RETRY_MS}\n: terhubung\n\n`);
      try {
        const stop = await subscribeChanges((event) => write(`event: change\ndata: ${JSON.stringify(event)}\n\n`));
        if (closed) stop();
        else unsubscribe = stop;
      } catch {
        close();
      }
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
