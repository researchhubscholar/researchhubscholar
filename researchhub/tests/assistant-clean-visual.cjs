const fs=require("node:fs");
const assert=require("node:assert/strict");
const guide=fs.readFileSync("components/ai/project-guide.tsx","utf8");
const inline=fs.readFileSync("components/ai/assistant-panel.tsx","utf8");
const css=fs.readFileSync("app/globals.css","utf8");
assert(guide.includes("project-guide-window--clean"));
assert(guide.includes('className="project-guide-backdrop"'),"A nonblocking visual backdrop is required");
assert(guide.includes('pointerEvents:"none"'),"Backdrop must preserve workspace interactions");
assert(guide.includes('border:"2px solid #719780"'),"Panel shell must have a visible border independent of global CSS");
assert(guide.includes('position:"fixed", zIndex:150'),"Panel must float above page containers");
assert(guide.includes('boxShadow:"0 32px 90px'),"Panel needs elevation independent of CSS cascade");
assert(guide.includes("project-guide-window--v2"),"Panel must opt into V2 shell.");
assert(guide.includes('visibility:open?"hidden":"visible"'),"Floating opener must be hidden while panel is open.");
assert(guide.includes('gridTemplateRows:"auto minmax(0, 1fr) auto"'),"Header/thread/composer must have distinct grid rows.");
assert(guide.includes('height:expanded?"calc(100dvh - 24px)"'),"Expanded panel must fit viewport without overflowing.");
assert(guide.includes('width:expanded?"min(40rem'),"Expanded panel width must be bounded.");
assert(guide.includes('style={{minHeight:0,overflowY:"auto"'),"Chat history must scroll independently.");
assert(guide.includes('style={{background:"#f5f8f5",borderTop:'),"Composer must have visible independent footer.");
assert(css.includes("RH Assistant shell V2"),"Scoped V2 styles required.");
assert(css.includes("@media (max-width: 640px)"),"Mobile specific layout required.");
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
