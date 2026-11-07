export const deletionBlockerLabels:Record<string,string>={
 RESTRICTED_DEPENDENCIES:"Há registros com restrições de remoção. A gestão precisa revisar esses vínculos antes de excluir a conta.",
 IDENTITY_REVIEW_REQUIRED:"A conta não tem um e-mail atual para confirmação. A identidade precisa de conferência administrativa.",
 PLATFORM_STAFF:"A conta tem um papel de gestão da plataforma. Revise esse vínculo antes de excluir.",
 SOLE_DIRECTOR:"A conta é o único diretor ativo de uma instituição. Defina outro responsável antes de excluir.",
 ACTIVE_OPERATION:"Há uma operação de IA em andamento. Aguarde sua conclusão antes de excluir.",
 STORAGE_OBJECTS:"Há arquivos de propriedade desta conta no Storage. Eles precisam ser tratados antes da exclusão.",
 STORAGE_REVIEW_REQUIRED:"A propriedade de arquivos precisa de conferência administrativa.",
};
export function deletionError(error:{message?:string;code?:string}|null){
 const raw=error?.message||"";
 if(raw.includes("DELETION_BUSY"))return "A exclusão já foi iniciada. Use Verificar resultado; não envie outra execução.";
 if(raw.includes("DELETION_TOO_EARLY"))return "O prazo de segurança de sete dias ainda não terminou.";
 if(raw.includes("DELETION_CONFIRMATION_REQUIRED"))return "Digite o e-mail atual da conta escolhida para confirmar.";
 if(raw.includes("DELETION_NOT_PENDING"))return "A solicitação foi cancelada ou não está mais pendente. Atualize a revisão.";
 if(raw.includes("DELETION_SELF_BLOCKED"))return "Você não pode excluir sua própria conta por este painel.";
 if(raw.includes("DELETION_BLOCKED"))return "Há impedimentos para excluir esta conta. Atualize a revisão e confira os vínculos e arquivos.";
 if(["PGRST202","42883","42P01","PGRST205"].includes(error?.code||""))return "A gestão de exclusões ainda não está instalada neste ambiente.";
 return "Não foi possível confirmar o resultado. Atualize o painel e use Verificar resultado antes de outra ação.";
}
export function deletionResultMessage(state:string){
 if(state==="completed")return "Exclusão confirmada no banco. O comprovante mínimo foi preservado, sem o conteúdo científico da conta.";
 if(state==="failed")return "A exclusão foi recusada. A conta continua disponível e a solicitação voltou a pendente. Revise os impedimentos antes de tentar novamente.";
 return "O processamento ainda não foi confirmado. Use Verificar resultado. Por segurança, outra execução e o cancelamento ficam bloqueados até a conferência.";
}
