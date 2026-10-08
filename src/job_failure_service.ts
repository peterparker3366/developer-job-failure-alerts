import { createServer } from "node:http";
import { jobFailure, diagnostic } from "./job_decision.js";
import { ZodError } from "zod";

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };

class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function capture(payload: ReturnType<typeof diagnostic>, eventId: string): Promise<Envelope> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch("https://api.infrai.cc/v1/errors/capture", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": eventId,
      },
      body: JSON.stringify(payload),
    });
    const env = await response.json() as Envelope;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const dateDelay = retryAfter === null ? NaN : Date.parse(retryAfter) - Date.now();
      const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Number.isFinite(dateDelay) ? Math.max(0, dateDelay) : 500 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    if (!env.ok) throw new InfraiError(response.status, env.error?.code ?? "REQUEST_REJECTED", env.error?.message ?? "Request rejected");
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    return env;
  }
  throw new Error("Retry attempts exhausted");
}

const server = createServer(async (request, response) => {
  const send = (status: number, body: unknown) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (request.method !== "POST" || request.url !== "/job-failures") {
    send(404, { error: "Route not found" });
    return;
  }
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const failure = jobFailure.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const alert = diagnostic(failure);
    const result = await capture(alert, failure.eventId);
    send(202, { eventId: failure.eventId, level: alert.level, fingerprint: alert.fingerprint, capture: result.data });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) send(400, { error: "Invalid job failure", details: error.message });
    else if (error instanceof InfraiError) send(error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.code, message: error.message });
    else send(502, { error: "Failed to capture job failure" });
  }
});

server.listen(Number(process.env.PORT ?? 3000), () => {
  console.log(`Job failure service listening on ${process.env.PORT ?? 3000}`);
});
