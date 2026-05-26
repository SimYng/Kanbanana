import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

export function okJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorJson(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: err.flatten() },
      { status: 400 },
    );
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return errorJson("NOT_FOUND", 404);
    return errorJson(`DB_ERROR_${err.code}`, 400);
  }
  const status = (err as { status?: number })?.status;
  if (status === 401 || status === 403) {
    return errorJson(
      status === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
      status,
    );
  }
  console.error(err);
  return errorJson("INTERNAL_ERROR", 500);
}
