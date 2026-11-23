import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasWorkspaceLicense, type WorkspaceLicense, type WorkspaceMembership } from "./lib/access/workspace-license";

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
  if (!url || !key) {
    // An unconfigured environment must never expose paid pages.
    const protectedPaths = ["/dashboard", "/ideias", "/descobrir", "/biblioteca", "/meu-trabalho", "/orientacao", "/documentos", "/resultados", "/manuscrito", "/geracoes", "/scholar/onboarding"];
    if (protectedPaths.some(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/"))) {
      return NextResponse.json({ error: "Serviço temporariamente indisponível." }, { status: 503 });
    }
    return response;
  }

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
    const target=request.nextUrl.clone();target.pathname="/login";target.search="";
    const redirected=NextResponse.redirect(target);response.cookies.getAll().forEach(cookie=>redirected.cookies.set(cookie));return redirected;
  }

  // Authentication does not itself grant a purchased ResearchHub license.
  // Public enrollment and license/contract screens remain accessible; onboarding requires a valid license.
  const paidWorkspaceRoutes = [
    "/dashboard", "/ideias", "/descobrir", "/biblioteca", "/meu-trabalho",
    "/documentos", "/resultados", "/manuscrito", "/geracoes", "/orientacao",
    "/scholar/onboarding",
  ];
  if (user && paidWorkspaceRoutes.some(path =>
    request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(path + "/")
  )) {
    const { data: access, error: accessError } = await supabase.rpc("scholar_product_access_state");
    // The legacy RPC can return allowed=true with reason="beta_access"
    // when the commercial flag is off. This alone is NOT a paid entitlement.
    // Query RLS-protected licenses and active memberships for this user.
    const [licenseResult, membershipResult] = await Promise.all([
      supabase.from("scholar_licenses")
        .select("owner_id,organization_id,status,starts_at,ends_at")
        .in("status", ["active", "trial"]),
      supabase.from("scholar_memberships")
        .select("organization_id,active").eq("user_id", user.id).eq("active", true),
    ]);
    const lookupError = licenseResult.error || membershipResult.error;
    const validLicense = !lookupError && hasWorkspaceLicense(
      user.id,
      (licenseResult.data || []) as WorkspaceLicense[],
      (membershipResult.data || []) as WorkspaceMembership[],
    );
    const rpcAllowed = !accessError && access && typeof access === "object" &&
      !Array.isArray(access) && access.allowed === true;
    if (!rpcAllowed || !validLicense) {
      const target = request.nextUrl.clone();
      // Database/network failures should not silently grant workspace entry.
      target.pathname = accessError || lookupError ? "/licenca" : "/contratacao";
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
