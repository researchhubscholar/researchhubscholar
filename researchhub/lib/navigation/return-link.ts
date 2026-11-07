const publicRoutes = new Set([
  "/", "/como-funciona", "/para-residencias", "/contato", "/planos",
  "/termos", "/privacidade", "/cancelamento", "/radar-demo",
  "/login", "/cadastro", "/esqueci-senha", "/redefinir-senha",
]);

export function returnNavigation(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || path === "/dashboard") return null;
  return publicRoutes.has(path)
    ? { href: "/", label: "Voltar ao início" }
    : { href: "/dashboard", label: "Voltar ao meu espaço" };
}
