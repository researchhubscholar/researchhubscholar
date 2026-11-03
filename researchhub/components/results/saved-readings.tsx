"use client";
import { useLanguage } from "@/components/i18n/language-provider";
import AuthoredText from "@/components/i18n/authored-text";
import InterfaceText from "@/components/i18n/interface-text";
import { workspaceReadings } from "../../lib/results/review";
import type { ResultsWorkspace } from "../../lib/results/data";
import { ResultReading } from "./result-reading";
export default function SavedReadings({workspace}:{workspace:ResultsWorkspace}) {
 const {locale:resultsLocale}=useLanguage();

 const results=workspaceReadings(workspace, resultsLocale);
 return <section className="rounded-2xl border bg-white p-5 space-y-4"><h3 className="text-lg font-medium"><InterfaceText message="screen.d65eeaa66b62" /></h3><p className="text-sm text-ink-soft"><InterfaceText message="screen.c2b8974f9893" /></p>{!results.length&&<p className="text-sm"><InterfaceText message="screen.3bcb6064b0ce" /></p>}{results.map(r=><div key={r.title} className="border rounded-card p-4 space-y-3"><h4 className="font-medium"><AuthoredText text={r.title} /></h4>{r.reading?<ResultReading reading={r.reading}/>:<p role="status" className="text-sm"><InterfaceText message="screen.e98839838712" /> <AuthoredText text={r.pending} /> <InterfaceText message="screen.cd5576744f36" /></p>}</div>)}</section>;
}
