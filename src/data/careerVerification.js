import audit from "./careerVerification.json" with { type: "json" };

export function careerFingerprint(stops) {
  if (!Array.isArray(stops)) return "";
  return stops.map((stop) => `${stop?.team}:${stop?.start}-${stop?.end}`).join("|");
}

const verified = new Map(Object.entries(audit.verified || {}).map(([id, print]) => [Number(id), print]));
const excluded = new Map((audit.excluded || []).map((item) => [item.id, item.reasons]));

export function careerVerified(id, stops) {
  const print = verified.get(id);
  return typeof print === "string" && print.length > 0 && print === careerFingerprint(stops);
}

export function careerExclusionReasons(id, stops) {
  if (careerVerified(id, stops)) return [];
  if (excluded.has(id)) return excluded.get(id);
  if (verified.has(id)) return ["Career history changed after it was verified."];
  return ["Career history has not been verified."];
}

export const careerVerificationSource = {
  source: typeof audit.source === "string" ? audit.source : "",
  retrieved: typeof audit.retrieved === "string" ? audit.retrieved : "",
  rule: typeof audit.rule === "string" ? audit.rule : "",
};
