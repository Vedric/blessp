import { emailService } from '../../core/email/email.service';

interface OrderConfirmationData {
  orderId: string;
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

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export async function sendOrderConfirmation(data: OrderConfirmationData): Promise<void> {
  const orderRef = data.orderId.slice(0, 8).toUpperCase();

  const itemRows = data.items
    .map((item) => {
      const variant = [item.size, item.color].filter(Boolean).join(' / ');
      const variantLabel = variant ? ` <span style="color:#737373;">(${variant})</span>` : '';

      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f5;font-size:14px;color:#171717;">
            ${item.name}${variantLabel}
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
        <td colspan="2" style="padding:8px 0;font-size:14px;color:#16a34a;">
          Discount${data.couponCode ? ` (${data.couponCode})` : ''}
        </td>
        <td style="padding:8px 0;font-size:14px;color:#16a34a;text-align:right;">
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
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Order Confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;max-width:600px;">

          <!-- Header -->
          <tr>
            <td style="background-color:#171717;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:24px;font-weight:300;letter-spacing:4px;color:#c8a97e;">
                BLE$$ P
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:40px 40px 24px;">
              <h2 style="margin:0;font-size:22px;font-weight:300;color:#171717;">
                Thank you for your order
              </h2>
              <p style="margin:12px 0 0;font-size:14px;color:#737373;line-height:1.6;">
                Hi ${data.customerName}, we have received your order and it is being processed.
                You will receive a shipping confirmation once your order is on its way.
              </p>
            </td>
          </tr>

          <!-- Order Number -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafafa;padding:16px 20px;">
                <tr>
                  <td style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#737373;">
                    Order Number
                  </td>
                  <td style="font-size:16px;font-weight:600;color:#171717;text-align:right;font-family:monospace;">
                    #${orderRef}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding:0 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <th style="padding:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#a3a3a3;text-align:left;border-bottom:1px solid #e5e5e5;">
                    Item
                  </th>
                  <th style="padding:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#a3a3a3;text-align:center;border-bottom:1px solid #e5e5e5;">
                    Qty
                  </th>
                  <th style="padding:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#a3a3a3;text-align:right;border-bottom:1px solid #e5e5e5;">
                    Price
                  </th>
                </tr>
                ${itemRows}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:24px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td colspan="2" style="padding:8px 0;font-size:14px;color:#737373;">
                    Subtotal
                  </td>
                  <td style="padding:8px 0;font-size:14px;color:#171717;text-align:right;">
                    ${formatCents(data.subtotalCents)}
                  </td>
                </tr>
                ${discountRow}
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
            <td style="padding:0 40px 40px;">
              <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#a3a3a3;">
                Shipping To
              </p>
              <p style="margin:0;font-size:14px;color:#171717;line-height:1.6;">
                ${data.customerName}<br/>
                ${locationParts.join(', ')}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#171717;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#737373;letter-spacing:1px;">
                &copy; ${new Date().getFullYear()} BLE$$ P. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await emailService.send({
    to: data.customerEmail,
    subject: `BLE$$ P: Order Confirmation #${orderRef}`,
    html,
  });
}
