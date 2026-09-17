import { escapeHtml } from '../../core/email/html';
import type { EmailPayload } from '../../core/email/email.service';

interface OrderConfirmationData {
  locale?: 'en' | 'fr';
  orderId: string;
  orderNumber?: string;
  shippingCents?: number;
  customerEmail: string;
  customerName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
    size?: string;
    color?: string;
  }>;
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  totalCents: number;
  shippingAddress: {
    city: string;
    province?: string;
    country: string;
  };
}

export function orderConfirmationPayload(data: OrderConfirmationData): EmailPayload {
  const locale = data.locale === 'fr' ? 'fr' : 'en';
  const copy = locale === 'fr'
    ? { title: 'Confirmation de commande', thanks: 'Merci pour votre commande', hello: 'Bonjour', received: 'votre paiement est confirmé. Votre commande a été reçue et va être préparée.', number: 'Numéro de commande', item: 'Article', qty: 'Qté', price: 'Prix', subtotal: 'Sous-total', discount: 'Remise', shipping: 'Livraison', destination: 'Destination de livraison', rights: 'Tous droits réservés.' }
    : { title: 'Order Confirmation', thanks: 'Thank you for your order', hello: 'Hi', received: 'your payment is confirmed. Your order has been received and will be prepared.', number: 'Order Number', item: 'Item', qty: 'Qty', price: 'Price', subtotal: 'Subtotal', discount: 'Discount', shipping: 'Shipping', destination: 'Shipping To', rights: 'All rights reserved.' };
  const formatCents = (cents: number) => new Intl.NumberFormat(locale === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'code' }).format(cents / 100);
  const orderRef = escapeHtml(data.orderNumber ?? data.orderId);

  const itemRows = data.items
    .map((item) => {
      const variant = [item.size, item.color].filter(Boolean).join(' / ');
      const variantLabel = variant ? ` <span style="color:#737373;">(${escapeHtml(variant)})</span>` : '';

      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f5;font-size:14px;color:#171717;">
            ${escapeHtml(item.name)}${variantLabel}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f5;font-size:14px;color:#171717;text-align:center;">
            ${item.quantity}
          </td>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f5;font-size:14px;color:#171717;text-align:right;">
            ${formatCents(item.unitPriceCents * item.quantity)}
          </td>
        </tr>`;
    })
    .join('');

  const discountRow = data.discountCents > 0
    ? `
      <tr>
        <td colspan="2" style="padding:8px 0;font-size:14px;color:#15803d;">
          ${copy.discount}${data.couponCode ? ` (${escapeHtml(data.couponCode)})` : ''}
        </td>
        <td style="padding:8px 0;font-size:14px;color:#15803d;text-align:right;">
          -${formatCents(data.discountCents)}
        </td>
      </tr>`
    : '';

  const locationParts = [
    data.shippingAddress.city,
    data.shippingAddress.province,
    data.shippingAddress.country,
  ].filter(Boolean);

  const html = `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${copy.title}</title>
</head>
<body style="margin:0;padding:0;overflow-wrap:anywhere;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:24px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;width:100%;max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#171717;padding:32px 24px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:300;letter-spacing:4px;color:#c8a97e;">
                BLE$$ P
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:40px 40px 24px;">
              <h2 style="margin:0;font-size:22px;font-weight:300;color:#171717;">
                ${copy.thanks}
              </h2>
              <p style="margin:12px 0 0;font-size:14px;color:#737373;line-height:1.6;">
                ${copy.hello} ${escapeHtml(data.customerName)}, ${copy.received}
              </p>
            </td>
          </tr>

          <!-- Order Number -->
          <tr>
            <td style="padding:0 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:16px 20px;">
                <tr>
                  <td style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#737373;">
                    ${copy.number}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:8px;font-size:16px;font-weight:600;color:#171717;font-family:monospace;overflow-wrap:anywhere;">
                    #${orderRef}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding:0 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;">
                <tr>
                  <th style="width:55%;padding:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#737373;text-align:left;border-bottom:1px solid #e5e5e5;">
                    ${copy.item}
                  </th>
                  <th style="width:10%;padding:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#737373;text-align:center;border-bottom:1px solid #e5e5e5;">
                    ${copy.qty}
                  </th>
                  <th style="width:35%;padding:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#737373;text-align:right;border-bottom:1px solid #e5e5e5;">
                    ${copy.price}
                  </th>
                </tr>
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td colspan="2" style="padding:8px 0;font-size:14px;color:#737373;">
                    ${copy.subtotal}
                  </td>
                  <td style="padding:8px 0;font-size:14px;color:#171717;text-align:right;">
                    ${formatCents(data.subtotalCents)}
                  </td>
                </tr>
                ${discountRow}
                <tr><td colspan="2">${copy.shipping}</td><td style="text-align:right">${formatCents(data.shippingCents ?? 0)}</td></tr>
                <tr>
                  <td colspan="2" style="padding:12px 0 0;font-size:16px;font-weight:600;color:#171717;border-top:1px solid #e5e5e5;">
                    Total
                  </td>
                  <td style="padding:12px 0 0;font-size:16px;font-weight:600;color:#171717;text-align:right;border-top:1px solid #e5e5e5;">
                    ${formatCents(data.totalCents)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Shipping To -->
          <tr>
            <td style="padding:0 24px 40px;">
              <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#737373;">
                ${copy.destination}
              </p>
              <p style="margin:0;font-size:14px;color:#171717;line-height:1.6;">
                ${escapeHtml(data.customerName)}<br/>
                ${escapeHtml(locationParts.join(', '))}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#171717;padding:24px 24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a3a3a3;letter-spacing:1px;">
                &copy; ${new Date().getFullYear()} BLE$$ P. ${copy.rights}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    to: data.customerEmail,
    subject: `BLE$$ P: ${copy.title} #${data.orderNumber ?? data.orderId}`,
    html,
  };
}
