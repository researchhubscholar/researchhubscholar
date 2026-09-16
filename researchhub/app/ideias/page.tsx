"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const specialties = ["Cardiologia", "Dermatologia", "Pediatria", "Psiquiatria", "Endocrinologia", "Medicina de Família", "Ortopedia", "Neurologia"];
const interests = ["diagnóstico", "tratamento", "adesão", "qualidade de vida", "prognóstico", "prevenção", "inteligência artificial", "educação médica"];
const populations = ["adultos", "idosos", "crianças", "adolescentes", "gestantes", "residentes", "estudantes de medicina", "atenção primária"];

export default function IdeasPage() {
  const [specialty, setSpecialty] = useState("Cardiologia");
  const [interest, setInterest] = useState("prognóstico");
  const [population, setPopulation] = useState("idosos");

  const ideas = useMemo(() => [
    `Fatores associados ao ${interest} em ${population} acompanhados em ${specialty.toLowerCase()}`,
    `Impacto de estratégias de ${interest} em ${population} no contexto de ${specialty.toLowerCase()}`,
    `Uso de dados clínicos para prever desfechos relacionados a ${interest} em ${population}`,
    `Perfil clínico e fatores relacionados a ${interest} em ${population}: estudo observacional`,
  ], [specialty, interest, population]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-teal font-semibold">Descoberta guiada</p>
        <h1 className="font-display text-4xl md:text-5xl mt-3">Ainda não tem um tema? Comece pelo que você vive na prática.</h1>
        <p className="text-ink-soft mt-4 leading-relaxed">Escolha uma área, um tipo de problema e uma população. O protótipo combina esses elementos e cria pontos de partida que você pode validar no radar científico.</p>
      </div>

      <section className="grid md:grid-cols-3 gap-4 mt-8">
        <SelectCard title="Área clínica" value={specialty} onChange={setSpecialty} options={specialties} />
        <SelectCard title="O que te interessa" value={interest} onChange={setInterest} options={interests} />
        <SelectCard title="População" value={population} onChange={setPopulation} options={populations} />
      </section>

      <section className="mt-8 bg-white border border-line rounded-2xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div><p className="text-xs uppercase tracking-widest text-teal">Sugestões iniciais</p><h2 className="font-display text-2xl mt-2">Quatro caminhos para testar</h2></div>
          <span className="text-xs text-ink-soft">Não são temas “prontos”; são hipóteses de direção.</span>
        </div>
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {ideas.map((idea, index) => (
            <div key={idea} className="border border-line rounded-card p-5 flex flex-col">
              <span className="font-mono text-xs text-teal">0{index + 1}</span>
              <h3 className="font-display text-xl mt-3 leading-snug">{idea}</h3>
              <p className="text-sm text-ink-soft mt-3 flex-1">Valide volume de literatura, tendência e necessidade de recorte antes de adotar o tema.</p>
              <Link href={`/descobrir?tema=${encodeURIComponent(idea)}`} className="text-sm font-medium text-teal mt-5">Levar para o radar →</Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SelectCard({ title, value, onChange, options }: { title: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="bg-white border border-line rounded-card p-5"><span className="text-xs uppercase tracking-wider text-ink-soft">{title}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full mt-3 border border-line rounded-card bg-paper px-3 py-2.5 outline-none focus:border-teal">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
