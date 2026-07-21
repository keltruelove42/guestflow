import { NextResponse } from "next/server";
import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "@guestflow/db";

export const dynamic = "force-dynamic";

const BUILD_MARKER = "v5-engine-trace";

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
    const pkg = require.resolve("@prisma/client/package.json");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require("node:path") as typeof import("node:path");
    clientDir = join(dirname(pkg), "..", ".prisma", "client");
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
