const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const middleware=fs.readFileSync(path.resolve(__dirname,"../middleware.ts"),"utf8");
const onboarding=fs.readFileSync(path.resolve(__dirname,"../app/scholar/onboarding/page.tsx"),"utf8");
const login=fs.readFileSync(path.resolve(__dirname,"../app/login/page.tsx"),"utf8");
const signup=fs.readFileSync(path.resolve(__dirname,"../app/cadastro/page.tsx"),"utf8");
assert.match(middleware,/scholar_product_access_state/);
assert.match(middleware,/target\.pathname = accessError \? "\/licenca" : "\/contratacao"/);
assert.match(middleware,/paidWorkspaceRoutes/);
assert.doesNotMatch(middleware,/paidWorkspaceRoutes\s*=\s*\[[^\]]*"\/contratacao"/);
assert.doesNotMatch(middleware,/paidWorkspaceRoutes\s*=\s*\[[^\]]*"\/orientacao"/);
assert.match(middleware,/paidWorkspaceRoutes\s*=\s*\[[^\]]*"\/scholar\/onboarding"/);
assert.match(onboarding,/supabase\.rpc\("scholar_product_access_state"\)/);
assert.match(onboarding,/allowed \? "\/dashboard\?onboarding=concluido" : "\/contratacao"/);
console.log("PASS: email confirmation cannot bypass license gate; contract and advisor access remain reachable; onboarding requires a license.");

assert.match(login,/supabase\.rpc\("scholar_product_access_state"\)/);
assert.match(login,/router\.push\(accessError \? "\/licenca" : "\/contratacao"\)/);
assert.match(signup,/router\.push\("\/contratacao"\)/);
assert.doesNotMatch(signup,/router\.push\(persona === "professor"/);
console.log("PASS: login and signup direct unpaid users to checkout before diagnosis.");

const privateApiPaths = ["/api/literature", "/api/results", "/api/project-plan", "/api/ai/ideas", "/api/ai/refine-idea", "/api/ai/assist", "/api/ai/guide"];
for (const endpoint of privateApiPaths) {
  assert.ok(middleware.includes('"' + endpoint + '"'), endpoint + " must be license protected");
  assert.ok(middleware.includes('"' + endpoint + '/:path*"') || middleware.includes('"' + endpoint.replace("/api/", "/api/") + '/:path*"'), endpoint + " must be matched");
}
assert.match(middleware, /paidWorkspace \|\| paidApi/);
assert.match(middleware, /LICENSE_REQUIRED/);
assert.match(middleware, /LICENSE_CHECK_UNAVAILABLE/);
assert.match(login, /isAdvisorOnly\(supabase, user\.id\)/);
assert.ok(login.indexOf("if (await isAdvisorOnly") < login.indexOf('rpc("scholar_product_access_state")'),
  "Advisor-only accounts must enter the free advisor portal before paid license checks.");
const demo = fs.readFileSync(path.resolve(__dirname, "../app/radar-demo/page.tsx"), "utf8");
assert.match(demo, /fetch\("\/api\/radar-demo"/);
assert.doesNotMatch(middleware, /"\/api\/radar-demo"/);
console.log("PASS: private scientific APIs are paywalled; public Radar demo and advisor portal retained.");
