// Legacy endpoint kept for compatibility with older Asaas webhook settings.
// All events now use the same authenticated, idempotent payment handler.
export { POST, runtime, dynamic } from "../../asaas/webhook/route";
