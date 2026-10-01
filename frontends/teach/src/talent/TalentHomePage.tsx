import { useAuth } from "../auth/context";
import { talent } from "../i18n/talent";
import { useLocale } from "../i18n/useLocale";
import { TalentChallengeCards } from "../ui/TalentChallengeCards";

export function TalentHomePage() {
  const { locale } = useLocale();
  const { user } = useAuth();
  const t = talent[locale];
  return <main className="talent-hall">
    <h1 className="talent-visually-hidden">{t.hall}</h1>
    <TalentChallengeCards t={t} />
    {!user && <p className="talent-login-note">{t.loginNote}</p>}
  </main>;
}
