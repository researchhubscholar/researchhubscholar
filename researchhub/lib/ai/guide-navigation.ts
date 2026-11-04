import { localizeAuthoredOutput } from "./localized-output";
import type { OutputLanguage } from "./language";
import { areaHref,guideScope,type GuideArea } from "./areas";
import type { AssistantOutput } from "./assist";
const destinations=['ideias','radar','biblioteca','protocolo','resultados','manuscrito','documentos','orientacao'] as const;
export function guideDestination(value:unknown,projectId:string|null):GuideArea|null{
 return typeof value==='string'&&(destinations as readonly string[]).includes(value)&&(guideScope(value as GuideArea)!=='project'||Boolean(projectId))?value as GuideArea:null;
}
export function guideDestinationHref(value:unknown,projectId:string|null){const area=guideDestination(value,projectId);return area?areaHref(area,area==='ideias'?null:projectId):null;}
export function startingResearch(message:string){const text=message.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[?!.]/g,'').trim();return /^(?:como (?:puedo |podria |debo )?(?:empezar|comenzar|iniciar)|por donde (?:empiezo|comienzo|empezar|comenzar))(?: (?:un|el|mi|nuevo))? (?:trabajo|tcc|articulo|proyecto)(?: (?:cientifico|academico|de investigacion))?$/.test(text.replace(/[¿¡]/g,'')) || /^(como (?:eu |posso |eu posso )?(?:comecar|iniciar)|por onde (?:eu )?(?:comeco|comecar|inicio|iniciar))(?: (?:um|o|meu|novo))? (?:trabalho|tcc|artigo|projeto)(?: (?:cientifico|academico|de pesquisa))?$/.test(text);}
export function startingResearchOutput(projectId:string|null, language:OutputLanguage="pt-BR"):AssistantOutput{
 return localizeAuthoredOutput({title:'Vamos começar seu trabalho',summary:projectId?'Para continuar o projeto aberto, comece conferindo sua pergunta de pesquisa. Se a intenção for iniciar outro tema, abra Ideias.\n\n1. No Protocolo, descreva quem ou o que quer estudar e o que deseja descobrir.\n2. No Radar, procure trabalhos próximos e salve os mais úteis na Biblioteca.\n3. Volte ao Protocolo para alinhar objetivo, desenho e acesso aos dados.\n\nVocê quer continuar este projeto ou começar um tema novo?':'Comece pela aba Ideias: você ainda não precisa ter um projeto pronto.\n\n1. Escreva um tema de interesse e quem ou o que gostaria de estudar. Se ainda não tiver tema, conte sua área e algo que desperta sua curiosidade.\n2. Converse sobre o recorte, o prazo e os dados aos quais pode ter acesso. Depois use o Radar para uma primeira busca de literatura.\n3. Quando a pergunta estiver mais clara, revise a proposta em Ideias e abra o rascunho do projeto.\n\nVocê já tem algum tema em mente?',recommendations:[{label:projectId?'Conferir a pergunta no Protocolo':'Começar pela escolha do tema',content:projectId?'protocolo':'ideias',rationale:projectId?'Revise a pergunta e o objetivo do projeto selecionado antes de avançar.':'Em Ideias, descreva seu interesse para definir uma pergunta viável. A tela abre sem criar ou salvar um projeto.',targetField:'guide_navigate',confidence:'alta',source:'Orientação de navegação do ResearchHub'}],warnings:[],caution:'Esses passos ajudam a organizar o início; desenho, viabilidade e ética precisam ser revisados conforme o estudo.'},language);
}

// This exact built-in starter needs no model-authored wording.
export function ideasStarterOutput(message: string, area: unknown, language: OutputLanguage): AssistantOutput | null {
 const normalized = message.trim().replace(/^¿/, "").replace(/\?$/, "").toLowerCase();
 if (area !== "ideias" || !["cómo puedo avanzar en ideas", "como posso avançar em ideias"].includes(normalized) || language === "en") return null;
 return {
  title: language === "es" ? "Cómo avanzar en Ideas" : "Como avançar em Ideias",
  summary: language === "es"
   ? "Describe a quién o qué quieres estudiar, a qué datos tienes acceso y cuánto tiempo tienes. Genera una propuesta en Ideas y revisa su pregunta de investigación. Después, usa Radar para comprobar qué literatura existe sobre el tema."
   : "Descreva quem ou o que você quer estudar, a quais dados tem acesso e quanto tempo tem. Gere uma proposta em Ideias e revise a pergunta de pesquisa. Depois, use o Radar para verificar a literatura disponível sobre o tema.",
  recommendations: [{label: language === "es" ? "Comprobar la literatura en Radar" : "Verificar a literatura no Radar", content: "radar", rationale: language === "es" ? "Busca los conceptos principales de tu pregunta." : "Busque os conceitos principais da sua pergunta.", targetField: "guide_navigate", confidence: "alta", source: "ResearchHub"}], warnings: [],
  caution: language === "es" ? "Revisa la viabilidad de la propuesta antes de continuar." : "Revise a viabilidade da proposta antes de avançar.",
 };
}
