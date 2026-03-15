import { emailService } from '../../core/email/email.service';

interface WelcomeEmailData {
  email: string;
  firstName: string;
}

interface PasswordResetEmailData {
  email: string;
  firstName: string;
  resetUrl: string;
}

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  const shopUrl = `${process.env.CLIENT_URL ?? 'http://localhost:5173'}/shop`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Welcome to BLE$$ P</title>
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
                Welcome, ${data.firstName}
              </h2>
              <p style="margin:12px 0 0;font-size:14px;color:#737373;line-height:1.6;">
                Thank you for joining BLE$$ P. You now have access to our curated collection
                of luxury streetwear, crafted for those who demand both style and substance.
              </p>
              <p style="margin:16px 0 0;font-size:14px;color:#737373;line-height:1.6;">
                Explore our latest drops, limited editions, and exclusive pieces designed
                to elevate your wardrobe.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:8px 40px 40px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#c8a97e;padding:14px 32px;text-align:center;">
                    <a href="${shopUrl}" style="color:#171717;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">
                      Browse the Collection
                    </a>
                  </td>
                </tr>
              </table>
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
    to: data.email,
    subject: 'Welcome to BLE$$ P',
    html,
  });
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reset Your Password</title>
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
                Reset your password
              </h2>
              <p style="margin:12px 0 0;font-size:14px;color:#737373;line-height:1.6;">
                Hi ${data.firstName}, we received a request to reset the password for your account.
                Click the button below to choose a new password. This link will expire in 1 hour.
              </p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:8px 40px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#c8a97e;padding:14px 32px;text-align:center;">
                    <a href="${data.resetUrl}" style="color:#171717;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:1px;text-transform:uppercase;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Safety notice -->
          <tr>
            <td style="padding:0 40px 40px;">
              <p style="margin:0;font-size:13px;color:#a3a3a3;line-height:1.6;">
                If you did not request this, you can safely ignore this email.
                Your password will remain unchanged.
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
    to: data.email,
    subject: 'BLE$$ P: Reset Your Password',
    html,
  });
}
