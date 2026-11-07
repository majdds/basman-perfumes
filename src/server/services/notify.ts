import "server-only";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env } from "../env";
import { formatPrice } from "@/lib/money";
import type { Order } from "@/lib/types";

/**
 * OPTIONAL new-order e-mail via Amazon SES. Disabled unless both
 * SES_FROM_ADDRESS and ORDER_NOTIFY_EMAIL are set. The order system works
 * fully without it (the dashboard shows and sounds new orders).
 * The e-mail intentionally contains no customer phone or address — only the
 * order number and total, with a link to the dashboard.
 */
let ses: SESv2Client | null = null;

export async function notifyNewOrder(order: Order): Promise<void> {
  const e = env();
  if (!e.SES_FROM_ADDRESS || !e.ORDER_NOTIFY_EMAIL) return;
  ses ??= new SESv2Client({ region: e.AWS_REGION });
  const link = `${e.SITE_URL}/ar/admin/orders/${order.number}`;
  const body = `طلب جديد ${order.number}\nالإجمالي: ${formatPrice(order.total, "ar")}\n\n${link}\n\nNew order ${order.number} — total ${formatPrice(order.total, "en")}`;
  await Promise.race([
    ses.send(
      new SendEmailCommand({
        FromEmailAddress: e.SES_FROM_ADDRESS,
        Destination: { ToAddresses: [e.ORDER_NOTIFY_EMAIL] },
        Content: { Simple: { Subject: { Data: `طلب جديد ${order.number} — بسمان`, Charset: "UTF-8" }, Body: { Text: { Data: body, Charset: "UTF-8" } } } },
      }),
    ),
    new Promise((_, reject) => setTimeout(() => reject(new Error("ses timeout")), 3000)),
  ]);
}
