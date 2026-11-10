import type { Locale } from "./locale";

export function advisorCopy(locale: Locale) {
  const es = locale === "es";
  return {
    manuscript: es ? "Leer manuscrito y comentar" : "Ler manuscrito e comentar",
    free: es ? "La persona invitada solo necesita una cuenta gratuita y un correo confirmado. Puede leer y comentar, sin editar tu texto ni acceder a tu biblioteca privada, datos de pacientes o cuota de IA." : "A pessoa convidada só precisa de uma conta gratuita e e-mail confirmado. Ela pode ler e comentar, sem editar seu texto nem acessar sua biblioteca privada, dados de pacientes ou franquia de IA.",
    unavailable: es ? "No pudimos verificar las plazas de tutoría. Inténtalo de nuevo antes de crear una invitación." : "Não foi possível verificar as vagas de orientação. Tente novamente antes de criar um convite.",
    required: es ? "Invitar a tutores está disponible en Plus (1 por proyecto) y Premium (hasta 3)." : "Convidar orientadores está disponível no Plus (1 por projeto) e no Premium (até 3).",
    plans: es ? "Ver planes" : "Ver planos",
    full: es ? "No hay plazas libres. Puedes cancelar una invitación pendiente o retirar un acceso." : "Não há vagas livres. Você pode cancelar um convite pendente ou retirar um acesso.",
    preserved: es ? "Los comentarios se conservan. Si el plan vence, el acceso se suspende. Al reducir el plan, se mantienen las primeras plazas por fecha de aceptación; retira un acceso para elegir quién continúa." : "Os comentários são preservados. Se o plano expirar, o acesso é suspenso. Ao reduzir o plano, permanecem as primeiras vagas por data de aceite; retire um acesso para escolher quem continua.",
    cancelled: es ? "Invitación cancelada. La plaza está libre." : "Convite cancelado. A vaga está livre.",
    cancel: es ? "Cancelar invitación" : "Cancelar convite",
    pending: es ? "Invitaciones pendientes" : "Convites pendentes",
    anyEmail: es ? "Sin correo vinculado" : "Sem e-mail vinculado",
    expires: es ? "Vence el" : "Expira em",
    createSuccess: es ? "Invitación creada. Copia el código y envíalo a la persona invitada. No se mostrará de nuevo al salir de esta página." : "Convite criado. Copie o código e envie à pessoa convidada. Ele não será exibido novamente depois de sair desta tela.",
    redeemSuccess: es ? "Invitación aceptada. Abriendo el proyecto compartido…" : "Convite aceito. Abrindo o projeto compartilhado…",
    alreadyJoined: es ? "Ya tienes acceso a este proyecto. Pide al autor que cancele la invitación duplicada." : "Você já tem acesso a este projeto. Peça ao autor para cancelar o convite duplicado.",
    error: es ? "No se pudo completar la acción." : "Não foi possível concluir a ação.",
    slots: (active: number, pending: number, limit: number) => es ? `${active} vínculos · ${pending} invitaciones pendientes · límite de ${limit} por proyecto` : `${active} vínculos · ${pending} convites pendentes · limite de ${limit} por projeto`,
    benefit: (limit: number) => limit === 0 ? (es ? "Sin invitaciones a tutores" : "Sem convites para orientadores") : (es ? `Hasta ${limit} ${limit === 1 ? "tutor invitado" : "tutores invitados"} por proyecto` : `Até ${limit} ${limit === 1 ? "orientador convidado" : "orientadores convidados"} por projeto`),
    comparison: es ? "Tutores invitados por proyecto" : "Orientadores convidados por projeto",
    freeShort: es ? "Las personas invitadas leen y comentan con una cuenta gratuita; no necesitan comprar un plan." : "As pessoas convidadas leem e comentam com uma conta gratuita; não precisam comprar um plano.",
  };
}
