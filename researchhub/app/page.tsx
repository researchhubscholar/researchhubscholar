import Link from "next/link";

const steps = [
  { n: "01", title: "Descubra", text: "Comece com uma ideia ou deixe o sistema ajudar a encontrar um tema relevante." },
  { n: "02", title: "Valide", text: "Consulte literatura biomédica real e veja volume, tendência e tipos de evidência." },
  { n: "03", title: "Organize", text: "Salve artigos, construa sua matriz de evidências e registre a leitura crítica." },
  { n: "04", title: "Construa", text: "Transforme o tema em pergunta, objetivos, desenho, população e desfechos." },
];

import { supabaseServer } from "@/lib/supabase/server";
export default async function ScholarHomePage() {
  const db=await supabaseServer();const {data:{user}}=await db.auth.getUser();
  return (
    <div className="marketing-page">
      <section className="home-hero grid lg:grid-cols-[1.12fr_.88fr] gap-10 lg:gap-16 items-center py-8 md:py-14">
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
            <Link href="/radar-demo" className="bg-teal text-white px-6 py-3.5 rounded-card font-medium text-center hover:bg-teal/90 transition-colors">Experimentar o Radar</Link>
            <Link href={user ? "/dashboard" : "/cadastro"} className="bg-white border border-line text-ink px-6 py-3.5 rounded-card font-medium text-center hover:border-teal transition-colors">{user ? "Continuar no meu espaço" : "Criar meu espaço"}</Link>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-7 text-xs text-ink-soft">
            <span>✓ Busca real no PubMed</span><span>✓ Biblioteca científica</span><span>✓ Matriz de evidências</span><span>✓ Estrutura metodológica</span>
          </div>
        </div>

        <div className="home-preview bg-white border border-line rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-line flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest text-ink-soft">Radar científico</span>
            <span className="text-xs text-teal font-medium">Prévia da ferramenta</span>
          </div>
          <div className="p-6">
            <p className="text-xs text-ink-soft">Prévia ilustrativa do percurso</p>
            <h2 className="font-display text-2xl mt-1">Sua pergunta de pesquisa</h2>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="bg-paper border border-line rounded-card p-4"><p className="text-2xl font-semibold">PubMed</p><p className="text-xs text-ink-soft mt-1">artigos e fontes consultáveis</p></div>
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
        <div className="max-w-2xl"><p className="text-xs uppercase tracking-widest text-teal font-semibold">Como funciona</p><h2 className="font-display text-3xl md:text-4xl mt-3">Cada etapa dá direção à próxima.</h2></div>
        <div className="grid md:grid-cols-4 gap-4 mt-9">
          {steps.map((step) => <div key={step.n} className="home-stage bg-white border border-line rounded-card p-5"><span className="font-mono text-xs text-teal">{step.n}</span><h3 className="font-display text-xl mt-4">{step.title}</h3><p className="text-sm text-ink-soft leading-relaxed mt-2">{step.text}</p></div>)}
        </div>
      </section>

      <section className="mb-12 grid md:grid-cols-2 gap-5">
        <div className="bg-white border border-line rounded-2xl p-7"><p className="text-xs uppercase tracking-widest text-teal">Para quem está começando</p><h2 className="font-display text-3xl mt-3">Mais clareza para escolher e executar.</h2><p className="text-sm text-ink-soft mt-4 leading-relaxed">Organize seu TCC, artigo ou projeto de residência. Compare caminhos e desenvolva pergunta, objetivos, critérios e métodos no seu ritmo.</p><Link href="/cadastro" className="inline-block text-teal font-medium mt-5">Criar meu espaço de pesquisa →</Link></div>
        <div className="bg-teal-soft border border-teal/20 rounded-2xl p-7"><p className="text-xs uppercase tracking-widest text-teal">No contexto da residência</p><h2 className="font-display text-3xl mt-3">Decisões organizadas para discutir com o orientador.</h2><p className="text-sm text-ink-soft mt-4 leading-relaxed">Registre o raciocínio do projeto e exporte a estrutura do protocolo para revisão. Um percurso individual que pode apoiar o desenvolvimento acadêmico dos residentes.</p><Link href="/para-residencias" className="inline-block text-teal font-medium mt-5">Conhecer o acesso institucional →</Link></div>
      </section>
      <section className="border-t border-line py-12"><p className="text-xs uppercase tracking-widest text-teal">Ferramentas disponíveis</p><h2 className="font-display text-3xl mt-3">Um lugar para construir seu raciocínio científico.</h2><div className="grid md:grid-cols-3 gap-4 mt-6">{[["Radar","Explore PubMed e Crossref, navegue pelos artigos e busque referências por DOI ou PMID."],["Ideias guiadas","Defina problema, população, acesso a dados e prazo para comparar propostas de pesquisa."],["Biblioteca e matriz","Salve referências e registre objetivo, método, resultados e limitações de cada leitura."],["Meu projeto","Desenvolva pergunta, objetivos e métodos, confira a estrutura e exporte o protocolo."],["Histórico","Retome versões das ideias e seus projetos depois de entrar novamente na conta."],["Residências","Convites, turmas, franquia e acompanhamento dos projetos compartilhados pelo residente."]].map(([title,text])=><article key={title} className="home-feature bg-white border border-line p-5 rounded-2xl"><h3 className="font-display text-xl">{title}</h3><p className="text-sm text-ink-soft mt-3 leading-relaxed">{text}</p></article>)}</div><p className="mt-5 text-sm text-ink-soft">Estamos em fase de testes. A assistência por IA e a contratação com pagamento serão ativadas em uma próxima etapa. As ideias atuais usam regras e os dados do Radar vêm de bases científicas.</p><Link href="/como-funciona" className="text-teal inline-block mt-4">Conhecer o percurso completo →</Link></section>
      <section className="py-10"><h2 className="font-display text-3xl">Antes de começar</h2><div className="mt-5 space-y-3">{[["Posso experimentar sem criar uma conta?","Sim. O Radar demonstrativo permite consultar literatura real sem cadastro ou IA, com até três tentativas diárias por rede."],["O sistema produz um trabalho pronto?","O Scholar organiza as decisões e a leitura científica. Você continua responsável pela avaliação das fontes, pela autoria e pela discussão com o orientador."],["Meus dados ficam públicos?","Seus projetos, biblioteca e ideias são privados. No programa institucional, o coordenador acompanha a participação e apenas os projetos que você compartilhar explicitamente."],["Preciso pagar para testar agora?","O cadastro e as ferramentas desta fase de testes não abrem checkout nem geram cobrança. Os planos apresentados são a proposta para a futura licença anual."]].map(([q,a])=><details key={q} className="border border-line bg-white rounded-card p-5"><summary className="font-medium cursor-pointer">{q}</summary><p className="text-sm text-ink-soft mt-3 leading-relaxed">{a}</p></details>)}</div><Link href="/contato" className="inline-block mt-5 text-teal">Falar com a equipe →</Link></section>
      <section className="bg-ink text-white rounded-2xl p-8 md:p-12 grid md:grid-cols-[1fr_auto] gap-8 items-center">
        <div><p className="text-xs uppercase tracking-widest text-teal-soft">Pesquisa com direção</p><h2 className="font-display text-3xl md:text-4xl mt-3">Teste com um tema real da sua área.</h2><p className="text-white/70 mt-3 max-w-2xl">Explore sua área, encontre uma pergunta viável e reúna as decisões do protocolo em um só lugar. A literatura e a orientação científica acompanham esse percurso.</p></div>
        <Link href="/radar-demo" className="bg-white text-ink px-6 py-3 rounded-card font-medium text-center">Abrir Radar</Link>
      </section>
    </div>
  );
}
