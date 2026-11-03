// Presentation-only dependencies for the existing isolated component harnesses.
// They keep testing real handlers/state while the separate HTTP smoke exercises locales.
const fs = require('node:fs');
const path = require('node:path');
function object(file, name) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const block = source.match(new RegExp('export const '+name+' = (\\{[\\s\\S]*?\\n\\}) as const;'))[1];
  return JSON.parse(block.replace(/\s*\.\.\.screenPortuguese,/g,'').replace(/,(\s*[}\]])/g,'$1'));
}
const portuguese = {...object('lib/i18n/screen-catalog.ts','screenPortuguese'),...object('lib/i18n/catalog.ts','portuguese')};
const text = key => { if (!(key in portuguese)) throw Error('Unknown interface key: '+key); return portuguese[key]; };
const Interface = {__interfaceText:true};
const Authored = {__authoredText:true};
function jsx(type, props) {
  if(type === Interface) return text(props.message);
  if(type === Authored) return props.text;
  return {type,props};
}
function dependency(name) {
  if(name==='@/components/i18n/use-interface-copy') return {useInterfaceCopy:()=>source=>source};
  if(name==='@/lib/ai/language') return require('../lib/ai/language.ts');
  if(name==='@/lib/ai/localized-output') return require('../lib/ai/localized-output.ts');
  if(name==='@/components/i18n/interface-text') return {default:Interface};
  if(name==='@/components/i18n/authored-text') return {default:Authored};
  if(name==='@/components/i18n/language-provider') return {useLanguage:()=>({locale:'pt-BR',t:text})};
  if(name==='@/lib/i18n/interface-copy') return {dialogCopy:source=>source,localizeInterfaceCopy:(_locale,source)=>source};
  if(name==='@/lib/i18n/format') return require('../lib/i18n/format.ts');
  if(name==='@/lib/i18n/server') return {getRequestLocale:async()=>'pt-BR'};
  if(name==='@/lib/i18n/locale') return {translate:(_locale,key)=>text(key)};
  return null;
}
function sourceWithPortugueseLabels(source) {
  return source.replace(/<InterfaceText message="([^"]+)"\s*\/>/g,(_match,key)=>text(key))
    .replace(/\b(?:t|uiText)\("(screen\.[^"]+)"\)/g,(_match,key)=>JSON.stringify(text(key)));
}
module.exports = {jsx,dependency,sourceWithPortugueseLabels};
