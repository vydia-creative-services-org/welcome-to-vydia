// The one email the app sends: a permanent link to a client's page. Sent when an email is added to a client, and
// again whenever that person asks for it on the page. The link never expires; removing the email from the client
// turns it off.

// Names the client, so someone on several clients (a manager, say) can tell the emails apart, and Gmail doesn't
// thread them together.
export const welcomeSubject = (clientName: string) => `Open ${clientName}’s Vydia Onboarding page`

export const accessLink = (siteUrl: string, token: string) => `${siteUrl}/auth/open?t=${encodeURIComponent(token)}`

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char] ?? char,
  )

export type WelcomeEmail = {subject: string; html: string; text: string}

export function welcomeEmail({
  siteUrl,
  email,
  clientName,
  link,
}: {
  siteUrl: string
  email: string
  clientName: string
  link: string
}): WelcomeEmail {
  // One line, so the name can't add header lines or break the layout.
  const name = clientName.replace(/\s+/g, ' ').trim()
  const subject = welcomeSubject(name)
  const site = escapeHtml(siteUrl)
  const to = escapeHtml(email)
  const page = escapeHtml(name)
  const href = escapeHtml(link)

  const text = [
    'Welcome to Vydia',
    '',
    `Open the Vydia Onboarding page for ${name} as ${email}:`,
    link,
    '',
    'This link is yours to keep. Bookmark it or come back to this email any time.',
    'Please don’t forward it: anyone with the link can open your page.',
  ].join('\n')

  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(subject)}</title>
    <!--[if mso]>
      <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; }
      /* Stop iOS and Gmail turning the address into a blue link mid-sentence. */
      a[x-apple-data-detectors], u + #body a { color: inherit !important; text-decoration: none !important; font: inherit !important; }
      .logo-on-dark { display: none; }
      @media (prefers-color-scheme: dark) {
        .canvas { background: #0a0a0a !important; }
        .card { background: #111111 !important; border-color: #262626 !important; }
        .ink { color: #ededed !important; }
        .soft { color: #a1a1a1 !important; }
        .rule { border-color: #262626 !important; }
        .btn { background: #ededed !important; color: #0a0a0a !important; }
        .logo-on-light { display: none !important; }
        .logo-on-dark { display: block !important; max-height: none !important; overflow: visible !important; }
      }
      @media (max-width: 520px) {
        .card-pad { padding: 32px 24px !important; }
      }
    </style>
  </head>
  <body id="body" class="canvas" style="margin:0;padding:0;background:#fafafa;">
    <!-- Preheader: the inbox preview line. The zero-width filler stops clients from pulling body text in after it. -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#fafafa;opacity:0;">
      Your page for ${page}. One click and you’re in, and the link is yours to keep.
      &#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="canvas" bgcolor="#fafafa" style="background:#fafafa;">
      <tr>
        <td align="center" style="padding:48px 16px;">
          <!--[if mso]><table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="card" bgcolor="#ffffff"
            style="max-width:480px;background:#ffffff;border:1px solid #ebebeb;border-radius:12px;">
            <tr>
              <td class="card-pad" style="padding:40px;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
                <img class="logo-on-light" src="${site}/email/vydia-mark-ink.png" width="28" height="28" alt="Vydia"
                  style="display:block;border:0;outline:none;height:28px;width:28px;color:#171717;font-size:16px;font-weight:700;" />
                <!--[if !mso]><!-->
                <div class="logo-on-dark" style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
                  <img src="${site}/email/vydia-mark-white.png" width="28" height="28" alt="Vydia"
                    style="display:block;border:0;height:28px;width:28px;color:#ededed;font-size:16px;font-weight:700;" />
                </div>
                <!--<![endif]-->

                <h1 class="ink" style="margin:32px 0 12px;font-size:24px;line-height:32px;font-weight:600;letter-spacing:-0.02em;color:#171717;">
                  Welcome to Vydia
                </h1>
                <p class="soft" style="margin:0 0 28px;font-size:15px;line-height:24px;color:#4d4d4d;">
                  Use the button below to open the Vydia Onboarding page for
                  <span class="ink" style="color:#171717;font-weight:500;">${page}</span> as
                  <span class="ink" style="color:#171717;font-weight:500;">${to}</span>.
                  This link is yours to keep: bookmark it or come back to this email any time.
                </p>

                <!-- Bulletproof button: VML for Outlook desktop, a real link everywhere else. -->
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td>
                      <!--[if mso]>
                        <v:roundrect href="${href}"
                          style="height:44px;v-text-anchor:middle;width:180px;" arcsize="18%" stroke="f" fillcolor="#171717">
                          <w:anchorlock/>
                          <center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:15px;font-weight:600;">Open my page</center>
                        </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-->
                      <a class="btn" href="${href}"
                        style="display:inline-block;padding:12px 24px;background:#171717;color:#ffffff;font-size:15px;line-height:20px;font-weight:600;text-decoration:none;border-radius:8px;">
                        Open my page
                      </a>
                      <!--<![endif]-->
                    </td>
                  </tr>
                </table>

                <p class="soft" style="margin:28px 0 0;font-size:13px;line-height:20px;color:#666666;">
                  Button not working? Paste this link into your browser:
                </p>
                <p style="margin:4px 0 0;font-size:13px;line-height:20px;word-break:break-all;">
                  <a class="soft" href="${href}" style="color:#666666;text-decoration:underline;">${href}</a>
                </p>

                <hr class="rule" style="margin:32px 0 24px;border:0;border-top:1px solid #ebebeb;" />

                <p class="soft" style="margin:0;font-size:13px;line-height:20px;color:#737373;">
                  Please don’t forward this email: anyone with the link can open your page.
                </p>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>
`

  return {subject, html, text}
}
