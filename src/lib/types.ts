import type { Agorot } from "./money";
import type { OrderStatus } from "./order-status";

export type Locale = "ar" | "en";
export type Gender = "men" | "women" | "unisex";

export interface LocalizedText {
  ar: string;
  en: string;
}

export interface ProductImage {
  /** Storage key prefix, e.g. "products/3f2c…"; variants are "<key>-400.webp" etc. */
  key: string;
  width: number;
  height: number;
  alt?: LocalizedText;
}

export interface ProductVariant {
  id: string;
  /** e.g. { ar: "100 مل", en: "100 ml" }. Optional for single-variant products. */
  label: LocalizedText;
  sizeMl?: number | null;
  sku?: string | null;
  price: Agorot;
  salePrice?: Agorot | null;
  trackStock: boolean;
  stock?: number | null;
}

export type ProductStatus = "active" | "archived";

export interface Product {
  id: string;
  slug: string;
  name: LocalizedText;
  brand: string;
  description: LocalizedText;
  categoryId: string | null;
  gender: Gender | null;
  /** Fragrance family / type, e.g. { ar: "شرقي", en: "Oriental" }. Optional. */
  fragranceFamily: LocalizedText | null;
  images: ProductImage[];
  variants: ProductVariant[];
  featured: boolean;
  /** Owner switch to hide the "add to cart" button without archiving. */
  available: boolean;
  status: ProductStatus;
  /** Demo products are clearly marked and can be removed in one click. */
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Category {
  id: string;
  slug: string;
  name: LocalizedText;
  sortOrder: number;
  isDemo: boolean;
}

export interface DeliveryArea {
  id: string;
  name: LocalizedText;
  fee: Agorot;
  freeOver: Agorot | null;
  active: boolean;
}

export interface StoreSettings {
  phone: string; // E.164
  whatsapp: string; // E.164
  addressText: LocalizedText;
  mapsUrl: string | null;
  hours: LocalizedText | null;
  instagramUrl: string;
  facebookUrl: string;
  deliveryAreas: DeliveryArea[];
  lowStockThreshold: number;
  /** Customer personal data is anonymised on orders older than this (days). 0 = keep. */
  retentionDays: number;
  orderingEnabled: boolean;
  heroImageKey: string | null;
  announcement: LocalizedText | null;
  updatedAt: string;
}

export interface OrderLine {
  productId: string;
  variantId: string;
  slug: string;
  name: LocalizedText;
  variantLabel: LocalizedText;
  brand: string;
  imageKey: string | null;
  unitPrice: Agorot;
  listPrice: Agorot;
  quantity: number;
  lineTotal: Agorot;
  stockTracked: boolean;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
  by: string; // "customer" or admin username
  note?: string;
}

export interface Order {
  number: string;
  status: OrderStatus;
  locale: Locale;
  customer: {
    name: string;
    phone: string; // E.164
    phoneNational: string;
    email: string | null;
  };
  delivery: {
    areaId: string;
    areaName: LocalizedText;
    address: string;
    notes: string | null;
  };
  lines: OrderLine[];
  subtotal: Agorot;
  deliveryFee: Agorot;
  total: Agorot;
  paymentMethod: "cod";
  createdAt: string;
  updatedAt: string;
  history: OrderStatusEvent[];
  /** SHA-256 of the customer's confirmation-page token. */
  viewTokenHash: string;
  anonymized: boolean;
  seenByAdmin: boolean;
}

export type AdminRole = "owner" | "staff";

export interface AdminUser {
  username: string;
  displayName: string;
  role: AdminRole;
  passwordHash: string;
  createdAt: string;
  passwordChangedAt: string;
  disabled: boolean;
}
