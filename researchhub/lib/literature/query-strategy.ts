export type SearchInput = {
  topic: string;
  mesh?: string;
  population?: string;
  outcome?: string;
  operator?: "AND" | "OR";
  language?: "auto" | "pt" | "en";
};

export type SearchStrategy = {
  original: string;
  interpreted: string;
  pubmedQuery: string;
  crossrefQuery: string;
  concepts: string[];
  mode: "interpreted" | "advanced";
  language: "pt" | "en" | "advanced";
  warnings: string[];
};

type Concept = { label: string; terms: string[]; mesh?: string[] };

const phraseConcepts: Array<{ aliases: string[]; concept: Concept }> = [
  { aliases: ["cancer de mama"], concept: { label: "breast cancer", terms: ["breast cancer", "breast neoplasm"], mesh: ["Breast Neoplasms"] } },
  { aliases: ["cancer de prostata"], concept: { label: "prostate cancer", terms: ["prostate cancer", "prostatic neoplasm"], mesh: ["Prostatic Neoplasms"] } },
  { aliases: ["cancer de pulmao"], concept: { label: "lung cancer", terms: ["lung cancer", "lung neoplasm"], mesh: ["Lung Neoplasms"] } },
  { aliases: ["cancer do colo do utero", "cancer cervical"], concept: { label: "cervical cancer", terms: ["cervical cancer", "cervical neoplasm"], mesh: ["Uterine Cervical Neoplasms"] } },
  { aliases: ["acidente vascular cerebral", "derrame cerebral"], concept: { label: "stroke", terms: ["stroke", "cerebrovascular accident"], mesh: ["Stroke"] } },
  { aliases: ["doenca cardiovascular", "doencas cardiovasculares"], concept: { label: "cardiovascular disease", terms: ["cardiovascular disease", "cardiovascular diseases"], mesh: ["Cardiovascular Diseases"] } },
  { aliases: ["insuficiencia cardiaca"], concept: { label: "heart failure", terms: ["heart failure"], mesh: ["Heart Failure"] } },
  { aliases: ["infarto agudo do miocardio", "infarto do miocardio"], concept: { label: "myocardial infarction", terms: ["myocardial infarction", "heart attack"], mesh: ["Myocardial Infarction"] } },
  { aliases: ["doenca renal cronica"], concept: { label: "chronic kidney disease", terms: ["chronic kidney disease"], mesh: ["Renal Insufficiency, Chronic"] } },
  { aliases: ["doenca de alzheimer", "mal de alzheimer"], concept: { label: "Alzheimer disease", terms: ["Alzheimer disease", "Alzheimer's disease"], mesh: ["Alzheimer Disease"] } },
  { aliases: ["resistencia antimicrobiana", "resistencia a antibioticos"], concept: { label: "antimicrobial resistance", terms: ["antimicrobial resistance", "antibiotic resistance"], mesh: ["Drug Resistance, Microbial"] } },
  { aliases: ["transtorno do espectro autista", "espectro autista"], concept: { label: "autism spectrum disorder", terms: ["autism spectrum disorder", "autism"], mesh: ["Autism Spectrum Disorder"] } },
  { aliases: ["parto prematuro", "nascimento prematuro"], concept: { label: "preterm birth", terms: ["preterm birth", "premature birth"], mesh: ["Premature Birth"] } },
  { aliases: ["qualidade do sono", "sleep quality"], concept: { label: "sleep quality", terms: ["sleep quality"], mesh: ["Sleep"] } },
  { aliases: ["privacao do sono", "falta de sono", "sleep deprivation"], concept: { label: "sleep deprivation", terms: ["sleep deprivation"], mesh: ["Sleep Deprivation"] } },
  { aliases: ["residentes de medicina", "residentes medicos", "medicos residentes", "medical residents", "medical resident"], concept: { label: "medical residents", terms: ["medical resident", "medical residents"], mesh: ["Internship and Residency"] } },
  { aliases: ["estudantes de medicina", "estudantes medicos", "medical students", "medical student"], concept: { label: "medical students", terms: ["medical student", "medical students"], mesh: ["Students, Medical"] } },
  { aliases: ["profissionais de saude", "trabalhadores da saude"], concept: { label: "healthcare workers", terms: ["healthcare worker", "healthcare workers", "health personnel"], mesh: ["Health Personnel"] } },
  { aliases: ["saude mental"], concept: { label: "mental health", terms: ["mental health"], mesh: ["Mental Health"] } },
  { aliases: ["adesao ao tratamento", "adesao medicamentosa", "adesao a medicacao", "medication adherence", "treatment adherence"], concept: { label: "medication adherence", terms: ["medication adherence", "treatment adherence"], mesh: ["Medication Adherence"] } },
  { aliases: ["seguranca do paciente"], concept: { label: "patient safety", terms: ["patient safety"], mesh: ["Patient Safety"] } },
  { aliases: ["qualidade de vida"], concept: { label: "quality of life", terms: ["quality of life"], mesh: ["Quality of Life"] } },
  { aliases: ["atividade fisica", "exercicio fisico"], concept: { label: "physical activity", terms: ["physical activity", "physical exercise"], mesh: ["Exercise"] } },
  { aliases: ["atencao primaria", "cuidados primarios"], concept: { label: "primary health care", terms: ["primary health care", "primary care"], mesh: ["Primary Health Care"] } },
  { aliases: ["terapia intensiva", "unidade de terapia intensiva"], concept: { label: "intensive care", terms: ["intensive care", "intensive care unit"], mesh: ["Intensive Care Units"] } },
  { aliases: ["pronto socorro", "servico de emergencia"], concept: { label: "emergency service", terms: ["emergency service", "emergency department"], mesh: ["Emergency Service, Hospital"] } },
  { aliases: ["tempo de tela", "uso de telas"], concept: { label: "screen time", terms: ["screen time", "digital screen exposure"] } },
  { aliases: ["relato de caso"], concept: { label: "case report", terms: ["case report"], mesh: ["Case Reports"] } },
  { aliases: ["revisao sistematica"], concept: { label: "systematic review", terms: ["systematic review"], mesh: ["Systematic Review"] } },
  { aliases: ["ensaio clinico"], concept: { label: "clinical trial", terms: ["clinical trial"], mesh: ["Clinical Trial"] } },
];

const wordConcepts: Record<string, Concept> = {
  ansiedade: { label: "anxiety", terms: ["anxiety"], mesh: ["Anxiety"] },
  adolescentes: { label: "adolescents", terms: ["adolescent", "adolescents"], mesh: ["Adolescent"] },
  adultos: { label: "adults", terms: ["adult", "adults"], mesh: ["Adult"] },
  burnout: { label: "burnout", terms: ["burnout", "professional burnout"], mesh: ["Burnout, Professional"] },
  cancer: { label: "cancer", terms: ["cancer", "neoplasm"], mesh: ["Neoplasms"] },
  criancas: { label: "children", terms: ["child", "children"], mesh: ["Child"] },
  depressao: { label: "depression", terms: ["depression", "depressive symptoms"], mesh: ["Depression"] },
  diabetes: { label: "diabetes", terms: ["diabetes"], mesh: ["Diabetes Mellitus"] },
  dor: { label: "pain", terms: ["pain"], mesh: ["Pain"] },
  enfermagem: { label: "nursing", terms: ["nursing", "nurse", "nurses"], mesh: ["Nursing"] },
  gestantes: { label: "pregnant women", terms: ["pregnant woman", "pregnant women"], mesh: ["Pregnant Women"] },
  homens: { label: "men", terms: ["man", "men"], mesh: ["Men"] },
  hipertensao: { label: "hypertension", terms: ["hypertension", "high blood pressure"], mesh: ["Hypertension"] },
  idosos: { label: "older adults", terms: ["older adult", "older adults", "elderly"], mesh: ["Aged"] },
  infeccao: { label: "infection", terms: ["infection", "infections"], mesh: ["Infections"] },
  mulheres: { label: "women", terms: ["woman", "women"], mesh: ["Women"] },
  jovens: { label: "young adults", terms: ["young adult", "young adults"], mesh: ["Young Adult"] },
  obesidade: { label: "obesity", terms: ["obesity"], mesh: ["Obesity"] },
  pacientes: { label: "patients", terms: ["patient", "patients"] },
  prevalencia: { label: "prevalence", terms: ["prevalence"] },
  semaglutida: { label: "semaglutide", terms: ["semaglutide"] },
  sono: { label: "sleep", terms: ["sleep"], mesh: ["Sleep"] },
  suicidio: { label: "suicide", terms: ["suicide", "suicidal ideation"], mesh: ["Suicide"] },
  tratamento: { label: "treatment", terms: ["treatment", "therapy"] },
  vacinacao: { label: "vaccination", terms: ["vaccination", "immunization"], mesh: ["Vaccination"] },
};

const stopwords = new Set([
  "a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "na", "nas", "no", "nos", "para", "por", "com", "sem",
  "entre", "sobre", "qual", "quais", "como", "quanto", "uma", "um", "seu", "sua", "seus", "suas", "pode", "podem", "tem", "ter",
  "avaliacao", "avaliar", "analise", "analisar", "estudo", "estudos", "pesquisa", "pesquisar", "impacto", "efeito", "efeitos", "relacao",
  "associacao", "influencia", "influenciar", "comparacao", "comparar",
]);

const englishStopwords = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "from", "by", "with", "without", "and", "or", "among", "between", "during",
  "what", "which", "who", "how", "does", "do", "is", "are", "can", "could", "should", "study", "studies", "research", "evaluate", "evaluation",
  "analyze", "analysis", "impact", "effect", "effects", "association", "relationship", "influence", "comparison", "compare",
]);

function fold(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fieldTerm(value: string, field: "Title/Abstract" | "MeSH Terms") {
  return `"${value.replaceAll('"', "").trim()}"[${field}]`;
}

function conceptQuery(concept: Concept) {
  const terms = concept.terms.map((term) => fieldTerm(term, "Title/Abstract"));
  const mesh = (concept.mesh || []).map((term) => fieldTerm(term, "MeSH Terms"));
  return `(${[...terms, ...mesh].join(" OR ")})`;
}

function isAdvanced(value: string) {
  return /\[[^\]]+\]|(?:^|\s)(?:AND|OR|NOT)(?:\s|$)/.test(value);
}

function plainAdvanced(value: string) {
  return clean(value
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\b(?:AND|OR|NOT)\b/g, " ")
    .replace(/[()\"]/g, " "));
}

function detectLanguage(value: string): "pt" | "en" {
  if (/[áàâãéêíóôõúç]/i.test(value)) return "pt";
  return /\b(?:qual|quais|como|entre|sobre|com|sem|residentes|estudantes|medicos|pacientes|tratamento|saude)\b/i.test(value) ? "pt" : "en";
}

function conceptsFromNaturalLanguage(value: string, language: "pt" | "en") {
  let working = ` ${fold(value).replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ")} `;
  const concepts: Concept[] = [];

  const phrases = [...phraseConcepts].sort((a, b) => Math.max(...b.aliases.map(x => x.length)) - Math.max(...a.aliases.map(x => x.length)));
  for (const entry of phrases) {
    for (const alias of entry.aliases) {
      const expression = new RegExp(`\\b${escapeRegex(fold(alias)).replace(/\\ /g, "\\s+")}\\b`, "g");
      if (!expression.test(working)) continue;
      concepts.push(entry.concept);
      working = working.replace(expression, " ");
      break;
    }
  }

  const unknown: string[] = [];
  for (const token of working.trim().split(/\s+/).filter(Boolean)) {
    const ignored = language === "pt" ? stopwords : englishStopwords;
    if (ignored.has(token) || token.length < 3) continue;
    const translated = wordConcepts[token];
    if (translated) concepts.push(translated);
    else {
      unknown.push(token);
      concepts.push({ label: token, terms: [token] });
    }
  }

  const unique = concepts.filter((concept, index, all) => all.findIndex(item => item.label === concept.label) === index);
  return { concepts: unique.slice(0, 6), unknown, truncated: unique.length > 6 };
}

function naturalPart(value: string, language: "pt" | "en") {
  const parsed = conceptsFromNaturalLanguage(value, language);
  if (!parsed.concepts.length) {
    const fallback = clean(value.replace(/[?!.;,]/g, " "));
    const concept = { label: fallback, terms: [fallback] };
    return { pubmed: conceptQuery(concept), plain: fallback, concepts: [fallback], unknown: [fallback], truncated: false };
  }
  return {
    pubmed: parsed.concepts.map(conceptQuery).join(" AND "),
    plain: parsed.concepts.map(concept => concept.label).join(" "),
    concepts: parsed.concepts.map(concept => concept.label),
    unknown: parsed.unknown,
    truncated: parsed.truncated,
  };
}

export function buildSearchStrategy(value: string | SearchInput): SearchStrategy {
  const input: SearchInput = typeof value === "string" ? { topic: value } : value;
  const topic = clean(input.topic);
  const operator = input.operator === "OR" ? "OR" : "AND";
  const warnings: string[] = [];

  if (isAdvanced(topic) && !input.mesh && !input.population && !input.outcome) {
    return {
      original: topic,
      interpreted: plainAdvanced(topic),
      pubmedQuery: topic,
      crossrefQuery: plainAdvanced(topic),
      concepts: [],
      mode: "advanced",
      language: "advanced",
      warnings,
    };
  }

  const language = input.language && input.language !== "auto" ? input.language : detectLanguage(topic);
  const topicPart = naturalPart(topic, language);
  const parts = [topicPart.pubmed];
  const plainParts = [topicPart.plain];
  const concepts = [...topicPart.concepts];
  const unknown = [...topicPart.unknown];

  if (input.mesh?.trim()) {
    const mesh = clean(input.mesh);
    parts.push(`(${fieldTerm(mesh, "MeSH Terms")})`);
    plainParts.push(mesh);
    concepts.push(mesh);
  }
  for (const extra of [input.population, input.outcome]) {
    if (!extra?.trim()) continue;
    const parsed = naturalPart(extra, language);
    parts.push(parsed.pubmed);
    plainParts.push(parsed.plain);
    concepts.push(...parsed.concepts);
    unknown.push(...parsed.unknown);
  }

  if (language === "pt" && unknown.length) warnings.push("Alguns termos em português não tinham tradução cadastrada e foram mantidos como escritos.");
  if (topicPart.truncated) warnings.push("A pergunta tinha muitos conceitos; o Radar priorizou os seis primeiros para evitar uma busca excessivamente restrita.");

  return {
    original: topic,
    interpreted: plainParts.join(` ${operator} `),
    pubmedQuery: parts.map(part => `(${part})`).join(` ${operator} `),
    crossrefQuery: plainParts.join(" "),
    concepts: Array.from(new Set(concepts)),
    mode: "interpreted",
    language,
    warnings,
  };
}
