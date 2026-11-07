import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { listCategories } from "@/server/repos/products";
import { ProductForm } from "@/components/admin/ProductForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { dict } = await resolveLocale(params);
  return { title: dict.admin.productForm.newTitle };
}

export default async function NewProduct({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdminPage(locale);
  const categories = (await listCategories()).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-3xl">{dict.admin.productForm.newTitle}</h1>
      <ProductForm locale={locale} categories={categories} />
    </div>
  );
}
