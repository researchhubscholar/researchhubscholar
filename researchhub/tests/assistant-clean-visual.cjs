const fs=require("node:fs");
const assert=require("node:assert/strict");
const guide=fs.readFileSync("components/ai/project-guide.tsx","utf8");
const inline=fs.readFileSync("components/ai/assistant-panel.tsx","utf8");
const css=fs.readFileSync("app/globals.css","utf8");
assert(guide.includes("project-guide-window--clean"));
assert(guide.includes('className="project-guide-backdrop"'),"A nonblocking visual backdrop is required");
assert(guide.includes('pointerEvents:"none"'),"Backdrop must preserve workspace interactions");
assert(guide.includes('border:"2px solid #8aa997"'),"Panel shell must have direct, visible border");
assert(guide.includes('position:"fixed", zIndex:150'),"Panel must float above page containers");
assert(guide.includes('boxShadow:"0 30px 85px'),"Panel needs elevation independent of CSS cascade");
assert(inline.includes("assistant-inline-panel--clean"));
assert(css.includes(".project-guide-window.project-guide-window--clean"));
assert(css.includes(".assistant-inline-panel.assistant-inline-panel--clean"));
assert(css.includes("Compact chat framed as a distinct"),"Compact state must have explicit frame.");
assert(css.includes(".project-guide-toggle:has(+ .project-guide-window--clean)"),"Floating close button must not cover chat.");
assert(css.includes("border-left: 3px solid #688b79"),"Panel needs a visible edge.");
assert(css.includes("@media (min-width: 700px)"),"Expanded layout must work at shorter desktop heights.");
for(const key of ["project-guide-header","project-guide-thread","project-guide-question","project-guide-answer","project-guide-compose","project-guide-footer","project-guide-starter","project-guide-next"]) {
 assert(css.includes(".project-guide-window--clean ."+key),"Missing restyle: "+key);
}
for(const key of ["postAI<Record<string,unknown>>","setTurns(current=>","readAIUsage(data.usage)","setError(","setSending(true)","disabled={sending||disabled||loading||!loaded||!draft.trim()}"]) {
 assert(guide.includes(key),"Missing preserved behavior: "+key);
}
assert(guide.includes("onKeyDown={e=>{if(e.key==="),"Escape handling must remain");
assert(guide.includes("aria-label={copy(\"Histórico da conversa\")}"));
assert(guide.includes("aria-busy={loading||sending}"));
assert(guide.includes("if(e.key!==\"Enter\"||e.shiftKey"),"Do not alter enter/shift+enter keyboard UX");
assert(guide.includes("setExcerptPreview("),"Keep editing confirmation");
assert(guide.includes("onPlan={"),"Keep science action affordances");
assert(inline.includes("onAutoApply?.(data.output.recommendations)"),"Keep automatic Radar handoff");
console.log("PASS: ResearchHub visual refresh is CSS-scoped and preserves core chat, assistant and safety hooks.");
