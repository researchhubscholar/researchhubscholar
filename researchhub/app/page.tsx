import AuthoredText from "@/components/i18n/authored-text";
import InterfaceText from "@/components/i18n/interface-text";
import Link from "next/link";

const steps = [
  { n: "01", title: "Descubra", text: "Comece com uma ideia ou deixe o sistema ajudar a encontrar um tema relevante." },
  { n: "02", title: "Valide", text: "Consulte literatura biomédica real e veja volume, tendência e tipos de evidência." },
  { n: "03", title: "Organize", text: "Salve artigos, construa sua matriz de evidências e registre a leitura crítica." },
  { n: "04", title: "Construa", text: "Transforme o tema em pergunta, objetivos, desenho, população e desfechos." },
];

export default function ScholarHomePage() {
  return (
    <div className="marketing-page">
      <section className="home-hero grid lg:grid-cols-[1.12fr_.88fr] gap-10 lg:gap-16 items-center py-8 md:py-14">
        <div>
          <div className="inline-flex items-center gap-2 border border-teal/20 bg-teal-soft rounded-full px-3 py-1.5 text-xs font-medium text-teal">
            <span className="w-1.5 h-1.5 rounded-full bg-teal" />
            <InterfaceText message="screen.ce7a7ed39d75" />
          </div>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl leading-[1.02] tracking-tight mt-6 max-w-4xl">
            <InterfaceText message="screen.70d33a483736" /> <span className="text-teal"><InterfaceText message="screen.3f96c86b0f74" /></span>
          </h1>
          <p className="text-lg text-ink-soft leading-relaxed mt-6 max-w-2xl">
            <InterfaceText message="screen.792865141b84" />
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Link href="/radar-demo" className="bg-teal text-white px-6 py-3.5 rounded-card font-medium text-center hover:bg-teal/90 transition-colors"><InterfaceText message="screen.3d764ea18b22" /></Link>
            <Link href="/cadastro" className="bg-white border border-line text-ink px-6 py-3.5 rounded-card font-medium text-center hover:border-teal transition-colors"><InterfaceText message="screen.6b0879fb1748" /></Link>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-xs text-ink-soft">
            <span><InterfaceText message="screen.a1b9350f182a" /></span><span>✓ Biblioteca científica</span><span><InterfaceText message="screen.de614cebecc1" /></span><span><InterfaceText message="screen.f4660a22b958" /></span>
          </div>
        </div>

        <div className="home-preview bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-ink-soft">Radar científico</span>
            <span className="text-xs text-teal font-medium"><InterfaceText message="screen.1cf8a7e58dd3" /></span>
          </div>
          <div className="p-6">
            <p className="text-xs text-ink-soft"><InterfaceText message="screen.854f65c11531" /></p>
            <h2 className="font-display text-2xl mt-1"><InterfaceText message="screen.552610522b5c" /></h2>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-paper border border-line rounded-card p-4"><p className="text-2xl font-semibold">PubMed</p><p className="text-xs text-ink-soft mt-1"><InterfaceText message="screen.1d7aaa148d47" /></p></div>
              <div className="bg-teal-soft border border-teal/20 rounded-card p-4"><p className="text-sm font-semibold text-teal"><InterfaceText message="screen.7b8ec4a018a3" /></p><p className="text-xs text-ink-soft mt-1"><InterfaceText message="screen.e47ad5668fc4" /></p></div>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-ink-soft"><span><InterfaceText message="screen.6e311ab9c0aa" /></span><span>4 etapas</span></div>
              <div className="mt-3 space-y-3">
                {["Validar o tema", "Selecionar artigos", "Matriz de evidências", "Construir protocolo"].map((x, i) => (
                  <div key={x} className="flex gap-3 items-center">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${i < 2 ? "bg-teal text-white" : "bg-paper border border-line text-ink-soft"}`}>{i + 1}</span>
                    <span className="text-sm"><AuthoredText text={x} /></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-14 md:py-20">
        <div className="max-w-2xl"><p className="text-xs uppercase tracking-widest text-teal font-semibold"><InterfaceText message="screen.991f80d4356d" /></p><h2 className="font-display text-3xl md:text-4xl mt-3"><InterfaceText message="screen.5e39e12e0c99" /></h2></div>
        <div className="grid md:grid-cols-4 gap-4 mt-9">
          {steps.map((step) => <div key={step.n} className="home-stage bg-white border border-line rounded-card p-5"><span className="font-mono text-xs text-teal">{step.n}</span><h3 className="font-display text-xl mt-4"><AuthoredText text={step.title} /></h3><p className="text-sm text-ink-soft leading-relaxed mt-2"><AuthoredText text={step.text} /></p></div>)}
        </div>
      </section>

      <section className="mb-12 grid md:grid-cols-2 gap-5">
        <div className="bg-white border border-line rounded-2xl p-7"><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.e02628a0213e" /></p><h2 className="font-display text-3xl mt-3"><InterfaceText message="screen.23dc2738dbf4" /></h2><p className="text-sm text-ink-soft mt-4 leading-relaxed"><InterfaceText message="screen.2e534b4eca32" /></p><Link href="/cadastro" className="inline-block text-teal font-medium mt-5"><InterfaceText message="screen.256da5920d8e" /></Link></div>
        <div className="bg-teal-soft border border-teal/20 rounded-2xl p-7"><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.b6d2b2ee57b0" /></p><h2 className="font-display text-3xl mt-3"><InterfaceText message="screen.2ac4c9724d46" /></h2><p className="text-sm text-ink-soft mt-4 leading-relaxed"><InterfaceText message="screen.e2f072287a52" /></p><Link href="/para-residencias" className="inline-block text-teal font-medium mt-5"><InterfaceText message="screen.eab3fde3dc09" /></Link></div>
      </section>
      <section className="border-t border-line py-12"><p className="text-xs uppercase tracking-widest text-teal"><InterfaceText message="screen.83a388d53f29" /></p><h2 className="font-display text-3xl mt-3"><InterfaceText message="screen.e16c1a5f85bc" /></h2><div className="grid md:grid-cols-3 gap-4 mt-6">{[["Radar","Explore PubMed e Crossref, navegue pelos artigos e busque referências por DOI ou PMID."],["Ideias guiadas","Defina problema, população, acesso a dados e prazo para comparar propostas de pesquisa."],["Biblioteca e matriz","Salve referências e registre objetivo, método, resultados e limitações de cada leitura."],["Meu projeto","Desenvolva o protocolo e escreva o manuscrito científico por seções dentro da plataforma."],["Histórico","Retome versões das ideias, do projeto e do manuscrito depois de entrar novamente na conta."],["Residências","Convites, turmas, franquia e acompanhamento dos projetos compartilhados pelo residente."]].map(([title,text])=><article key={title} className="home-feature bg-white border border-line p-5 rounded-2xl"><h3 className="font-display text-xl"><AuthoredText text={title} /></h3><p className="text-sm text-ink-soft mt-3 leading-relaxed"><AuthoredText text={text} /></p></article>)}</div><p className="mt-5 text-sm text-ink-soft"><InterfaceText message="screen.8f10f5a46373" /></p><Link href="/como-funciona" className="text-teal inline-block mt-4"><InterfaceText message="screen.bdf3e4eb4374" /></Link></section>
      <section className="py-10"><h2 className="font-display text-3xl"><InterfaceText message="screen.27e0a97bf59d" /></h2><div className="mt-5 space-y-3">{[["Posso experimentar sem criar uma conta?","Sim. O Radar demonstrativo permite consultar literatura real sem cadastro ou IA, com até três tentativas diárias por rede."],["O sistema produz um trabalho pronto?","O Scholar organiza as decisões e a leitura científica. Você continua responsável pela avaliação das fontes, pela autoria e pela discussão com o orientador."],["Meus dados ficam públicos?","Seus projetos, biblioteca e ideias são privados. No programa institucional, o coordenador acompanha a participação e apenas os projetos que você compartilhar explicitamente."],["Preciso pagar para testar agora?","O cadastro e as ferramentas desta fase de testes não abrem checkout nem geram cobrança. Os planos apresentados são a proposta para a futura licença anual."]].map(([q,a])=><details key={q} className="border border-line bg-white rounded-card p-5"><summary className="font-medium cursor-pointer"><AuthoredText text={q} /></summary><p className="text-sm text-ink-soft mt-3 leading-relaxed"><AuthoredText text={a} /></p></details>)}</div><Link href="/contato" className="inline-block mt-5 text-teal"><InterfaceText message="screen.39aa161b9bb2" /></Link></section>
      <section className="bg-ink text-white rounded-2xl p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
        <div><p className="text-xs uppercase tracking-widest text-teal-soft"><InterfaceText message="screen.e06cfde77b19" /></p><h2 className="font-display text-3xl md:text-4xl mt-3"><InterfaceText message="screen.eb70eee6631b" /></h2><p className="text-white/70 mt-3 max-w-2xl"><InterfaceText message="screen.8ceaf1205b22" /></p></div>
        <Link href="/radar-demo" className="bg-white text-ink px-6 py-3 rounded-card font-medium text-center">Abrir Radar</Link>
      </section>
    </div>
  );
}
