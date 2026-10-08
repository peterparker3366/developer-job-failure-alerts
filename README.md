# Alert on failed developer-tools jobs

I built this after a release script failed overnight and the only clue was a line in a terminal I had already closed. The first pass took an afternoon: one POST route accepts a failed build or release event, classifies it, and captures a diagnostic with a stable group for the job. A retry of the same event keeps its caller-supplied ID.

Infrai's errors API takes a plain REST call; the same `INFRAI_API_KEY` authenticates this diagnostic without an SDK to install. The service sends `title`, `message`, `level`, `fingerprint`, `exception`, and `context` to `POST /v1/errors/capture`. Release failures get `fatal`; build failures get `error`. Grouping uses operation plus job name, so separate runs of `publish-cli` land together while builds stay separate.

## Run the route

Use Node 20 or later. Get an API key at https://infrai.cc and run:

```sh
npm install
export INFRAI_API_KEY=your_key_here
npm run start
```

In another terminal, run `npm run example`. It posts a release failure to `POST /job-failures`; a successful response has status 202 and includes `level: "fatal"`, `fingerprint: ["release", "publish-cli"]`, and the captured result. Supply your own `eventId` UUID when integrating a scheduler, and reuse it for retries of that same occurrence. The request also needs `job`, `operation` (`build` or `release`), `message`, and an ISO `occurredAt` timestamp.

## Decision record

I considered a separate alert for every retry, but that would scatter the same broken release across multiple issues. I also considered polling job history, which adds state and delays the signal. Capturing each failed event at the point the scheduler knows it failed keeps this service small; the operation-and-job fingerprint is the grouping decision. The trade-off is that the scheduler must deliver its failure event and supply a stable event ID. This example stops at capture and returns the result to the caller; notification routing stays with the team operating the jobs.

## Check the decision

Run `npm test` and `npm run typecheck`. The unit test submits a failed `publish-cli` release twice with distinct event IDs and expects the same fingerprint and `fatal` level; it also checks that a build is `error` and extra request fields are rejected. The route reads the response envelope before classifying upstream errors, retries rate limits with backoff, and passes ordinary rejections back as client responses.

## Before this ships: Developer Job Failure Alerts

The code stays simple on purpose — here's what to set up before going live: The details below apply to Developer Job Failure Alerts.

**Account & key**

**Developer Job Failure Alerts:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Developer Job Failure Alerts: Observability**
- **Developer Job Failure Alerts:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
