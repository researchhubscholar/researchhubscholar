const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("app/concept-workspace.css", "utf8");
const resume = fs.readFileSync("components/projects/project-resume.tsx", "utf8");
const library = fs.readFileSync("app/biblioteca/page.tsx", "utf8");
const advising = fs.readFileSync("components/advising/advising-workspace.tsx", "utf8");
assert(resume.includes("workspace-resume-action"), "Resume CTA must have a dedicated class");
assert(resume.includes("workspace-resume-caption"), "Project subtitle must be readable on cream background");
assert(!resume.includes("text-white/70"), "Do not restore white-on-cream resume text");
assert(css.includes(".dashboard-page .workspace-resume-action"));
assert(css.includes(".dashboard-page .workspace-resume-caption"));
for (const section of ["advising-access","advising-comments","advising-meetings","advising-versions"]) {
  assert(advising.includes(section), "Orientation section unavailable: "+section);
  assert(css.includes(section), "Missing orientation styling: "+section);
}
assert(css.includes(".advising-page .advising-comments > form"));
assert(library.includes("library-reading-row"), "Article selection row contract missing");
assert(library.includes('aria-pressed={selectedArticle?.id === article.id}'), "Preserve accessible selection state");
assert(css.includes(".library-reading-row.is-selected"));
assert(css.includes(".library-reading-choice[aria-pressed=\"true\"]"), "Prevent duplicate selected box");
assert(css.includes(".library-reading-choice:focus-visible"), "Keep keyboard focus visible");
console.log("PASS: readable resume CTA, consistent orientation surfaces, one library selection highlight, preserved keyboard focus.");
