export type DeviceReading = { device: string; rms: number; door_open: boolean };

export function validateReading(body: unknown): string | null {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return "request body must be a JSON object";
  const value = body as Record<string, unknown>;
  if (typeof value.device !== "string") return "device must be a string";
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(value.device)) return "device must contain 1–80 letters, digits, underscores, or hyphens";
  if (typeof value.rms !== "number") return "rms must be a number";
  if (!Number.isFinite(value.rms)) return "rms must be finite";
  if (value.rms < 0) return "rms must be greater than or equal to 0";
  if (typeof value.door_open !== "boolean") return "door_open must be a boolean";
  return null;
}
