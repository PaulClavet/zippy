import { NextResponse } from "next/server";
import { readSession } from "@/lib/esi/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ character: null });
  return NextResponse.json({
    character: {
      id: session.characterId,
      name: session.characterName ?? `Character ${session.characterId}`,
    },
  });
}
