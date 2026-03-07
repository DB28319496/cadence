import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  // Use HTTPS (HTTP/1.1) instead of WebSocket for Turso in production.
  // Serverless functions should not hold persistent WebSocket connections.
  const rawUrl = process.env.DATABASE_URL!;
  const url =
    process.env.NODE_ENV === "production"
      ? rawUrl.replace(/^libsql:\/\//, "https://")
      : rawUrl;

  const adapter = new PrismaLibSql({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
