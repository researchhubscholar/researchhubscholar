// Static inventory, not a claim of full translation coverage: dynamic templates,
// API messages, imported labels and generated documents require separate review.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const items=new Map();
const catalog=fs.readFileSync('lib/i18n/screen-catalog.ts','utf8');
const pt=JSON.parse(catalog.match(/export const screenPortuguese = (\{[\s\S]*?\n\}) as const;/)[1]);
const es=JSON.parse(catalog.match(/export const screenSpanish:.*? = (\{[\s\S]*?\n\});/)[1]);
const unchanged=new Set(Object.keys(pt).filter(key=>pt[key]===es[key]).map(key=>pt[key]));
let unchangedCount=0;
for(const file of [...walk('app'),...walk('components')].filter(file=>file.endsWith('.tsx')&&!file.includes('/i18n/'))){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function record(kind,text){text=text.replace(/\s+/g,' ').trim();if(!text||!/[A-Za-zÀ-ÿ]/.test(text))return;if(unchanged.has(text)){unchangedCount++;return;}const key=kind+':'+text,item=items.get(key)||{kind,text,files:[]};if(!item.files.includes(file))item.files.push(file);items.set(key,item);}
 function visit(node){if(ts.isJsxText(node))record('text',node.text);if(ts.isJsxAttribute(node)&&['placeholder','title','description','label','aria-label'].includes(node.name.text)&&node.initializer&&ts.isStringLiteral(node.initializer))record('attribute',node.initializer.text);ts.forEachChild(node,visit);}visit(source);
}
const report={scope:'UI literals and attributes including the assistant; reviewed identical Portuguese/Spanish terms are retained. Scientific content, user data and generated documents are separate scopes.',complete:items.size===0,candidates:items.size,reviewedUnchanged:unchangedCount,items:[...items.values()]};
if(process.argv.includes('--write'))fs.writeFileSync('docs/i18n-pending.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({complete:items.size===0,candidates:items.size,reviewedUnchanged:unchangedCount,report:process.argv.includes('--write')?'docs/i18n-pending.json':null}));
