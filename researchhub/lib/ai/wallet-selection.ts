export function requestedWallet(request: Request, userId: string): string | null {
  const cookie = (request.headers.get("cookie") || "").split(";").map(item => item.trim()).find(item => item.startsWith(`scholar-wallet-${userId}=`));
  if (!cookie) return null;
  const id = cookie.slice(cookie.indexOf("=") + 1);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Seleção de franquia inválida. Abra Minha licença e selecione novamente.");
  return id;
}

export function chooseWallet<T extends { wallet: { id: string } }>(available: T[], selected: string | null): T {
  if (selected) {
    const found = available.find(item => item.wallet.id === selected);
    if (!found) throw new Error("A franquia selecionada está indisponível ou sem saldo. Abra Minha licença para escolher outra; nenhum outro saldo foi usado.");
    return found;
  }
  if (available.length > 1) throw new Error("Escolha a franquia pessoal ou institucional em Minha licença antes de usar IA.");
  if (!available.length) throw new Error("Franquia indisponível ou insuficiente para esta operação.");
  return available[0];
}

type AdmissionLicense={status:string;starts_at:string;ends_at:string};
type AdmissionWallet={id:string;allowance:number;used:number;reserved:number;unlimited?:boolean};
export function walletsForOperation<T extends {wallet:AdmissionWallet;license?:AdmissionLicense}>(rows:T[],selected:string|null,required:number,now=Date.now()):T[]{
 const eligible=rows.filter(r=>r.license&&['active','trial'].includes(r.license.status)&&Date.parse(r.license.starts_at)<=now&&Date.parse(r.license.ends_at)>=now);
 const picked=selected?rows.find(r=>r.wallet.id===selected):rows.length===1?rows[0]:undefined;
 if(picked&&!eligible.includes(picked))throw Error('A licença desta franquia está inativa ou fora da validade. Abra Minha licença para conferir.');
 const available=eligible.filter(r=>r.wallet.unlimited===true||r.wallet.allowance-r.wallet.used-r.wallet.reserved>=required);
 const insufficient=selected?eligible.find(r=>r.wallet.id===selected):eligible.length===1&&!available.length?eligible[0]:undefined;
 if(insufficient&&!available.includes(insufficient)){const balance=Math.max(0,insufficient.wallet.allowance-insufficient.wallet.used-insufficient.wallet.reserved);throw Error(`Você tem ${balance.toLocaleString('pt-BR')} tokens disponíveis; esta operação exige uma reserva de ${required.toLocaleString('pt-BR')}. Abra Minha licença para conferir sua franquia.`);}
 return available;
}
