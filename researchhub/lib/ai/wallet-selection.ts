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
