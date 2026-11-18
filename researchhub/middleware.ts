import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const legacyPrefixes = [
    "/admin",
    "/buscar",
    "/configuracao",
    "/conta-suspensa",
    "/coordenador",
    "/departamentos",
    "/laboratorios",
    "/linhas",
    "/onboarding",
    "/professores",
    "/projetos",
    "/publicacoes",
    "/universidade",
    "/api/notify-interest",
  ];

  if (legacyPrefixes.some((path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.search = "";
    return NextResponse.redirect(target, 308);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Se o ambiente ainda não estiver configurado, não derruba o site inteiro.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // O Scholar só precisa renovar a sessão. Não consulta tabelas do
  // ResearchHub institucional, pois usa um banco Supabase independente.
  const { data: { user } } = await supabase.auth.getUser();
  const paidApiRoutes = [
    "/api/literature", "/api/results", "/api/project-plan",
    "/api/ai/ideas", "/api/ai/refine-idea", "/api/ai/assist", "/api/ai/guide",
  ];
  const paidApi = paidApiRoutes.some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/")
  );
  if (!user && paidApi) {
    const denied = NextResponse.json({ error: "Entre na sua conta para usar as ferramentas." }, { status: 401 });
    response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
    return denied;
  }
  if (!user && request.nextUrl.pathname.startsWith("/api/literature/")) {
    const denied = NextResponse.json({error:"Entre na sua conta para usar as ferramentas. Experimente o Radar público sem cadastro."},{status:401});
    response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
    return denied;
  }
  const privateRoutes = [
    "/dashboard",
    "/descobrir",
    "/ideias",
    "/biblioteca",
    "/meu-trabalho",
    "/licenca",
    "/contratacao",
    "/residencia",
    "/orientacao",
    "/documentos",
    "/resultados",
    "/manuscrito",
    "/geracoes",
    "/conta",
    "/operacao",
    "/scholar/onboarding",
  ];
  if(!user && privateRoutes.some(path=>request.nextUrl.pathname===path||request.nextUrl.pathname.startsWith(path+"/"))) {
    const target=request.nextUrl.clone();target.pathname=request.nextUrl.pathname==="/descobrir"?"/radar-demo":"/login";target.search="";
    const redirected=NextResponse.redirect(target);response.cookies.getAll().forEach(cookie=>redirected.cookies.set(cookie));return redirected;
  }

  // Authentication does not itself grant a purchased ResearchHub license.
  // Public enrollment and license/contract screens remain accessible; onboarding requires a valid license.
  const paidWorkspaceRoutes = [
    "/dashboard", "/ideias", "/descobrir", "/biblioteca", "/meu-trabalho",
    "/documentos", "/resultados", "/manuscrito", "/geracoes",
    "/scholar/onboarding",
  ];
  const paidWorkspace = paidWorkspaceRoutes.some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/")
  );
  if (user && (paidWorkspace || paidApi)) {
    const { data: access, error: accessError } = await supabase.rpc("scholar_product_access_state");
    const allowed = !accessError && access && typeof access === "object" &&
      !Array.isArray(access) && access.allowed === true;
    if (!allowed) {
      if (paidApi) {
        const denied = NextResponse.json(
          { error: accessError ? "Não foi possível verificar sua licença." : "É necessária uma licença ativa para acessar esta ferramenta.", code: accessError ? "LICENSE_CHECK_UNAVAILABLE" : "LICENSE_REQUIRED" },
          { status: accessError ? 503 : 403, headers: { "Cache-Control": "no-store" } }
        );
        response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
        return denied;
      }
      const target = request.nextUrl.clone();
      // A database outage should not be mistaken for an unpaid account.
      target.pathname = accessError ? "/licenca" : "/contratacao";
      target.search = "";
      const redirected = NextResponse.redirect(target);
      response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
      return redirected;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/descobrir/:path*",
    "/ideias/:path*",
    "/biblioteca/:path*",
    "/meu-trabalho/:path*",
    "/licenca/:path*",
    "/contratacao/:path*",
    "/residencia/:path*",
    "/orientacao/:path*",
    "/documentos/:path*",
    "/resultados/:path*",
    "/manuscrito/:path*",
    "/geracoes/:path*",
    "/conta/:path*",
    "/operacao/:path*",
    "/api/account/:path*",
    "/scholar/onboarding/:path*",
    "/api/literature/:path*",
    "/api/ai/ideas/:path*",
    "/api/ai/refine-idea/:path*",
    "/api/ai/assist/:path*",
    "/api/ai/guide/:path*",
    "/api/results/:path*",
    "/api/project-plan/:path*",
    "/admin/:path*",
    "/buscar/:path*",
    "/configuracao/:path*",
    "/conta-suspensa/:path*",
    "/coordenador/:path*",
    "/departamentos/:path*",
    "/laboratorios/:path*",
    "/linhas/:path*",
    "/onboarding/:path*",
    "/professores/:path*",
    "/projetos/:path*",
    "/publicacoes/:path*",
    "/universidade/:path*",
    "/api/notify-interest",
  ],
};
