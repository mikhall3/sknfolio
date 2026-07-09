import nodemailer from 'nodemailer'

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env

const transporter = SMTP_HOST
  ? nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
    })
  : null

export async function sendMagicLinkEmail(email, url) {
  if (!transporter) {
    console.log('\n[dev] SMTP not configured — magic link for', email)
    console.log(`[dev] ${url}\n`)
    return
  }

  await transporter.sendMail({
    from: SMTP_FROM || 'SKNFOLIO <hello@sknfolio.app>',
    to: email,
    subject: 'Your SKNFOLIO sign-in link',
    text: `Tap to sign in to SKNFOLIO:\n\n${url}\n\nThis link expires in 15 minutes. If you didn't request it, you can ignore this email.`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #2d1f29;">
        <h1 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">SKNFOLIO</h1>
        <p style="font-size: 15px; line-height: 1.6;">Tap below to sign in. This link expires in 15 minutes.</p>
        <a href="${url}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #b8503f; color: white; text-decoration: none; border-radius: 999px; font-family: sans-serif; font-size: 14px;">
          Open my diary
        </a>
        <p style="font-size: 13px; color: #856078;">If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  })
}
