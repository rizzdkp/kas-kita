import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// server OpenAI-compatible palsu untuk dev dan e2e: jawaban diambil dari tests/fixtures/ai/<schemaName>.json
// perilaku diatur env: FAKE_AI_REJECT=json_schema|json_object|both, FAKE_AI_BROKEN=1, FAKE_AI_NO_VISION=<model>
const port = Number(process.env.FAKE_AI_PORT ?? 4010);
const fixturesDir = process.env.FAKE_AI_FIXTURES ?? join(process.cwd(), "tests/fixtures/ai");
const models = (process.env.FAKE_AI_MODELS ?? "fake-text,fake-vision").split(",");

type ChatBody = {
  model?: string;
  messages?: Array<{ role: string; content: unknown }>;
  response_format?: { type: string; json_schema?: { name?: string } };
};

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function schemaNameFrom(body: ChatBody): string {
  if (body.response_format?.json_schema?.name) return body.response_format.json_schema.name;
  const system = body.messages?.find((m) => m.role === "system")?.content;
  const match = typeof system === "string" ? system.match(/schema:\s*([a-z0-9_]+)/i) : null;
  return match?.[1] ?? "default";
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "";
  if (req.method === "GET" && url.endsWith("/models")) {
    return send(res, 200, { object: "list", data: models.map((id) => ({ id, object: "model" })) });
  }
  if (req.method === "POST" && url.endsWith("/chat/completions")) {
    const body = JSON.parse(await readBody(req)) as ChatBody;
    const reject = process.env.FAKE_AI_REJECT;
    const type = body.response_format?.type;
    if ((type === "json_schema" && (reject === "json_schema" || reject === "both")) || (type === "json_object" && reject === "both")) {
      return send(res, 400, { error: { message: `response_format ${type} is not supported by this model` } });
    }
    const hasImage = JSON.stringify(body.messages ?? []).includes('"image_url"');
    if (hasImage && body.model && body.model === process.env.FAKE_AI_NO_VISION) {
      return send(res, 400, { error: { message: "This model does not support image input" } });
    }
    const name = schemaNameFrom(body);
    let content: string;
    if (process.env.FAKE_AI_BROKEN === "1") content = '{"rusak": ';
    else content = await readFile(join(fixturesDir, `${name}.json`), "utf8").catch(() => '{"ok": true}');
    return send(res, 200, {
      id: "fake",
      object: "chat.completion",
      model: body.model,
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });
  }
  send(res, 404, { error: { message: "not found" } });
});

server.listen(port, () => console.log(`fake AI server di http://localhost:${port}/v1`));
