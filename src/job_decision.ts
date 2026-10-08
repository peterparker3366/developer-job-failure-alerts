import { z } from "zod";

export const jobFailure = z.object({
  eventId: z.string().uuid(),
  job: z.string().min(1),
  operation: z.enum(["build", "release"]),
  message: z.string().min(1),
  occurredAt: z.string().datetime(),
}).strict();

export type JobFailure = z.infer<typeof jobFailure>;

export function diagnostic(failure: JobFailure) {
  const level = failure.operation === "release" ? "fatal" : "error";
  return {
    title: `${failure.operation} job failed: ${failure.job}`,
    message: failure.message,
    level,
    fingerprint: [failure.operation, failure.job],
    exception: `${failure.operation} job failure: ${failure.message}`,
    context: { eventId: failure.eventId, occurredAt: failure.occurredAt, operation: failure.operation, job: failure.job },
  };
}
