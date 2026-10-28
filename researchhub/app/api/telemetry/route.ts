import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

import { telemetryRoute } from "@/lib/telemetry/routes";

type TelemetryPayload = {
  kind?: "event" | "error";
  eventName?: "page_view" | "action";
  module?: string;
  route?: string;
  errorCode?: string;
  message?: string;
};

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 2000) {
      return NextResponse.json({ error: "Evento muito grande." }, { status: 413 });
    }

    const body = (await request.json()) as TelemetryPayload;
    if (typeof body.route !== "string" || body.route.length > 160 || !body.route.startsWith("/")) {
      return NextResponse.json({ error: "Evento inválido." }, { status: 400 });
    }
    const { module: moduleName, route } = telemetryRoute(body.route);

    const db = await supabaseServer();
    const { data: auth } = await db.auth.getUser();
    if (!auth.user) return new NextResponse(null, { status: 204 });

    if (body.kind === "error") {
      const { error } = await db.rpc("scholar_record_error_event", {
        p_module: moduleName,
        p_route: route,
        p_error_code: "CLIENT_ERROR",
        p_message: "Falha na interface. Tente novamente.",
      });
      if (error) throw error;
    } else {
      const { error } = await db.rpc("scholar_record_product_event", {
        p_event_name: body.eventName === "action" ? "action" : "page_view",
        p_module: moduleName,
        p_route: route,
      });
      if (error) throw error;
    }

    console.log(JSON.stringify({
      level: "info",
      event: "telemetry_recorded",
      kind: body.kind === "error" ? "error" : "event",
      module: moduleName,
      durationMs: Date.now() - startedAt,
    }));
    return NextResponse.json({ ok: true });
  } catch {
    console.error(JSON.stringify({
      level: "error",
      event: "telemetry_failed",
      error: "record_failed",
      durationMs: Date.now() - startedAt,
    }));
    return NextResponse.json({ error: "Não foi possível registrar o evento." }, { status: 400 });
  }
}
