import { test } from "node:test";
import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { diagnostic, jobFailure } from "../src/job_decision.js";

test("release failures are urgent and recurring failures share a group", () => {
  const input = { eventId: "67e55044-10b1-426f-9247-bb680e5fe0c8", job: "publish-cli", operation: "release" as const, message: "Artifact signing failed", occurredAt: "2026-09-19T10:00:00.000Z" };
  const first = diagnostic(jobFailure.parse(input));
  const repeat = diagnostic(jobFailure.parse({ ...input, eventId: "67e55044-10b1-426f-9247-bb680e5fe0c9" }));
  strictEqual(first.level, "fatal");
  deepStrictEqual(first.fingerprint, ["release", "publish-cli"]);
  deepStrictEqual(first.fingerprint, repeat.fingerprint);
  strictEqual(diagnostic(jobFailure.parse({ ...input, operation: "build" })).level, "error");
  throws(() => jobFailure.parse({ ...input, unexpected: true }));
});
