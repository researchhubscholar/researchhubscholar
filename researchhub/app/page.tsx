import Link from "next/link";

const steps = [
  { n: "01", title: "Descubra", text: "Comece com uma ideia ou deixe o sistema ajudar a encontrar um tema relevante." },
  { n: "02", title: "Valide", text: "Consulte literatura biomédica real e veja volume, tendência e tipos de evidência." },
  { n: "03", title: "Organize", text: "Salve artigos, construa sua matriz de evidências e registre a leitura crítica." },
  { n: "04", title: "Construa", text: "Transforme o tema em pergunta, objetivos, desenho, população e desfechos." },
];

export default function ScholarHomePage() {
  return (
    <div>
      <section className="grid lg:grid-cols-[1.12fr_.88fr] gap-10 lg:gap-16 items-center py-8 md:py-14">
        <div>
          <div className="inline-flex items-center gap-2 border border-teal/20 bg-teal-soft rounded-full px-3 py-1.5 text-xs font-medium text-teal">
            <span className="w-1.5 h-1.5 rounded-full bg-teal" />
            Para estudantes de medicina e residentes
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.02] tracking-tight mt-6 max-w-4xl">
            Da curiosidade ao <span className="text-teal">trabalho científico.</span>
          </h1>
          <p className="text-lg text-ink-soft leading-relaxed mt-6 max-w-2xl">
            Encontre um tema, teste sua relevância na literatura, organize artigos reais e estruture seu projeto científico passo a passo.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link href="/descobrir" className="bg-teal text-white px-6 py-3.5 rounded-card font-medium text-center hover:bg-teal/90 transition-colors">Já tenho um tema</Link>
            <Link href="/ideias" className="bg-white border border-line text-ink px-6 py-3.5 rounded-card font-medium text-center hover:border-teal transition-colors">Quero encontrar um tema</Link>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-xs text-ink-soft">
            <span>✓ Busca real no PubMed</span><span>✓ Biblioteca científica</span><span>✓ Matriz de evidências</span><span>✓ Estrutura metodológica</span>
          </div>
        </div>

        <div className="bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-ink-soft">Radar científico</span>
            <span className="text-xs text-teal font-medium">Exemplo</span>
          </div>
          <div className="p-6">
            <p className="text-xs text-ink-soft">Tema analisado</p>
            <h2 className="font-display text-2xl mt-1">Semaglutida e sintomas depressivos</h2>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-paper border border-line rounded-card p-4"><p className="text-2xl font-semibold">PubMed</p><p className="text-xs text-ink-soft mt-1">literatura em tempo real</p></div>
              <div className="bg-teal-soft border border-teal/20 rounded-card p-4"><p className="text-sm font-semibold text-teal">Tema em análise</p><p className="text-xs text-ink-soft mt-1">volume + tendência + evidências</p></div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-ink-soft"><span>Fluxo científico</span><span>4 etapas</span></div>
              <div className="mt-3 space-y-3">
                {["Validar o tema", "Selecionar artigos", "Matriz de evidências", "Construir protocolo"].map((x, i) => (
                  <div key={x} className="flex gap-3 items-center">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${i < 2 ? "bg-teal text-white" : "bg-paper border border-line text-ink-soft"}`}>{i + 1}</span>
                    <span className="text-sm">{x}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-14 md:py-20">
        <div className="max-w-2xl"><p className="text-xs uppercase tracking-widest text-teal font-semibold">Como funciona</p><h2 className="font-display text-3xl md:text-4xl mt-3">Uma linha de raciocínio científico, não uma caixa de texto de IA.</h2></div>
        <div className="grid md:grid-cols-4 gap-4 mt-9">
          {steps.map((step) => <div key={step.n} className="bg-white border border-line rounded-card p-5"><span className="font-mono text-xs text-teal">{step.n}</span><h3 className="font-display text-xl mt-4">{step.title}</h3><p className="text-sm text-ink-soft leading-relaxed mt-2">{step.text}</p></div>)}
        </div>
      </section>

      <section className="bg-ink text-white rounded-2xl p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
        <div><p className="text-xs uppercase tracking-widest text-teal-soft">Protótipo clínico-acadêmico</p><h2 className="font-display text-3xl md:text-4xl mt-3">Teste com um tema real da sua área.</h2><p className="text-white/70 mt-3 max-w-2xl">O sistema não declara lacunas científicas automaticamente. Ele mostra sinais da literatura para apoiar uma decisão que continua sendo científica e humana.</p></div>
        <Link href="/descobrir" className="bg-white text-ink px-6 py-3 rounded-card font-medium text-center">Abrir Radar</Link>
      </section>
    </div>
  );
}
