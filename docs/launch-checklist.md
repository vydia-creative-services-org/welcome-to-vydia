# Launch checklist

Your remaining steps to finish [`iteration-two-plan.md`](iteration-two-plan.md), in order. Each step lists the plan task it closes, in brackets.

Written 2026-11-10. Where things stand:

- **The new app is already live.** `iteration-two` and the artist → client rename are merged into `main` (PRs #5–#7), CI is green, and production serves the new app at **https://welcome-to-vydia.vercel.app**.
- **All 13 resources are on the new Supabase project**, including the 4 videos (the Pro plan fixed the upload limit).
- **The final address will be `https://onboarding.vydia.com`**, and emails will come from **`welcome@onboarding.vydia.com`**. We don't own `vydia.com`, so its owner (the **domain owner**) creates the DNS records. You collect the records, send them over, and finish the setup once they're in.
- **Biggest gap: magic-link emails to clients won't arrive** until the domain owner adds the email records (Part 3). Until then, don't send links to real clients.

Wherever a step says `<site>`, use `https://welcome-to-vydia.vercel.app` until Part 4 is done, and `https://onboarding.vydia.com` after.

---

## Part 1: Tick what's already done (2 minutes)

These are done. Tick them in `iteration-two-plan.md` (or ask Claude to):

- [x] **0.6** Pro plan. To be sure: Supabase → **Storage** → **Settings** → the global file size limit says **1 GB** or more.
- [x] **1.3** and **1.6** The Sanity PR was merged, and `iteration-two` went into `main`, so the branch merge doesn't apply anymore.
- [x] **2.16** You and Erica are in the `admins` table.
- [x] **8.5** 13 of 13 resources migrated.
- [x] **12.7** Nothing left to do in GitHub.
- [x] **12.8** Merged, and the production deploy is Ready.
- [x] **10.11** CI is green on `main`. The preview e2e workflow never ran on the PR; tick it or leave it open, your choice.
- [x] **V6** (§12.3) Only a fact-finding item, already answered.

---

## Part 2: Fix production's settings so it works on the current address [12.6] (15 minutes)

Do this now. It doesn't depend on the domain owner.

**Vercel.** Go to **vercel.com** → project **welcome-to-vydia** → **Settings** → **Environment Variables**.

1. Click `NEXT_PUBLIC_SUPABASE_URL` (Production). It must be exactly `https://lsihwkbnrheczirlkswo.supabase.co`. Fix it if not.
2. In a second tab, go to **supabase.com** → project **Vydia Onboarding** → **Project Settings** → **API Keys**.
   - The **Publishable key** must match Vercel's `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
   - Copy the **Secret key**. In Vercel, edit `SUPABASE_SECRET_KEY` (Production) and paste it in. Production's current value came from the Supabase integration and might belong to the old project. Pasting it fresh rules that out.
3. Set `NEXT_PUBLIC_SITE_URL` (Production) to `https://welcome-to-vydia.vercel.app`. The admin panel's **Copy link** button builds links from it. You'll change it again in Part 4.
4. **Delete** these variables (the app no longer reads them): `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_READ_TOKEN`, `SANITY_REVALIDATE_SECRET`, `PERMANENT_VIEWER_EMAILS`.
5. New values only apply after a redeploy: go to **Deployments**, click **⋯** on the top Production deployment, then **Redeploy**.

**Supabase.** Go to **Authentication** → **URL Configuration**.

6. Set **Site URL** to `https://welcome-to-vydia.vercel.app`. The link inside every magic-link email starts with the Site URL, so if it still says `welcometovydia.com` (a domain that doesn't exist), every link is broken.
7. Under **Redirect URLs**, click **Add URL** and add `https://welcome-to-vydia.vercel.app/**`. Keep the existing `localhost` and preview entries.
8. Click **Save**.

---

## Part 3: Get the DNS records to the domain owner [0.9] (15 minutes, then wait)

`vydia.com`'s DNS is at **GoDaddy** (nameservers `ns41`/`ns42.domaincontrol.com`), so the domain owner adds the records there. Checked 2026-11-10:

- `onboarding.vydia.com` doesn't exist yet, so nothing conflicts.
- `vydia.com` has no CAA records, so Vercel can issue the SSL certificate without extra records.
- `vydia.com` already has DMARC (`p=quarantine`, reports to `paul.santos@vydia.com`). That policy covers the subdomain too, so we don't need our own DMARC record. It also means emails sent **before** Resend shows Verified go to spam, so don't send to clients until Part 4, step 2.
- Paul Santos gets the DMARC reports, so he probably manages this DNS and is a good first person to ask.

- [x] **1. Website record (Vercel):** `onboarding.vydia.com` is added to the project. Vercel asked for one CNAME and no `_vercel` TXT.
- [x] **2. Email records (Resend):** `onboarding.vydia.com` is added. Resend asked for one DKIM TXT and two CNAMEs (no MX). The DKIM key was checked and is a valid RSA key, so it was copied intact.
- [ ] **3. Send this message.** Every value is filled in. GoDaddy's **Name** field only takes the part before `vydia.com`, so the names are already written that way.

> **Subject:** DNS records for onboarding.vydia.com
>
> Hi Paul, could you add these 4 records to **vydia.com** in GoDaddy (Domain → **DNS** → **Add New Record**)? They set up **onboarding.vydia.com**, our new client onboarding site, and let it send sign-in emails from **welcome@onboarding.vydia.com**.
>
> | Type | Name | Value | TTL |
> |---|---|---|---|
> | CNAME | `onboarding` | `35a838a580874fd1.vercel-dns-017.com` | 1 hour |
> | CNAME | `send.onboarding` | `send.forge.rmta.net` | 1 hour |
> | CNAME | `rsend.onboarding` | `rsend.forge.rmta.net` | 1 hour |
> | TXT | `resend._domainkey.onboarding` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDBzFylIfHC658+eTPfA6OHgFOycc4h7M4AeyT1S/TJxntE+Ojd1a9DgxHkmx0Od7tU+3aoGr0W8sT/QdCKFHZe5I7/lxGPcLgj+hJN0/m4HzHPtYr9aRWTSvhtpIiOKqSBStRccv0XtEZSbawIYXL3DCXiVE7cCVkf72DKW/+wBQIDAQAB` | 1 hour |
>
> Please enter the names exactly as shown (GoDaddy adds `.vydia.com` itself), and paste the TXT value as one line with no quotes or spaces. These only touch the `onboarding` subdomain; nothing on vydia.com's website, email, or existing records changes. Could you reply when they're saved? Thanks!

**To check the records yourself once Paul replies,** run this in Terminal. Each line should print a value instead of nothing:

```sh
for n in onboarding send.onboarding rsend.onboarding; do dig +short CNAME $n.vydia.com; done
dig +short TXT resend._domainkey.onboarding.vydia.com
```

**While you wait,** do Parts 5 and 6. Everything except the magic-link email steps works on `<site>` now.

---

## Part 4: After the domain owner adds the records [0.10, 4.7, 12.4] (30 minutes)

1. **Vercel** → **Settings** → **Domains**: wait until `onboarding.vydia.com` shows **Valid Configuration**. The certificate is automatic.
2. **Resend** → **Domains** → `onboarding.vydia.com` → **Verify DNS Records**. Wait for the green **Verified** badge. DNS changes can take up to a few hours.
3. **Resend** → **API Keys** → **Create API Key**. Name it `Vydia Onboarding (Supabase)`, set permission to **Sending access** and the domain to `onboarding.vydia.com`, then **Add**. Copy the key; Resend shows it only once.
4. **Supabase** → **Authentication** → **Emails** → **SMTP Settings** → turn on **Enable custom SMTP**:
   - Sender email: `welcome@onboarding.vydia.com`
   - Sender name: `Vydia`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: the key from step 3
   - Click **Save**.
5. **Supabase** → **Authentication** → **Emails** → **Templates**:
   - **Magic Link**: subject `Open your Vydia Onboarding page`. In Terminal, from the project folder, run `pbcopy < supabase/templates/magic-link.html`, click into the body, select everything there, and paste (Cmd+V). Click **Save**.
   - **Confirm signup**: same subject, then `pbcopy < supabase/templates/confirm-signup.html` and paste the same way. Click **Save**. (First-time clients get this one instead of Magic Link, so both need it.)
6. **Supabase** → **Authentication** → **URL Configuration**:
   - Set **Site URL** to `https://onboarding.vydia.com`.
   - Add `https://onboarding.vydia.com/**` to **Redirect URLs**, then **Save**.
7. **Vercel** → **Settings** → **Environment Variables**: set `NEXT_PUBLIC_SITE_URL` (Production) to `https://onboarding.vydia.com`. Then **Redeploy** as in Part 2, step 5.
8. **Test it end to end:**
   - Go to `https://onboarding.vydia.com/admin` and sign in with Google.
   - Create a client named `Test`, with **your personal email** as the primary email. Click **Save**, then **Copy link**. The link should start with `onboarding.vydia.com/`.
   - Open the link in a private window, enter your personal email, and click send.
   - The email should arrive from **Vydia &lt;welcome@onboarding.vydia.com&gt;**, show the Vydia logo, and drop you straight onto the Test page when you click it. Check spam if it's slow.
   - Delete the Test client.

`welcome@onboarding.vydia.com` can only send. Replies bounce. The email doesn't ask anyone to reply, but tell label services so clients contact them directly instead.

---

## Part 5: Sign-in checks with real Google accounts [V3, 5.8, 12.2]

1. **A personal Gmail is rejected:** open a private window, go to `<site>/admin/login`, and sign in with a **personal Gmail**.
   - You should see "You don't have access."
   - Then Supabase → **Authentication** → **Users**: search that address. It should **not** be listed.
2. **Shared inboxes get in:** in a private window, sign in as `labelservices@vydia.com`, then again as `creativeservices@vydia.com`. Both should reach the admin panel. In Supabase → **Table Editor** → `admins`, both rows should now have a `user_id`.
3. **Admins see client pages:** signed in as an admin, click **Open page** on a client. You should see the resources, not "Enter your email". Do it again the next day, after the session has refreshed.

Then tick V3, 5.8, and the last box under 12.2.

---

## Part 6: Full manual run-through [12.1] (30 minutes)

In `<site>/admin`. Steps 2 and 5 need working email (Part 4).

1. Create **Lil Example** with 3 emails you can receive. Hide one main resource, and add an exclusive PDF with a cover image. **Save**, then **Copy link**.
2. Open the link in a private window and sign in with each of the 3 emails, one at a time. All three should see the same page, without the hidden resource and with the exclusive PDF.
3. **Rename the slug:** a warning and a confirm dialog should appear. Afterwards the old link shows "Enter your email", and the new link works.
4. **Resources page:** add a resource, edit it, drag it into another category, then delete it. Reload a client page after each change to confirm it shows up.
5. **Delete Lil Example.** Its link should show "Enter your email" afterwards.

---

## Part 7: Phones and email apps [12.3] (after Part 4)

- On a real **iPhone (Safari)** and an **Android phone (Chrome)**: open a client link, enter an email, check the "sent" screen, swipe the carousel, and switch to the grid.
- On a computer, open a client page once in **Firefox**.
- Send a magic link to **Gmail** (web and phone app), **Apple Mail**, and an **Outlook / Microsoft 365** inbox. In each one, the logo should show and the link should open the page.
- With Outlook, if clicking the link says "This link has expired", Microsoft's link scanner used it up first. Note it in the plan (§16) so label services can warn those clients.

---

## Part 8: Label services [8.6, 12.5, 12.10]

- [ ] **Tell them to stop using Sanity Studio today.** The site no longer reads Sanity, so edits there go nowhere. All changes now happen at `<site>/admin/resources`. If anyone edited Sanity after 2026-11-10, ask Claude to re-run the migration, or copy the edits over by hand. **[12.5]**
- [ ] **Spot-check:** create a test client and click every resource. All 13 should open, the 4 videos should play, and the categories should look right. Then delete the client. **[8.6]**
- [ ] **After Part 4:** recreate each real client in `https://onboarding.vydia.com/admin` and email them their new link. `docs/admin-guide.md` walks through it. **[12.10]**

---

## Part 9: Final smoke test [12.9] (after Part 4)

In a private window on `https://onboarding.vydia.com`:

1. Sign in to `/admin` with Google.
2. Create a client with your email, then **Copy link**.
3. Open the link in a new private window and do the magic link end to end.
4. Visit `https://onboarding.vydia.com/does-not-exist`. It should look the same as a real client page ("Enter your email").
5. Delete the client.

---

## Part 10: About a week after launch [Phase 13]

- [ ] **13.1** Supabase → open the **old** project `cqqzvzljlthrqrttqnga` → **Project Settings** → **General** → **Pause project**. Delete it from the same page once nobody needs its data.
- [ ] **13.2** **sanity.io/manage** → the project → **API**: delete the read token under **Tokens** and the webhook under **Webhooks**. Then **Plan** → downgrade or cancel.
- [ ] **13.4** **console.cloud.google.com** → **APIs & Services** → **Credentials** → the OAuth client → under **Authorized redirect URIs**, remove `https://cqqzvzljlthrqrttqnga.supabase.co/auth/v1/callback` → **Save**. In Resend → **API Keys**, revoke any key the old project used.
- [ ] **13.6** Vercel → **Logs**: search for `get_client_page failed`, `email_can_access_slug failed`, and `Magic link not sent`. Ask Claude about anything that shows up.
- [ ] **13.3** and **13.5** are code tasks: ask Claude to remove the Sanity migration script and run the first storage-sweep dry run.

---

## Plan task → step

| Plan task | Step |
|---|---|
| 0.6, 1.3, 1.6, 2.16, 8.5, 10.11, 12.7, 12.8, V6 | Part 1 |
| 12.6 | Part 2 |
| 0.9 | Part 3 |
| 0.10, 4.7 (hosted half), 12.4 | Part 4 |
| V3, 5.8, 12.2 | Part 5 |
| 12.1 | Part 6 |
| 12.3 | Part 7 |
| 8.6, 12.5, 12.10 | Part 8 |
| 12.9 | Part 9 |
| 13.1–13.6 | Part 10 |
