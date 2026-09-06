/** True when an error (or its cause) is a Postgres unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; e && depth < 4; depth++) {
    if (typeof e === "object" && (e as { code?: string }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
