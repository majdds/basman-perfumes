import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { listCategories } from "@/server/repos/products";
import { CategoryManager } from "@/components/admin/CategoryManager";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { dict } = await resolveLocale(params);
  return { title: dict.admin.categories.title };
}

export default async function CategoriesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const session = await requireAdminPage(locale);
  const categories = (await listCategories()).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-3xl">{dict.admin.categories.title}</h1>
      <CategoryManager categories={categories} canDelete={session.role === "owner"} />
    </div>
  );
}
