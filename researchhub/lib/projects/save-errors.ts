export const conflictMessage="Este trabalho foi alterado em outra aba ou dispositivo. Seu rascunho continua aqui. Confira a versão atual antes de tentar salvar novamente.";
export function saveError(error:{message?:string;code?:string}|null):Error {
 if(error?.message?.includes("SCHOLAR_SAVE_CONFLICT"))return new Error(conflictMessage);
 if(["PGRST202","42883","42703"].includes(error?.code||""))return new Error("A proteção de salvamento ainda não está instalada. A gestão precisa aplicar scholar_safe_saves.sql e depois você deve atualizar a página. Nenhum salvamento sem proteção foi tentado.");
 return new Error("Não foi possível salvar na conta. Seu rascunho continua nesta página; confira a conexão e tente novamente.");
}
