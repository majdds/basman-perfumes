import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { getSettings } from "@/server/repos/settings";
import { PasswordForm, SettingsForm } from "@/components/admin/SettingsForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { dict } = await resolveLocale(params);
  return { title: dict.admin.settings.title };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const session = await requireAdminPage(locale);
  const settings = await getSettings();
  const t = dict.admin.settings;
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <h1 className="text-3xl">{t.title}</h1>
      {session.role === "owner" ? <SettingsForm settings={settings} /> : <p className="alert alert-info">{t.ownerOnly}</p>}
      <section className="rounded-[var(--radius-lg)] border border-sand bg-white p-5 sm:p-7">
        <h2 className="mb-5 text-xl">{t.account}</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
