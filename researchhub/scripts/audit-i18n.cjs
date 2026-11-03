// Static inventory, not a claim of full translation coverage: dynamic templates,
// API messages, imported labels and generated documents require separate review.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(dir,entry.name)):[path.join(dir,entry.name)]);
const items=new Map();
for(const file of [...walk('app'),...walk('components')].filter(file=>file.endsWith('.tsx')&&!file.includes('/i18n/')&&!file.startsWith('components/ai/'))){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function record(kind,text){text=text.replace(/\s+/g,' ').trim();if(!text||!/[A-Za-zÀ-ÿ]/.test(text))return;const key=kind+':'+text,item=items.get(key)||{kind,text,files:[]};if(!item.files.includes(file))item.files.push(file);items.set(key,item);}
 function visit(node){if(ts.isJsxText(node))record('text',node.text);if(ts.isJsxAttribute(node)&&['placeholder','title','description','label','aria-label'].includes(node.name.text)&&node.initializer&&ts.isStringLiteral(node.initializer))record('attribute',node.initializer.text);ts.forEachChild(node,visit);}visit(source);
}
const report={scope:'Uncatalogued literal UI candidates; neutral names may require no translation. Excludes assistant, dynamic messages and documents.',complete:false,candidates:items.size,items:[...items.values()]};
if(process.argv.includes('--write'))fs.writeFileSync('docs/i18n-pending.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({complete:false,candidates:items.size,report:process.argv.includes('--write')?'docs/i18n-pending.json':null}));
