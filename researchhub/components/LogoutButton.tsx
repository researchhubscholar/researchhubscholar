"use client";

import { signOutAction } from "@/lib/auth";

export default function LogoutButton({ variant = "text" }: { variant?: "text" | "button" }) {
  return (
    <button
      onClick={() => signOutAction()}
      className={
        variant === "button"
          ? "text-sm font-medium text-white bg-teal px-4 py-2 rounded-card hover:bg-teal/90 transition-colors"
          : "hover:text-teal transition-colors"
      }
    >
      Sair
    </button>
  );
}
