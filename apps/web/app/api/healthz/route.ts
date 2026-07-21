import { NextResponse } from "next/server";
import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "@guestflow/db";

export const dynamic = "force-dynamic";

const BUILD_MARKER = "v4-fresh-path";

/** Diagnostic health check — reports DB connectivity without leaking secrets. */
export async function GET() {
  const rawUrl = process.env.DATABASE_URL ?? "";
  let host = "(unset)";
  if (rawUrl) {
    try {
      host = new URL(rawUrl).hostname;
    } catch {
      host = "(unparseable)";
    }
  }

  // What did the deployment actually ship for the generated Prisma client?
  let clientDir = "(unresolved)";
  let clientFiles: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const resolved = require.resolve(".prisma/client/index.js", {
      paths: [require.resolve("@prisma/client")].map((p) => dirname(p)),
    });
    clientDir = dirname(resolved);
    clientFiles = readdirSync(clientDir).filter(
      (f) => f.endsWith(".wasm") || f.endsWith(".node") || f === "index.js" || f === "client.js",
    );
  } catch (e) {
    clientDir = `(resolve failed: ${(e as Error).message.slice(0, 120)})`;
  }

  try {
    const orgs = await prisma.org.count();
    return NextResponse.json({
      ok: true,
      build: BUILD_MARKER,
      db: "connected",
      orgs,
      host,
      clientDir,
      clientFiles,
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    return NextResponse.json(
      {
        ok: false,
        build: BUILD_MARKER,
        db: "error",
        name: e.name,
        code: e.code ?? null,
        message: (e.message ?? "").replace(rawUrl, "<db-url>").slice(0, 400),
        host,
        clientDir,
        clientFiles,
      },
      { status: 200 },
    );
  }
}
