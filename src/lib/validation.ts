import { z } from "zod";
import { parsePalestinianPhone } from "./phone";
import { MAX_LINES_PER_ORDER, MAX_QTY_PER_LINE } from "./pricing";
import { SLUG_PATTERN } from "./slug";

// Our Content-Security-Policy forbids eval(); tell zod not to try JIT compilation.
z.config({ jitless: true });

/**
 * Validation error messages are translation KEYS (see i18n dictionaries),
 * so the same schema serves both languages on client and server.
 */
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "invalid");

// Strip control characters (except newlines in multi-line fields) and trim.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();

const text = (min: number, max: number) =>
  z
    .string()
    .transform(clean)
    .pipe(z.string().min(min, min <= 1 ? "required" : "tooShort").max(max, "tooLong"));

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v == null ? null : clean(v) || null))
    .pipe(z.string().max(max, "tooLong").nullable());

export const phoneSchema = z
  .string()
  .max(30, "invalidPhone")
  .refine((v) => parsePalestinianPhone(v) !== null, "invalidPhone");

export const cartItemSchema = z
  .object({
    productId: id,
    variantId: id,
    quantity: z.number().int().min(1, "invalidQuantity").max(MAX_QTY_PER_LINE, "invalidQuantity"),
  })
  .strict();

export const cartQuoteSchema = z
  .object({
    items: z.array(cartItemSchema).max(MAX_LINES_PER_ORDER, "tooManyItems"),
    areaId: id.optional().nullable(),
  })
  .strict();

export const checkoutCustomerSchema = z
  .object({
    name: text(2, 80),
    phone: phoneSchema,
    areaId: id,
    address: text(5, 300),
    notes: optionalText(500),
    email: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v.trim() : null))
      .pipe(z.email("invalidEmail").max(120, "tooLong").nullable()),
  })
  .strict();

export const placeOrderSchema = z
  .object({
    customer: checkoutCustomerSchema,
    items: z.array(cartItemSchema).min(1, "emptyCart").max(MAX_LINES_PER_ORDER, "tooManyItems"),
    locale: z.enum(["ar", "en"]),
    // Honeypot: real people never see or fill this field.
    website: z.string().max(0, "spam").optional(),
  })
  .strict();
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9-]{16,64}$/);

// ─── Admin ────────────────────────────────────────────────────────────────
const localized = (min: number, max: number) => z.object({ ar: text(min, max), en: text(min, max) }).strict();
const localizedOptional = (max: number) =>
  z.object({ ar: optionalText(max), en: optionalText(max) }).strict();

const agorot = z.number().int().min(0).max(100_000_000);

export const variantInputSchema = z
  .object({
    id: id.optional(),
    label: z.object({ ar: optionalText(40), en: optionalText(40) }).strict(),
    sizeMl: z.number().int().min(1).max(5000).nullable().optional(),
    sku: optionalText(40),
    price: agorot.min(1, "required"),
    salePrice: agorot.nullable().optional(),
    trackStock: z.boolean(),
    stock: z.number().int().min(0).max(100_000).nullable().optional(),
  })
  .strict()
  .refine((v) => v.salePrice == null || v.salePrice === 0 || v.salePrice < v.price, {
    message: "saleMustBeLower",
    path: ["salePrice"],
  });

export const productInputSchema = z
  .object({
    name: z.object({ ar: text(2, 120), en: optionalText(120) }).strict(),
    slug: z.string().max(80).regex(SLUG_PATTERN, "invalidSlug").optional().nullable(),
    brand: text(1, 60),
    description: localizedOptional(4000),
    categoryId: id.nullable(),
    gender: z.enum(["men", "women", "unisex"]).nullable(),
    fragranceFamily: localizedOptional(40),
    images: z
      .array(
        z
          .object({
            key: z.string().regex(/^products\/[a-f0-9-]{36}$/),
            width: z.number().int().min(1).max(10000),
            height: z.number().int().min(1).max(10000),
          })
          .strict(),
      )
      .max(8, "tooManyImages"),
    variants: z.array(variantInputSchema).min(1, "required").max(10),
    featured: z.boolean(),
    available: z.boolean(),
  })
  .strict();
export type ProductInput = z.infer<typeof productInputSchema>;

export const categoryInputSchema = z
  .object({
    name: localized(2, 60),
    sortOrder: z.number().int().min(0).max(999),
  })
  .strict();

export const deliveryAreaInputSchema = z
  .object({
    id: id.optional(),
    name: localized(2, 60),
    fee: agorot,
    freeOver: agorot.nullable(),
    active: z.boolean(),
  })
  .strict();

const httpsUrl = z
  .string()
  .max(500)
  .url("invalidUrl")
  .refine((u) => u.startsWith("https://"), "invalidUrl");

export const settingsInputSchema = z
  .object({
    phone: phoneSchema,
    whatsapp: phoneSchema,
    addressText: localized(2, 200),
    mapsUrl: httpsUrl.nullable(),
    hours: localizedOptional(300),
    instagramUrl: httpsUrl,
    facebookUrl: httpsUrl,
    deliveryAreas: z.array(deliveryAreaInputSchema).min(1, "required").max(40),
    lowStockThreshold: z.number().int().min(0).max(1000),
    retentionDays: z.number().int().min(0).max(3650),
    orderingEnabled: z.boolean(),
    heroImageKey: z.string().regex(/^products\/[a-f0-9-]{36}$/).nullable(),
    announcement: localizedOptional(160),
  })
  .strict();
export type SettingsInput = z.infer<typeof settingsInputSchema>;

export const loginSchema = z
  .object({
    username: z.string().trim().toLowerCase().min(1).max(40),
    password: z.string().min(1).max(200),
  })
  .strict();

/**
 * Password policy (NIST SP 800-63B aligned): length matters more than
 * composition. At least 12 characters, not purely one repeated character,
 * and not a known-weak password.
 */
const WEAK = new Set(["123456789012", "password1234", "basman123456", "qwertyuiop12", "000000000000", "111111111111"]);
export const newPasswordSchema = z
  .string()
  .min(12, "passwordTooShort")
  .max(128, "tooLong")
  .refine((p) => !/^(.)\1+$/.test(p), "passwordTooWeak")
  .refine((p) => !WEAK.has(p.toLowerCase()), "passwordTooWeak")
  .refine((p) => /[^\d]/.test(p), "passwordTooWeak");

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: newPasswordSchema })
  .strict();

export const statusUpdateSchema = z
  .object({
    status: z.enum(["new", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]),
    note: optionalText(300),
  })
  .strict();

export const orderListQuerySchema = z.object({
  status: z.enum(["all", "open", "new", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"]).default("all"),
  q: z.string().max(40).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cursor: z.string().max(500).optional(),
});
