import { archiveFinance, type FinanceArchiveEnv } from "../lib/finance-archive";

const worker = {
  fetch() { return new Response("Not found", { status: 404 }); },
  scheduled(_event: ScheduledController, env: FinanceArchiveEnv, context: ExecutionContext) {
    context.waitUntil(archiveFinance(env));
  },
};
export default worker;
