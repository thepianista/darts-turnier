import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: false,
  max: 10,
  idle_timeout: 20,
});

export default sql;

// Helper to safely parse JSONB darts that may come back as string
export function parseDarts<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return [];
    }
  }
  return [];
}
