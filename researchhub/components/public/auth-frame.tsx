"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { publicDesignCopy } from "@/lib/i18n/public-design-copy";
import { ResearchArt } from "./research-art";
export default function AuthFrame({variant,children}:{variant:"login"|"signup"|"recovery"|"reset";children:ReactNode}){
 const {locale}=useLanguage();const c=publicDesignCopy(locale);
 const title={login:c.loginTitle,signup:c.signupTitle,recovery:c.recoveryTitle,reset:c.resetTitle}[variant];
 const description={login:c.loginDescription,signup:c.signupDescription,recovery:c.recoveryDescription,reset:c.resetDescription}[variant];
 return <div className={`auth-shell public-redesign auth-${variant}`}><section className="auth-intro"><h1 className="auth-title">{title}</h1><p className="auth-description">{description}</p><ResearchArt variant={variant==="recovery"?"recovery":variant==="reset"?"reset":"books"}/></section><section className="auth-form-region">{children}{(variant==="login"||variant==="signup")?<p className="auth-invited">{c.invited}</p>:<Link href="/login" className="auth-back">← {c.backLogin}</Link>}</section></div>;
}
