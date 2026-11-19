const fs = require("node:fs");
const assert = require("node:assert/strict");
const component = fs.readFileSync("components/advising/advising-workspace.tsx", "utf8");
const css = fs.readFileSync("app/concept-workspace.css", "utf8");
const names = ["advising-meeting-form", "advising-meeting-date", "advising-meeting-title", "advising-meeting-notes", "advising-meeting-next", "advising-save-meeting", "advising-version-entry", "advising-version-submit"];
for(const name of names) {
  assert(component.includes(name), "Missing style hook: "+name);
  assert(css.includes(name), "Missing scoped style: "+name);
}
assert(css.includes("Orientation editorial refinement"), "Scoped refinement marker absent");
assert(css.includes("grid-template-columns: minmax(0, 1.35fr) minmax(0, .9fr)"), "Meeting/version column ratio changed");
assert(css.includes("@media (max-width: 1100px)"), "Narrow layout must stack cards");
assert(css.includes("@media (max-width: 640px)"), "Mobile fields must stack");
for(const action of ["run(addMeeting)", "run(createVersion)", "setMeeting(current=>", "setVersionLabel", "disabled={pending||versionLabel.trim().length<2}"]) {
  assert(component.includes(action), "Preserve original form logic: "+action);
}
assert(component.includes('type="date"'), "Native date control required");
assert(component.includes('type="checkbox" checked={compare.includes(item.id)}'), "Version comparison must remain functional");
console.log("PASS: orientation visual refinement preserves all meeting and version actions.");
