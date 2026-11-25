"use client";

import { useState, type FormEvent } from "react";

const participants = [
  { id: "new", name: "Marina · Conta nova", personal: false },
  { id: "personal", name: "Rafael · Plano individual ativo", personal: true },
];

type Contract = { institution: string; cohort: string; seats: number; starts: Date; ends: Date; code: string };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const field = "mt-1 block w-full rounded-card border border-line bg-white px-3 py-2";
const primary = "rounded-card bg-teal px-4 py-3 font-medium text-white disabled:opacity-50";

function seatPrice(seats: number) {
  return seats < 100 ? 680 : seats < 300 ? 600 : seats <= 500 ? 530 : 480;
}

export default function InstitutionalPilot() {
  const [contract, setContract] = useState<Contract>();
  const [members, setMembers] = useState<string[]>([]);
  const [participant, setParticipant] = useState(participants[0].id);
  const [expired, setExpired] = useState(false);
  const [message, setMessage] = useState("");

  function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const institution = String(form.get("institution")).trim();
    const cohort = String(form.get("cohort")).trim();
    const seats = Number(form.get("seats"));
    if (!institution || !cohort || !Number.isInteger(seats) || seats < 1 || seats > 10000) return;
    const starts = new Date();
    const ends = new Date(starts);
    ends.setUTCFullYear(starts.getUTCFullYear() + 1);
    setContract({ institution, cohort, seats, starts, ends, code: "PILOTO-" + crypto.randomUUID().slice(0, 8).toUpperCase() });
    setMembers([]);
    setExpired(false);
    setMessage("");
  }

  function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contract || expired) {
      setMessage("Contrato fora da vigência.");
      return;
    }
    const code = String(new FormData(event.currentTarget).get("code")).trim().toUpperCase();
    if (code !== contract.code) {
      setMessage("Código inválido.");
      return;
    }
    if (members.includes(participant)) {
      setMessage("O participante já tem uma vaga nesta turma.");
      return;
    }
    if (members.length >= contract.seats) {
      setMessage("Todas as vagas foram preenchidas.");
      return;
    }
    setMembers(previous => [...previous, participant]);
    setMessage("Vaga institucional ativada na simulação.");
  }

  return <main className="mx-auto max-w-5xl space-y-8 px-5 py-10 text-ink">
    <header>
      <p className="text-sm text-teal">Simulação · dados fictícios</p>
      <h1 className="mt-2 font-display text-4xl">Piloto institucional</h1>
      <p className="mt-2 text-ink-soft">Simule a ativação de uma turma, o resgate de vagas e o acesso após o vencimento.</p>
    </header>
    <section className="rounded-2xl border border-line p-5">
      <h2 className="font-display text-2xl">Ativar turma</h2>
      <form onSubmit={activate} className="mt-4 grid gap-4 sm:grid-cols-3">
        <label>Instituição<input name="institution" required maxLength={200} defaultValue="Instituição-piloto" className={field} /></label>
        <label>Turma<input name="cohort" required maxLength={200} defaultValue="Turma de teste" className={field} /></label>
        <label>Vagas<input name="seats" required type="number" min={1} max={10000} defaultValue={2} className={field} /></label>
        <button className={primary} type="submit">{contract ? "Reiniciar simulação" : "Ativar contrato de teste"}</button>
      </form>
      {contract && <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        <div><dt>Instituição e turma</dt><dd>{contract.institution} · {contract.cohort}</dd></div>
        <div><dt>Preço anual por vaga</dt><dd>{currency.format(seatPrice(contract.seats))}</dd></div>
        <div><dt>Vigência comum</dt><dd>{date.format(contract.starts)} a {date.format(contract.ends)}</dd></div>
        <div><dt>Vagas ocupadas</dt><dd>{members.length} de {contract.seats}</dd></div>
        <div><dt>Código da turma</dt><dd><code>{contract.code}</code></dd></div>
        <div><dt>Franquia individual</dt><dd>6.000.000 tokens</dd></div>
      </dl>}
    </section>
    {contract && <>
      <section className="rounded-2xl border border-line p-5">
        <h2 className="font-display text-2xl">Resgatar vaga</h2>
        <form onSubmit={redeem} className="mt-4 grid items-end gap-4 sm:grid-cols-3">
          <label>Participante<select value={participant} onChange={event => setParticipant(event.target.value)} className={field}>
            {participants.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select></label>
          <label>Código institucional<input name="code" required className={field} /></label>
          <button className={primary} type="submit">Ativar vaga</button>
        </form>
        <p className="mt-3 text-sm" role="status">{message}</p>
      </section>
      <section className="rounded-2xl border border-line p-5">
        <h2 className="font-display text-2xl">Usuários e acessos</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead><tr><th className="p-2">Participante</th><th className="p-2">Acesso em uso</th><th className="p-2">Vínculo institucional</th><th className="p-2">Plano individual</th></tr></thead>
            <tbody>{participants.map(person => {
              const linked = members.includes(person.id);
              return <tr key={person.id} className="border-t border-line">
                <td className="p-2">{person.name}</td>
                <td className="p-2">{linked && !expired ? "Institucional" : person.personal ? "Individual" : "Sem licença"}</td>
                <td className="p-2">{linked ? (expired ? "Encerrado em " : "Ativo até ") + date.format(contract.ends) : "Sem vínculo"}</td>
                <td className="p-2">{person.personal ? "Plus · ativo" : "Sem plano"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <button type="button" className="mt-4 rounded-card border border-teal px-4 py-2 text-teal" onClick={() => { setExpired(value => !value); setMessage(""); }}>
          {expired ? "Voltar à vigência ativa" : "Simular vencimento institucional"}
        </button>
      </section>
    </>}
  </main>;
}
