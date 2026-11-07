import { notFound } from "next/navigation";
import { resolveLocale } from "@/server/page-helpers";
import { requireAdminPage } from "@/server/auth/guard";
import { getProduct, listCategories } from "@/server/repos/products";
import { pick } from "@/lib/i18n";
import { ProductForm } from "@/components/admin/ProductForm";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { dict } = await resolveLocale(params);
  return { title: dict.admin.productForm.editTitle };
}

export default async function EditProduct({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  await requireAdminPage(locale);
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) notFound();
  const [product, categories] = await Promise.all([getProduct(id), listCategories()]);
  if (!product) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-muted">{dict.admin.productForm.editTitle}</p>
      <h1 className="mb-6 text-3xl">{pick(product.name, locale)}</h1>
      <ProductForm key={product.version} locale={locale} categories={categories.sort((a, b) => a.sortOrder - b.sortOrder)} product={product} />
    </div>
  );
}
