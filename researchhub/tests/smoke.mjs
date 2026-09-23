import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const host = "127.0.0.1";
const port = 3217;
const baseUrl = `http://${host}:${port}`;

const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", host, "--port", String(port)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "placeholder-build-key",
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || baseUrl,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Servidor encerrou antes dos testes.\n${serverOutput}`);
    }
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.ok) return;
    } catch {
      // O servidor ainda está iniciando.
    }
    await delay(500);
  }
  throw new Error(`Servidor não ficou disponível.\n${serverOutput}`);
}

async function request(path, init) {
  return fetch(`${baseUrl}${path}`, { redirect: "manual", ...init });
}

async function expectPage(path, expectedText) {
  const response = await request(path);
  assert.equal(response.status, 200, `${path} deveria responder 200`);
  const html = await response.text();
  assert.match(html, expectedText, `${path} não exibiu o conteúdo esperado`);
  return response;
}

try {
  await waitForServer();

  const home = await expectPage("/", /ResearchHub/);
  assert.match(await (await request("/login")).text(), /Entrar|Acessar/);
  await expectPage("/radar-demo", /Radar/);

  assert.match(home.headers.get("content-security-policy") || "", /frame-ancestors 'none'/);
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  assert.equal(home.headers.get("x-frame-options"), "DENY");

  const privatePage = await request("/biblioteca");
  assert.ok([307, 308].includes(privatePage.status));
  assert.equal(new URL(privatePage.headers.get("location"), baseUrl).pathname, "/login");

  const privateRadar = await request("/descobrir");
  assert.ok([307, 308].includes(privateRadar.status));
  assert.equal(new URL(privateRadar.headers.get("location"), baseUrl).pathname, "/radar-demo");

  const legacyPage = await request("/projetos/novo");
  assert.equal(legacyPage.status, 308);
  assert.equal(new URL(legacyPage.headers.get("location"), baseUrl).pathname, "/");

  const protectedApi = await request("/api/literature/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ topic: "hypertension", period: "5", studyType: "all" }),
  });
  assert.equal(protectedApi.status, 401);
  assert.match(await protectedApi.text(), /Entre na sua conta/);

  for (const path of ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest"]) {
    const response = await request(path);
    assert.equal(response.status, 200, `${path} deveria responder 200`);
  }

  console.log("PASS: home, autenticação, rotas privadas, API protegida, redirects legados, SEO e headers.");
} finally {
  server.kill("SIGTERM");
  await Promise.race([once(server, "exit"), delay(3000)]);
}
