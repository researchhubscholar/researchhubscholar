import { addHistory, blankField, collectionLimit, identifierHeader, identifierValue, normalize, type ClinicalCollection } from "./collection";
import type { AssistantRecommendation } from "../ai/assist";
export const suggestionTargets=["number","category","date","inclusion","exclusion"];
export function applyCollectionSuggestions(collection:ClinicalCollection,items:AssistantRecommendation[]){
 if(!items.length||items.length>10)throw Error("Selecione de uma a dez sugestões.");
 const next:ClinicalCollection={...collection,fields:[...collection.fields]};
 for(const item of items){
  const label=item.label.trim(),content=item.content.trim();
  if(!suggestionTargets.includes(item.targetField)||!label||label.length>100||!content||content.length>1000||identifierValue(content))throw Error("Há sugestões inválidas. Revise o conteúdo antes de adicionar.");
  if(item.targetField==='inclusion'||item.targetField==='exclusion'){
   const key=item.targetField;
   if(normalize(next[key]).includes(normalize(content)))continue;
   const value=[next[key].trim(),content].filter(Boolean).join('\n');
   if(value.length>3000)throw Error("Os critérios ultrapassariam 3.000 caracteres. Revise-os manualmente.");
   next[key]=value;continue;
  }
  if(identifierHeader(label))throw Error("Retire os identificadores pessoais das sugestões.");
  if(next.fields.some(f=>normalize(f.label)===normalize(label)))continue;
  if(next.fields.length>=collectionLimit.fields)throw Error(`A seleção ultrapassaria ${collectionLimit.fields} variáveis. Reduza as sugestões selecionadas.`);
  let index=1;while(next.fields.some(f=>f.key===`v_${index}`))index++;
  next.fields.push({...blankField(`v_${index}`,label),kind:item.targetField as "number"|"category"|"date",definition:content});
 }
 if(next.fields.length===collection.fields.length&&next.inclusion===collection.inclusion&&next.exclusion===collection.exclusion)throw Error("Estas sugestões já estão na ficha. Nenhuma alteração foi feita.");
 return addHistory(next,"Sugestões de IA selecionadas e adicionadas pelo pesquisador");
}
