const fs=require("node:fs"),assert=require("node:assert/strict");
const nav=fs.readFileSync("components/session-navigation.tsx","utf8");
const workspace=fs.readFileSync("app/concept-workspace.css","utf8");
const checkout=fs.readFileSync("app/contratacao/page.tsx","utf8");
const css=fs.readFileSync("app/public-concepts.css","utf8");
const internalRoutes=[
 "dashboard","ideias","descobrir","biblioteca","meu-trabalho","orientacao",
 "conta","licenca","contratacao","residencia","operacao","documentos",
 "resultados","manuscrito","scholar/onboarding"
];
for(const route of internalRoutes){
 assert(nav.includes('"/'+route+'"'),"Unclassified authenticated workspace route: "+route);
 const page=fs.readFileSync("app/"+route+"/page.tsx","utf8");
 assert(page.includes("scholar-workspace"),"Page lacks workspace wrapper: "+route);
}
assert(nav.includes("session.authenticated || !isCheckout"),"Anonymous visitors must retain access to public payment layout");
assert(nav.includes('isCheckout ? ([["/contratacao", "Assinatura"]]'),"Authenticated checkout must have a clear active navigation item");
assert(checkout.includes('className="checkout-page-header"'));
assert(checkout.includes('className="purchase-layout"'));
assert(checkout.includes('onClick={createRequest}'),"Do not change payment behavior");
assert(css.includes("Design QA 2026-11-19"));
assert(css.includes('body:has(.primary-nav[data-workspace="true"]) .checkout-workspace .purchase-main'));
assert(css.includes("background: #fffdfa !important"),"Maintain contrast between workspace and checkout cards");
assert(css.includes("min-height: 44px"),"Form controls should have accessible target sizes");
assert(css.includes("@media (max-width: 1050px)"),"Two-column form must collapse in narrower workspace");
assert(workspace.includes("--workspace-card-radius"));
console.log("PASS: authenticated checkout uses workspace layout, anonymous payment layout preserved, mobile form and checkout contracts intact.");
