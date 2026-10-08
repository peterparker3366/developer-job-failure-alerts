import { randomUUID } from "node:crypto";

const response = await fetch(`http://localhost:${process.env.PORT ?? 3000}/job-failures`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    eventId: randomUUID(),
    job: "publish-cli",
    operation: "release",
    message: "Artifact signing failed",
    occurredAt: new Date().toISOString(),
  }),
});
console.log(JSON.stringify(await response.json(), null, 2));
if (!response.ok) process.exitCode = 1;
