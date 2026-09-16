import LogoutButton from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default function ContaSuspensaPage() {
  return (
    <div className="max-w-md">
      <p className="text-xs uppercase tracking-wide text-amber font-medium">Conta suspensa</p>
      <h1 className="font-display text-2xl text-ink mt-1">Sua conta está suspensa</h1>
      <p className="text-ink-soft mt-4 leading-relaxed">
        O administrador da sua universidade suspendeu o acesso dessa conta.
        Enquanto isso, você não consegue criar, editar ou interagir com
        conteúdo no ResearchHub.
      </p>
      <p className="text-ink-soft mt-4 leading-relaxed">
        Se acha que isso é um engano, entre em contato com a coordenação
        ou administração da sua universidade.
      </p>

      <div className="mt-8">
        <LogoutButton variant="button" />
      </div>
    </div>
  );
}
