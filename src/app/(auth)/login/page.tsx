import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SESSION_EXPIRED_PARAM } from "@/server/auth/constants";
import { getViewer } from "@/server/auth/session";
import { safeNextPath } from "../_components/auth-errors";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  if (await getViewer()) redirect(safeNextPath(next));
  return <LoginForm next={next} sessionExpired={params[SESSION_EXPIRED_PARAM] === "berakhir"} />;
}
