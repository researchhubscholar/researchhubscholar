import { NextResponse } from "next/server";
import { scholarAI } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ enabled: scholarAI.enabled, model: scholarAI.enabled ? scholarAI.model : null });
}
