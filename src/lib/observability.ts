/**
 * Optional Sentry tracing around calls to the Python prep agent. Fully no-op without SENTRY_DSN:
 * the callback runs directly and @sentry/nextjs is never loaded.
 *
 * With a DSN (initialised in src/instrumentation.ts) each call becomes a span
 * `prep-agent <task>`; Sentry's fetch instrumentation adds the `sentry-trace`/`baggage` headers,
 * so the agent's own spans (invoke_agent → chat gemma… / execute_tool forecast_demand → tabpfn.fit …)
 * join the same trace.
 */
export async function withAgentSpan<T>(task: string, fn: () => Promise<T>, dsn: string | undefined = process.env.SENTRY_DSN): Promise<T> {
  if (!dsn) return fn();
  const Sentry = await import("@sentry/nextjs");
  if (!Sentry.isInitialized()) return fn();
  return Sentry.startSpan(
    { name: `prep-agent ${task}`, op: "http.client.agent", attributes: { "menupage.agent.task": task, "gen_ai.agent.name": "prep-planner" } },
    fn,
  );
}
