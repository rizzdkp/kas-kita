// pdfjs-dist tidak menyertakan tipe untuk modul worker legacy; hanya WorkerMessageHandler yang dipakai
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs" {
  export const WorkerMessageHandler: unknown;
}
