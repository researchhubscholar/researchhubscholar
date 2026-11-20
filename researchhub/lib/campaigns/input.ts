import { parsePhoneNumberFromString } from "libphonenumber-js";
import { campaignPhoneCountries } from "./phone-countries";

export const campaignIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const pesquisa100 = {
  discountCents: 10000,
  title: "Sua jornada científica começa com uma oportunidade especial.",
  subtitle: "Cadastre-se e receba R$ 100 de desconto para começar a desenvolver seu trabalho científico com o ResearchHub.",
};

export type LeadInput = {
  name: string;
  email: string;
  phone: string;
  marketing: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

function attribution(value: unknown) {
  // Limit attribution to campaign labels. Discard values containing contact details or URLs.
  return typeof value === "string" && /^[a-z0-9][a-z0-9_.-]{0,79}$/i.test(value) &&
    !/\d{7}/.test(value) ? value : null;
}

export function parseLead(body: Record<string, unknown>): LeadInput | string {
  const name = typeof body.name === "string" ? body.name.trim().replace(/ +/g, " ") : "";
  if (name.length < 3 || name.length > 120 || !/^\p{L}[\p{L}\p{M}\p{Zs}.'’\-]+$/u.test(name)) {
    return "Informe seu nome completo.";
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length < 6) {
    return "Informe um endereço de e-mail válido.";
  }

  const selected = campaignPhoneCountries.find(({ country }) => country === (body.phone_country ?? "BR"));
  if (!selected) return "Selecione o país do seu WhatsApp.";

  const formatted = typeof body.phone === "string" ? body.phone.trim() : "";
  const phone = formatted.length <= 32 && /^\+?[\d ().-]+$/.test(formatted)
    ? parsePhoneNumberFromString(formatted, { defaultCountry: selected.country, extract: false })
    : undefined;
  if (!phone || (phone.country === "BR"
    ? !/^[1-9]\d[2-9]\d{7,8}$/.test(phone.nationalNumber)
    : !phone.isValid())) {
    return "Confira o número de WhatsApp e inclua o código de área, se houver.";
  }

  return {
    name,
    email,
    phone: phone.number,
    marketing: body.marketing === true,
    utmSource: attribution(body.utm_source),
    utmMedium: attribution(body.utm_medium),
    utmCampaign: attribution(body.utm_campaign),
  };
}
