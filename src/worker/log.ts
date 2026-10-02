// log JSON satu baris ke stdout; hanya metadata job, tidak pernah isi transaksi, nominal, key, atau password
export function logEvent(level: "info" | "error", msg: string, fields: Record<string, string | number | boolean | null> = {}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export function errorName(e: unknown): string {
  return e instanceof Error ? e.name : typeof e;
}
