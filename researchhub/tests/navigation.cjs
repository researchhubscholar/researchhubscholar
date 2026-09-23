const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const navigationPath = path.join(__dirname, "..", "components", "session-navigation.tsx");
const source = fs.readFileSync(navigationPath, "utf8");

const requiredPrivateLinks = [
  ["/dashboard", "Meu espaço"],
  ["/descobrir", "Radar"],
  ["/ideias", "Ideias"],
  ["/biblioteca", "Biblioteca"],
  ["/meu-trabalho", "Meu projeto"],
  ["/orientacao", "Orientação"],
];

for (const [href, label] of requiredPrivateLinks) {
  assert.match(source, new RegExp(`\\["${href}", "${label}"\\]`));
}

assert.doesNotMatch(
  source,
  /links\.slice\(/,
  "A navegação não pode truncar os módulos disponíveis.",
);

console.log("navigation tests passed");
