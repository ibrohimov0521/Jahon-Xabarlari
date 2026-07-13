import { Queue, Worker } from "bullmq";
import { createBullConnection, withRedisLock } from "./redis.js";
import { runAggregatorCycle, type AggregatorRunResult } from "./aggregator.js";

type AggregatorJob = { maxPerCycle?: number };
type AggregatorJobName = "manual";

const aggregatorQueue = new Queue<AggregatorJob, AggregatorRunResult, AggregatorJobName>("news-aggregator", {
  connection: createBullConnection()
});

const aggregatorWorker = new Worker<AggregatorJob, AggregatorRunResult, AggregatorJobName>(
  "news-aggregator",
  async (job) => {
    const result = await runAggregatorCycle({ force: true, maxPerCycle: job.data.maxPerCycle });
    if (result.skipped === "already_running") throw new Error("Aggregatorning boshqa sikli hali tugamagan");
    if (result.skipped === "not_configured") throw new Error("OPENAI_API_KEY sozlanmagan");
    return result;
  },
  { connection: createBullConnection(), concurrency: 1 }
);

aggregatorWorker.on("failed", (job, error) => console.error(`[aggregator] job ${job?.id ?? "unknown"} failed:`, error));
aggregatorWorker.on("error", (error) => console.error("[aggregator] worker Redis xatosi:", error));
aggregatorQueue.on("error", (error) => console.error("[aggregator] queue Redis xatosi:", error));

export async function queueAggregatorRun(maxPerCycle?: number) {
  return withRedisLock("lock:queue-news-aggregator", 5_000, async () => {
    const counts = await aggregatorQueue.getJobCounts("active", "waiting", "delayed");
    if (counts.active + counts.waiting + counts.delayed > 0) return null;
    return aggregatorQueue.add(
      "manual",
      { maxPerCycle },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: { age: 60 * 60, count: 100 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 100 }
      }
    );
  });
}

export async function getAggregatorJobCounts() {
  return aggregatorQueue.getJobCounts("active", "waiting", "delayed", "failed");
}

export async function closeAggregatorJobs() {
  await Promise.all([aggregatorWorker.close(), aggregatorQueue.close()]);
}
