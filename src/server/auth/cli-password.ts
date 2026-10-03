import { CreateUserError } from "./create-user";

export type PasswordSource = { kind: "prompt" } | { kind: "stdin" } | { kind: "env"; name: string };

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  // hanya satu baris baru di akhir yang dibuang; spasi lain bagian dari password
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

// input mentah tanpa echo supaya password tidak tampil di layar maupun riwayat terminal
export function promptHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) return Promise.reject(new CreateUserError("Tidak ada terminal untuk mengetik password. Pakai --password-stdin atau --password-env NAMA_ENV."));
  process.stdout.write(question);
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (data: Buffer) => {
      for (const char of data.toString("utf8")) {
        if (char === "\r" || char === "\n") return finish();
        if (char === "\u0003") return finish(new CreateUserError("Dibatalkan."));
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else if (char >= " ") value += char;
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

export async function readPassword(source: PasswordSource): Promise<string> {
  if (source.kind === "stdin") return readAllStdin();
  if (source.kind === "env") {
    const value = process.env[source.name];
    if (!value) throw new CreateUserError(`Variabel lingkungan ${source.name} kosong atau tidak ada.`);
    return value;
  }
  const first = await promptHidden("Password baru (minimal 12 karakter): ");
  const second = await promptHidden("Ulangi password: ");
  if (first !== second) throw new CreateUserError("Kedua password belum sama.");
  return first;
}
