import type { Json } from "./database.types";

// Every RPC response is untrusted at the type level (jsonb), even though it
// comes from a security-definer function we control. These guards turn a
// malformed/unexpected shape into a thrown error at the data-layer boundary
// instead of a crash or silent bad value deeper in the UI.
export type JsonRecord = { [key: string]: Json | undefined };

export function readRecord(value: Json | undefined, context: string): JsonRecord {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${context} is invalid.`);
  }

  return value;
}

export function readArray(value: Json | undefined, context: string): Json[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} is invalid.`);
  }

  return value;
}

export function readString(value: Json | undefined, context: string): string {
  if (typeof value !== "string") {
    throw new Error(`${context} is invalid.`);
  }

  return value;
}

export function readNullableString(value: Json | undefined, context: string): string | null {
  if (value === null || value === undefined) return null;
  return readString(value, context);
}

export function readNumber(value: Json | undefined, context: string): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) {
    throw new Error(`${context} is invalid.`);
  }

  return parsed;
}

export function readNullableNumber(value: Json | undefined, context: string): number | null {
  if (value === null || value === undefined) return null;
  return readNumber(value, context);
}

export function readBoolean(value: Json | undefined, context: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${context} is invalid.`);
  }

  return value;
}
