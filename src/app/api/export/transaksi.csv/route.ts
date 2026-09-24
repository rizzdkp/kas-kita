import { transactionFiltersFromLink } from "../_lib/filters";
import { CSV_HEADER, csvFilename, csvLine, transactionCsvRow } from "../_lib/csv";
import { parseTransactionSearchParams } from "@/components/reports/transaction-link";
import { getViewerFromHeaders } from "@/server/auth/session";
import { listTransactions } from "@/server/queries/transactions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

/** Ekspor CSV transaksi dengan filter yang sama dengan halaman Transaksi (F-REP-1 AC2). */
export async function GET(request: Request): Promise<Response> {
  const viewer = await getViewerFromHeaders(request.headers);
  if (!viewer) {
    return new Response("Sesimu berakhir. Masuk lagi untuk melanjutkan.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }
  const link = parseTransactionSearchParams(new URL(request.url).searchParams);
  const filters = transactionFiltersFromLink(link, Boolean(viewer.partner));
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // BOM supaya Excel membaca UTF-8
        controller.enqueue(encoder.encode(`﻿${csvLine([...CSV_HEADER])}`));
        let cursor: string | null = null;
        do {
          const page = await listTransactions(viewer, filters, { cursor, limit: PAGE_SIZE });
          controller.enqueue(encoder.encode(page.rows.map(transactionCsvRow).join("")));
          cursor = page.nextCursor;
        } while (cursor);
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(link.from, link.to)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
