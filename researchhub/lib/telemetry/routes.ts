// Never retain query strings, IDs, or arbitrary route segments in telemetry.
const routes = [
  ["/dashboard", "dashboard"], ["/descobrir", "radar"], ["/ideias", "ideas"],
  ["/biblioteca", "library"], ["/meu-trabalho", "project"], ["/resultados", "project"],
  ["/manuscrito", "project"], ["/orientacao", "advising"], ["/documentos", "documents"],
  ["/licenca", "license"], ["/contratacao", "license"], ["/residencia", "residency"],
  ["/conta", "account"], ["/operacao", "operation"],
] as const;
export function telemetryRoute(path: string): { route: string; module: string } {
  const match = routes.find(([prefix]) => path === prefix || path.startsWith(prefix + "/"));
  return match ? { route: match[0], module: match[1] } : { route: "/", module: "other" };
}
