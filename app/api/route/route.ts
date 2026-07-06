import { type NextRequest, NextResponse } from "next/server";
import { planRoute, type PlanRequest } from "@/lib/eve/planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: PlanRequest;
  try {
    body = (await req.json()) as PlanRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.from == null || body.to == null) {
    return NextResponse.json({ ok: false, error: "from and to are required" }, { status: 400 });
  }

  const result = planRoute(body);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.code === "no-route" ? 404 : 400 });
  }
  return NextResponse.json(result);
}
