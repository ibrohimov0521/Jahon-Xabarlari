import { runAggregatorCycle } from "../src/services/aggregator.js";

const limit = Number(process.env.BACKFILL_LIMIT ?? 300);

runAggregatorCycle({ force: true, maxPerCycle: limit })
  .then((result) => {
    console.log(`[backfill] done: ${result.published} ta maqola nashr qilindi`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("[backfill] failed:", error);
    process.exit(1);
  });
