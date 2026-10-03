// pengiriman web push berjalan di proses server Node; bentuk if ini wajib supaya bundel edge tidak memuat web-push
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startNodeServices } = await import("./instrumentation-node");
    await startNodeServices();
  }
}
