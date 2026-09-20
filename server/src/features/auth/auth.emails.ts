import { Env } from '../../core/config/env';
import { escapeHtml } from '../../core/email/html';
import type { EmailPayload } from '../../core/email/email.service';

export type AccountLocale = 'en' | 'fr';
interface Recipient { email: string; locale?: AccountLocale }

export function accountLink(path: '/verify-email' | '/reset-password' | '/shop' | '/contact', locale: AccountLocale, token?: string): string {
  const url = new URL(path, Env.CLIENT_URL);
  url.searchParams.set('lng', locale);
  if (token) url.hash = `token=${token}`;
  return url.toString();
}

function accountEmail(data: Recipient & { title: string; paragraphs: string[]; action?: { label: string; url: string }; couponCode?: string }): EmailPayload {
  const locale = data.locale ?? 'en';
  const html = `<!DOCTYPE html>
<html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.title)}</title></head>
<body style="margin:0;padding:0;background:#fafafa;color:#171717;font-family:Arial,sans-serif;overflow-wrap:anywhere;word-break:break-word;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;table-layout:fixed;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;table-layout:fixed;background:#fff;">
<tr><td style="background:#171717;padding:28px 24px;text-align:center;color:#c8a97e;font-size:24px;letter-spacing:4px;">BLE$$ P</td></tr>
<tr><td style="padding:28px 24px;"><main>
<h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;">${escapeHtml(data.title)}</h1>
${data.paragraphs.map(p => `<p style="font-size:16px;line-height:1.6;margin:16px 0;color:#525252;">${escapeHtml(p)}</p>`).join('')}
${data.couponCode ? `<p style="padding:16px;border:1px dashed #a07a52;font-family:monospace;font-size:18px;overflow-wrap:anywhere;">${escapeHtml(data.couponCode)}</p>` : ''}
${data.action ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(data.action.url)}" style="display:inline-block;max-width:100%;box-sizing:border-box;background:#c8a97e;color:#171717;padding:14px 20px;font-size:16px;font-weight:bold;line-height:1.5;text-decoration:underline;">${escapeHtml(data.action.label)}</a></p>` : ''}
</main></td></tr><tr><td style="background:#171717;padding:24px;text-align:center;color:#a3a3a3;font-size:12px;line-height:1.6;">© ${new Date().getFullYear()} BLE$$ P. ${locale === 'fr' ? 'Tous droits réservés.' : 'All rights reserved.'}</td></tr>
</table></td></tr></table></body></html>`;
  return { to: data.email, subject: `BLE$$ P: ${data.title}`, html };
}

export function verificationEmailPayload(data: Recipient & { token: string }): EmailPayload {
  const locale = data.locale ?? 'en';
  return accountEmail({ ...data, locale,
    title: locale === 'fr' ? 'Vérifiez votre adresse e-mail' : 'Verify your email',
    paragraphs: locale === 'fr'
      ? ['Confirmez votre adresse e-mail en utilisant le lien ci-dessous. Il est valable pendant une heure et ne peut être utilisé qu’une fois.', 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.']
      : ['Confirm your email address using the link below. It expires in one hour and can only be used once.', 'If you did not request this, ignore this message.'],
    action: { label: locale === 'fr' ? 'Confirmer mon adresse' : 'Confirm my email', url: accountLink('/verify-email', locale, data.token) },
  });
}

export function passwordResetEmailPayload(data: Recipient & { firstName: string; token: string }): EmailPayload {
  const locale = data.locale ?? 'en';
  return accountEmail({ ...data, locale,
    title: locale === 'fr' ? 'Réinitialisez votre mot de passe' : 'Reset Your Password',
    paragraphs: locale === 'fr'
      ? [`Bonjour ${data.firstName},`, 'Une demande de réinitialisation a été reçue pour votre compte. Le lien ci-dessous expire dans 30 minutes et ne peut être utilisé qu’une fois.', 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message. Votre mot de passe reste inchangé.']
      : [`Hi ${data.firstName},`, 'We received a request to reset your account password. The link below expires in 30 minutes and can only be used once.', 'If you did not request this, ignore this message. Your password remains unchanged.'],
    action: { label: locale === 'fr' ? 'Choisir un nouveau mot de passe' : 'Reset password', url: accountLink('/reset-password', locale, data.token) },
  });
}

export function welcomeEmailPayload(data: Recipient & { firstName: string; welcomeCouponCode?: string }): EmailPayload {
  const locale = data.locale ?? 'en';
  return accountEmail({ ...data, locale,
    title: locale === 'fr' ? 'Bienvenue chez BLE$$ P' : 'Welcome to BLE$$ P',
    paragraphs: [locale === 'fr' ? `Bienvenue, ${data.firstName}. Votre compte est activé.` : `Welcome, ${data.firstName}. Your account is active.`,
      ...(data.welcomeCouponCode ? [locale === 'fr' ? 'Votre code personnel offre 10 % de remise. Il est valable 30 jours, à usage unique, et s’applique au paiement.' : 'Your personal code gives you 10% off. It is valid for 30 days, can be used once, and is applied at checkout.'] : [])],
    couponCode: data.welcomeCouponCode,
    action: { label: locale === 'fr' ? 'Découvrir la collection' : 'Browse the collection', url: accountLink('/shop', locale) },
  });
}

export function emailChangedPayload(data: Recipient): EmailPayload {
  const locale = data.locale ?? 'en';
  return accountEmail({ ...data, locale,
    title: locale === 'fr' ? 'Adresse e-mail modifiée' : 'Email address changed',
    paragraphs: locale === 'fr' ? ['L’adresse e-mail de votre compte a été modifiée. Si vous n’êtes pas à l’origine de cette modification, contactez immédiatement notre assistance.'] : ['Your account email address was changed. Contact support immediately if you did not request this change.'],
    action: { label: locale === 'fr' ? 'Contacter l’assistance' : 'Contact support', url: accountLink('/contact', locale) },
  });
}
