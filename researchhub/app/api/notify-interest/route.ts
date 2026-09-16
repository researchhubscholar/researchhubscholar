import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const appUser = await getCurrentAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { projectId } = await request.json();
  if (!projectId) {
    return NextResponse.json({ error: "projectId é obrigatório" }, { status: 400 });
  }

  const supabase = await supabaseServer();

  // Confirma que essa pessoa realmente manifestou interesse nesse
  // projeto antes de disparar o e-mail — evita que a rota seja usada
  // para mandar e-mail arbitrário para qualquer professor.
  const { data: membership } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", appUser.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "Interesse não encontrado" }, { status: 403 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("title, professors!projects_lead_professor_id_fkey(name, email)")
    .eq("id", projectId)
    .single();

  const professor = (project as any)?.professors;

  if (!project || !professor?.email) {
    // Não é erro do usuário — só não tem para onde mandar o e-mail.
    // O interesse já foi registrado no banco de qualquer forma.
    return NextResponse.json({ sent: false, reason: "Professor sem e-mail cadastrado" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ sent: false, reason: "E-mail não configurado" });
  }

  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";

  try {
    await resend.emails.send({
      from: `ResearchHub <${fromEmail}>`,
      to: professor.email,
      subject: `Novo interesse no projeto "${project.title}"`,
      html: `
        <p>Olá, ${professor.name}!</p>
        <p><strong>${appUser.name}</strong> manifestou interesse no seu projeto
        <strong>"${project.title}"</strong>.</p>
        <p><a href="${siteUrl}/dashboard">Ver no painel</a></p>
        <p style="color:#888;font-size:12px;margin-top:24px;">ResearchHub — organiza relações, não documentos.</p>
      `,
    });

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("Falha ao enviar e-mail de notificação:", err);
    // O interesse já está salvo no banco independente do e-mail falhar —
    // não queremos que uma falha de envio pareça uma falha da ação principal.
    return NextResponse.json({ sent: false, reason: "Falha no envio" });
  }
}
