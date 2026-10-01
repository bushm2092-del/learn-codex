import { useSearchParams } from "react-router-dom";
import { isTalentDestination, loginDestination } from "../auth/destination";
import { AppShell } from "./AppShell";
import { TalentShell } from "./TalentShell";

export function LoginShell() {
  const [params] = useSearchParams();
  return isTalentDestination(loginDestination(params.get("next"))) ? <TalentShell loginPage /> : <AppShell />;
}
