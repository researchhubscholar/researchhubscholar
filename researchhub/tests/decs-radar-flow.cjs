const assert=require("node:assert/strict"),fs=require("node:fs"),ts=require("typescript");
require.extensions[".ts"]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {buildSearchStrategy,sanitizeTranslations}=require("../lib/literature/query-strategy.ts");
const {searchLimits}=require("../lib/literature/search-limits.ts");
const response={NextResponse:{json:(value,init)=>new Response(JSON.stringify(value),{status:init?.status||200,headers:{"Content-Type":"application/json"}})}};
function route(decs) {
 const module={exports:{}};
 new Function("require","module","exports","process",ts.transpileModule(fs.readFileSync("app/api/literature/search/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(
   name=>{
     const dependencies={
       "next/server":response,
       "@/lib/literature/query-strategy":{buildSearchStrategy,sanitizeTranslations},
       "@/lib/literature/search-limits":{searchLimits},
       "@/lib/literature/decs":{resolveDecsTerms:decs},
       "@/lib/operations/provider-events":{recordProviderEvent:async()=>{}},
       "@/lib/literature/terminology":{officialTerminologySuggestions:async()=>({})},
       "@/lib/literature/analyze":{analyzeLiterature:async input=>({query:buildSearchStrategy(input).pubmedQuery,sources:{pubmed:{total:2}}})},
     };
     if (!(name in dependencies)) throw new Error("Unexpected module: "+name);
     return dependencies[name];
   },module,module.exports,process);
 return module.exports;
}
(async()=>{
 const prior=process.env.SCHOLAR_DECS_AUTO_REFINE;
 let calls=0;
 const decs=async terms=>{calls++; assert.deepEqual(terms,["microplasticos"]);return{translations:{microplasticos:"Microplastics"},resolutions:[{source:"microplasticos",english:"Microplastics",provenance:"DeCS",descriptorId:"D000123"}]};};
 const endpoint=route(decs);
 const req=()=>new Request("https://local/api/literature/search",{method:"POST",body:JSON.stringify({topic:"microplásticos em gestantes"})});
 try {
   process.env.SCHOLAR_DECS_AUTO_REFINE="false";
   const disabled=await endpoint.POST(req());
   assert.equal(disabled.status,422);assert.equal(calls,0);
   process.env.SCHOLAR_DECS_AUTO_REFINE="true";
   const enabled=await endpoint.POST(req());
   assert.equal(enabled.status,200);const output=await enabled.json();
   assert.equal(calls,1);assert.match(output.query,/Microplastics/);
   assert.equal(output.terminology.verified[0].provenance,"DeCS");
   const uncertain=route(async()=>({translations:{},resolutions:[]}));
   const fallback=await uncertain.POST(req());
   assert.equal(fallback.status,422);
   assert.equal((await fallback.json()).code,"TERMINOLOGY_REVIEW_REQUIRED");
   const advanced=await endpoint.POST(new Request("https://local/api/literature/search",{method:"POST",body:JSON.stringify({topic:"(diabetes[Title/Abstract]) AND hypertension[MeSH Terms]"})}));
   assert.equal(advanced.status,200);assert.equal(calls,1,"advanced syntax is not modified by DeCS");
   console.log("PASS: IA-02 opt-in auto-refines exact terms, preserves review fallback and advanced PubMed queries.");
 } finally {
   if(prior===undefined)delete process.env.SCHOLAR_DECS_AUTO_REFINE;
   else process.env.SCHOLAR_DECS_AUTO_REFINE=prior;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
