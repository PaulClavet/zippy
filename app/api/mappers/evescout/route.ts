import { NextResponse } from "next/server";
import { fetchEveScout } from "@/lib/mappers/evescout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await fetchEveScout();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "eve-scout-failed", message: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
