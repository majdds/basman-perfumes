import type { Metadata } from "next";
import { pageMetadata, resolveLocale } from "@/server/page-helpers";
import { getCatalog } from "@/server/services/catalog";
import { formatPhoneForDisplay, parsePalestinianPhone } from "@/lib/phone";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale, dict } = await resolveLocale(params);
  return pageMetadata({ locale, path: "/privacy", title: dict.privacy.title, description: dict.privacy.title });
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale, dict } = await resolveLocale(params);
  const { settings } = await getCatalog();
  const phone = formatPhoneForDisplay(parsePalestinianPhone(settings.phone)?.national ?? "");
  const years = settings.retentionDays ? Math.round(settings.retentionDays / 365) : 0;
  return (
    <article className="container-page prose-basman max-w-3xl py-12 md:py-16">
      <h1 className="text-4xl">{dict.privacy.title}</h1>
      {locale === "ar" ? (
        <>
          <p>نحترم خصوصيتكم. توضح هذه الصفحة البيانات التي نجمعها عند الطلب من موقع بسمان للعطور وكيف نستخدمها.</p>
          <h2>ما البيانات التي نجمعها؟</h2>
          <ul>
            <li>عند الطلب: الاسم، رقم الهاتف، المنطقة والعنوان، ملاحظات التوصيل، والبريد الإلكتروني إن أدخلتموه.</li>
            <li>محتويات سلة التسوق تُحفظ على جهازكم فقط (أرقام المنتجات والكميات)، ولا تحتوي على أي بيانات شخصية.</li>
            <li>لا نجمع أي بيانات بنكية أو بطاقات دفع — الدفع نقداً عند الاستلام.</li>
          </ul>
          <h2>كيف نستخدمها؟</h2>
          <p>نستخدم بياناتكم فقط لتأكيد الطلب والتواصل معكم وتوصيله. لا نبيع بياناتكم ولا نشاركها مع أي جهة، باستثناء ما يلزم لتوصيل الطلب.</p>
          <h2>ملفات تعريف الارتباط (الكوكيز) والتتبع</h2>
          <p>لا نستخدم أدوات تتبع إعلانية أو تحليلات. نستخدم ملفات ضرورية فقط: لحفظ اللغة المختارة، ولإظهار صفحة تأكيد طلبكم على جهازكم.</p>
          <h2>مدة الاحتفاظ بالبيانات</h2>
          <p>{years ? `تُحذف بياناتكم الشخصية من الطلبات المكتملة بعد حوالي ${years} ${years === 1 ? "سنة" : "سنوات"}، ونحتفظ فقط بتفاصيل المنتجات والمبالغ لأغراض المحاسبة.` : "نحتفظ ببيانات الطلبات للمدة اللازمة لخدمتكم وللأغراض المحاسبية."}</p>
          <h2>حقوقكم</h2>
          <p>يمكنكم طلب الاطلاع على بياناتكم أو تصحيحها أو حذفها بالتواصل معنا{phone ? ` على الرقم ${phone}` : ""}.</p>
        </>
      ) : (
        <>
          <p>We respect your privacy. This page explains what data we collect when you order from the Basman Perfumes website and how we use it.</p>
          <h2>What we collect</h2>
          <ul>
            <li>When you order: your name, phone number, area and address, delivery notes, and your email if you provide it.</li>
            <li>Your shopping cart is stored only on your device (product ids and quantities) and contains no personal data.</li>
            <li>We never collect bank or card details — you pay in cash on delivery.</li>
          </ul>
          <h2>How we use it</h2>
          <p>Only to confirm, communicate about and deliver your order. We do not sell or share your data, except as needed to deliver your order.</p>
          <h2>Cookies and tracking</h2>
          <p>We do not use advertising trackers or analytics. We only use essential cookies: to remember your language and to show your order confirmation on your device.</p>
          <h2>Retention</h2>
          <p>{years ? `Personal data is removed from completed orders after about ${years} year${years === 1 ? "" : "s"}; we keep only product and amount details for accounting.` : "We keep order data for as long as needed to serve you and for accounting purposes."}</p>
          <h2>Your rights</h2>
          <p>You can ask to see, correct or delete your data by contacting us{phone ? ` on ${phone}` : ""}.</p>
        </>
      )}
    </article>
  );
}
