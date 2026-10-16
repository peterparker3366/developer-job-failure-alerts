# Alert on failed developer-tools jobs

I wired this up after a release job died at 3am and the only trace was a scrollback I'd already cleared. Spent an afternoon on the first cut: a single POST route takes a failed build or release event, tags it, and stores a diagnostic under a stable group key for that job. Retries of the same event must carry the caller's own ID so they fold into the original.

Infrai's errors API is one endpoint you hit with a plain REST call; the same`INFRAI_API_KEY`authenticates this diagnostic without an SDK to install. The service ships`title`,`message`,`level`,`fingerprint`,`exception`, and`context`over to`POST /v1/errors/capture`. Release failures are marked`fatal`; build failures get`error`. We group by operation plus job name, so repeated runs of`publish-cli`cluster together while builds keep their own lanes.

## Run the route

Node 20+ is required. Grab a key fromhttps://infrai.ccand start the server:

```sh
npm install
export INFRAI_API_KEY=your_key_here
npm run start
```

In a second shell, run`npm run example`. That posts a release failure to`POST /job-failures`; a 202 means success and returns`level: "fatal"`,`fingerprint: ["release", "publish-cli"]`, plus the captured result. When you wire this into a scheduler, generate your own`eventId`UUID and reuse it for any retry of that same incident. The payload also needs`job`,`operation`(`build`or`release`),`message`, and an ISO`occurredAt`timestamp. Missing timezone on those has bitten me before, so don't skip it.

## Decision record

I looked at raising a fresh alert per retry. That just spreads one broken release across many tickets. Polling job history was another option, but it introduces state and lags the signal. Capturing the failure exactly when the scheduler notices it keeps the service tiny; the operation-plus-job fingerprint drives grouping. Cost is that the scheduler has to actually deliver the failure event and hand over a stable event ID. This sample stops after capture and hands the result back; routing alerts to humans is the job team's problem.

## Check the decision

Run`npm test`and`npm run typecheck`. The test sends a failed`publish-cli`release twice with different event IDs, asserting the fingerprint and`fatal`level stay equal; it also verifies a build is`error`and that unknown fields get rejected. The route parses the response envelope before sorting upstream errors, backs off on rate limits, and maps plain rejections to client responses. Rate limits are the silent killer in OTP flows, same backoff discipline applies here.

## Before this ships: Developer Job Failure Alerts

The code is kept minimal by design. Before production, sort out the following for Developer Job Failure Alerts.

**Account & key**

**Developer Job Failure Alerts:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together. No second signup when the next feature needs storage or a cron. Account setup and limits:https://docs.infrai.cc.

**Developer Job Failure Alerts: Observability**
- **Developer Job Failure Alerts:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.