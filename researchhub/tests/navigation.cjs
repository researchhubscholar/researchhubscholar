const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const navigationPath = path.join(__dirname, "..", "components", "session-navigation.tsx");
const source = fs.readFileSync(navigationPath, "utf8");
const middlewarePath = path.join(__dirname, "..", "middleware.ts");
const middleware = fs.readFileSync(middlewarePath, "utf8");

const publicPages = [
  "/",
  "/cadastro",
  "/cancelamento",
  "/como-funciona",
  "/contato",
  "/esqueci-senha",
  "/login",
  "/para-residencias",
  "/planos",
  "/privacidade",
  "/radar-demo",
  "/redefinir-senha",
  "/termos",
];

const privatePages = [
  "/dashboard",
  "/conta",
  "/contratacao",
  "/descobrir",
  "/ideias",
  "/biblioteca",
  "/meu-trabalho",
  "/documentos",
  "/licenca",
  "/orientacao",
  "/operacao",
  "/residencia",
  "/residencia/projeto",
  "/scholar/onboarding",
];

for (const route of [...publicPages, ...privatePages]) {
  const relative = route === "/" ? "app/page.tsx" : `app${route}/page.tsx`;
  assert.ok(
    fs.existsSync(path.join(__dirname, "..", relative)),
    `A página ativa ${route} não pode ser removida sem atualizar o contrato do produto.`,
  );
}

for (const route of privatePages) {
  const protectedPrefix = route === "/residencia/projeto" ? "/residencia" : route;
  assert.match(
    middleware,
    new RegExp(`"${protectedPrefix.replaceAll("/", "\\/")}"`),
    `A rota privada ${route} precisa continuar protegida no middleware.`,
  );
}

const requiredPrivateLinks = [
  ["/dashboard", "Meu espaço"],
  ["/descobrir", "Radar"],
  ["/ideias", "Ideias"],
  ["/biblioteca", "Biblioteca"],
  ["/meu-trabalho", "Meu projeto"],
  ["/orientacao", "Orientação"],
  ["/conta", "Conta"],
];

for (const [href, label] of requiredPrivateLinks) {
  assert.match(source, new RegExp(`\\["${href}", "${label}"\\]`));
}

assert.match(source, /\["\/operacao", "Operação"\]/);

assert.doesNotMatch(
  source,
  /links\.slice\(/,
  "A navegação não pode truncar os módulos disponíveis.",
);

console.log("product route and navigation contract passed");
