// Serverless-safety switch for the engine. On Netlify, running the whole brain
// (3 Claude calls) in one request exceeds the ~26s function timeout, so we drive
// the run ONE step per request and let the run page poll to continue. Gated by an
// explicit env flag (NETLIFY isn't reliably set at function runtime — same lesson
// as ONBOARDING_ASYNC). Unset (local/dev) = full synchronous advance.

export function isAsyncMode(): boolean {
  return process.env.SWITCHBOARD_ASYNC === "true";
}

/** Pass to advanceRun(): one auto step per call when async, unbounded otherwise. */
export function advanceOpts(): { maxSteps?: number } {
  return isAsyncMode() ? { maxSteps: 1 } : {};
}
