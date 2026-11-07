import { NextResponse } from "next/server";
import { scholarAI, scholarAIReady } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ enabled: scholarAIReady, model: scholarAIReady ? scholarAI.model : null });
}
