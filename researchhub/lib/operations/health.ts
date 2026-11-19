export type HealthCount = number | null;
export type HealthMetrics = {
  ai24h: HealthCount; aiFailed24h: HealthCount; aiReserved24h: HealthCount;
  ai7d: HealthCount; aiFailed7d: HealthCount;
  paymentsPending24h: HealthCount; paymentsStale: HealthCount;
  paymentsActivated7d: HealthCount; appErrorsOpen: HealthCount;
};
export type HealthAlert={key:string;level:"critical"|"warning"|"info";label:string;detail:string};
export function operationalAlerts(m:HealthMetrics):HealthAlert[] {
  const alerts:HealthAlert[]=[];
  if(Object.values(m).some(v=>v===null))alerts.push({key:"unavailable",level:"warning",label:"Métricas incompletas",detail:"Uma ou mais consultas falharam. Dados indisponíveis não significam zero ocorrências."});
  if(m.ai24h!==null&&m.aiFailed24h!==null&&m.ai24h>=5&&m.aiFailed24h/m.ai24h>=0.2)
    alerts.push({key:"ai-failure",level:"critical",label:"Falhas de IA acima do limite",detail:"Pelo menos 20% das solicitações de IA falharam nas últimas 24 horas (mínimo de 5 solicitações)."});
  if(m.aiReserved24h!==null&&m.aiReserved24h>0)
    alerts.push({key:"ai-pending",level:"warning",label:"Operações de IA pendentes",detail:"Existem reservas ainda abertas. Confira se alguma geração está travada antes de intervir."});
  if(m.paymentsStale!==null&&m.paymentsStale>0)
    alerts.push({key:"payment-stale",level:"warning",label:"Pagamentos aguardando confirmação",detail:"Há checkouts pendentes há mais de uma hora. Confira os eventos do Asaas antes de qualquer ativação manual."});
  if(m.appErrorsOpen!==null&&m.appErrorsOpen>0)
    alerts.push({key:"app-errors",level:"warning",label:"Erros de aplicação em aberto",detail:"Consulte o painel de Operação para investigar os erros registrados."});
  if(!alerts.length)alerts.push({key:"none",level:"info",label:"Nenhum alerta pelos critérios configurados",detail:"O painel não substitui testes reais nem o monitoramento externo de serviços."});
  return alerts;
}
