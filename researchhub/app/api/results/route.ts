import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { saveError } from "@/lib/projects/save-errors";
import { validWorkspace } from "@/lib/results/data";
export async function GET(request: NextRequest) {
  const db = await supabaseServer(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const project = request.nextUrl.searchParams.get("project");
  const { data, error } = await db.from("scholar_project_results").select("*").eq("project_id", project).eq("owner_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Resultados indisponíveis. Confira a instalação do módulo." }, { status: 503 });
  return NextResponse.json({ workspace: data?.workspace || null, updatedAt: data?.updated_at || null, revision: data?.revision ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
export async function PUT(request: NextRequest) {
  const db = await supabaseServer(); const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const raw = await request.text(); if (new TextEncoder().encode(raw).byteLength > 1500000) return NextResponse.json({ error: "Limite de 1,5 MB por projeto." }, { status: 413 });
  let body; try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  if (!body || typeof body !== "object" || typeof body.project !== "string" || !validWorkspace(body.workspace) || !(body.expectedRevision === null || Number.isInteger(body.expectedRevision) && body.expectedRevision > 0)) return NextResponse.json({ error: "Confira os dados e a figura." }, { status: 400 });
  const { data: project } = await db.from("research_projects").select("id").eq("id", body.project).eq("owner_id", user.id).maybeSingle();
  if (!project) return NextResponse.json({ error: "Projeto indisponível." }, { status: 404 });
  const { data, error } = await db.rpc("scholar_save_results", { p_project: project.id, p_expected: body.expectedRevision, p_workspace: body.workspace });
  if (error) return NextResponse.json({ error: saveError(error).message }, { status: error.message?.includes("SCHOLAR_SAVE_CONFLICT") ? 409 : 503 });
  return NextResponse.json({ ok: true, revision: data.revision });
}
