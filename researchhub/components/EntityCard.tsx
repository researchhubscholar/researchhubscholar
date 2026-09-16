import Link from "next/link";

type Props = {
  href: string;
  eyebrow: string; // tipo da entidade: "Professor", "Projeto", "Linha de Pesquisa"...
  title: string;
  subtitle?: string | null;
  tags?: string[];
  badge?: { label: string; tone: "teal" | "amber" };
  secondaryHref?: string;
  secondaryLabel?: string;
};

export default function EntityCard({
  href,
  eyebrow,
  title,
  subtitle,
  tags,
  badge,
  secondaryHref,
  secondaryLabel,
}: Props) {
  return (
    <div className="thread pl-8 relative group">
      <span className="absolute left-0 top-1.5 w-[9px] h-[9px] rounded-full bg-teal group-hover:scale-125 transition-transform" />
      <div className="pb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase tracking-wide text-teal font-medium">{eyebrow}</p>
          <div className="flex items-center gap-3">
            {secondaryHref && (
              <Link href={secondaryHref} className="text-xs text-ink-soft hover:text-teal font-medium">
                {secondaryLabel ?? "Editar"}
              </Link>
            )}
            {badge && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  badge.tone === "teal" ? "bg-teal-soft text-teal" : "bg-amber-soft text-amber"
                }`}
              >
                {badge.label}
              </span>
            )}
          </div>
        </div>
        <Link href={href} className="block">
          <h3 className="font-display text-lg text-ink mt-1 group-hover:text-teal transition-colors">
            {title}
          </h3>
          {subtitle && <p className="text-sm text-ink-soft mt-1">{subtitle}</p>}
        </Link>
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((t) => (
              <span key={t} className="text-xs font-mono text-ink-soft bg-white border border-line px-2 py-0.5 rounded-full">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
