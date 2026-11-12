# Loom Walkthrough: Vydia Onboarding

A step-by-step script for a single recording of about 8 to 10 minutes. Each step says what to do and what to point out. Say the lines in *italics* if you want a ready-made script, or put them in your own words.

## Before You Record

Do these first so nothing stalls on camera.

- [ ] **Use the deployed site**, not localhost, so the email link and logo work. Confirm the Supabase email templates are pasted in and the sender (Resend) is verified (see `docs/launch-checklist.md`).
- [ ] **Two admin accounts:** a **super admin** (for example your own `@vydia.com`) and a **regular admin** (`labelservices@vydia.com` or `creativeservices@vydia.com`). Be signed in to Google as the super admin to start, with the other ready in a second browser profile.
- [ ] **Two inboxes you can open on screen,** for example your personal email and a second address. These play the client and the client's manager.
- [ ] **A private (incognito) window** for the client side, so it has no saved session.
- [ ] **Test files:** one small PDF, one cover image (JPG, PNG, or WebP under 5 MB), and one link (for example a Google Form URL).
- [ ] **Delete any old test client** named "Lil Example" so the link is free.
- [ ] **Browser zoom at 100%,** notifications off, bookmarks bar hidden, and a tidy desktop.
- [ ] Open **three tabs:** admin (`/admin`), the private window (client side), and your inbox.

## Recording Outline

| # | Section | Time |
| - | ------- | ---- |
| 1 | Intro | 0:30 |
| 2 | Admin sign-in and tour | 1:00 |
| 3 | Create a client | 2:00 |
| 4 | Client experience | 2:30 |
| 5 | Edit and manage a client | 1:30 |
| 6 | Core resources | 1:00 |
| 7 | Roles | 0:45 |
| 8 | Mobile, themes, wrap-up | 0:45 |

---

## 1. Intro (0:30)

1. Start on the admin sign-in page.
2. Say: *"This is Vydia Onboarding. It replaces the Seismic link we used to send new clients. Label services builds each client a private page, copies the link, and emails it from their own inbox. I'll show the admin side first, then what the client sees."*

## 2. Admin Sign-In and Tour (1:00)

1. Click **Sign in with Google** and choose the `@vydia.com` account.
2. Point out: *"Only Vydia Google accounts on the admin list get in. Anyone else sees 'You don't have access.'"*
3. On the **Clients** page, show:
   - The top bar: logo, **Onboarding**, **Clients**, **Resources**.
   - The **Super admin** badge (click your avatar to see it).
   - The search box and the **Mine / All / Unassigned** switch.
   - The **Owner** column, and the **Copy link** and **Open** buttons on a row.
4. Press **/** to jump to search, then clear it.

## 3. Create a Client (2:00)

1. Click **New Client**.
2. Type **Account name:** `Lil Example`. Point out that the **Link** fills in automatically as `lil-example`.
3. Enter the client's **Email** (your first inbox).
4. Click **Add email** and add the manager's address (your second inbox) with the label **Manager**.
5. In **Resources**, click **Remove** on one core resource. Point out that it goes dashed and struck through. Say: *"Hidden for this client only. Restore brings it back."*
6. In **Client-Specific Resources**, click **Add client-specific resource**:
   1. Title: `Q1 Release Plan`.
   2. Type: **PDF**. Upload the test PDF and wait for **Uploading…** to finish.
   3. Mention: *"The first page becomes the cover automatically."*
   4. Category: pick one from the dropdown, or choose **+ Add new…** and type a name.
   5. Click **Done**.
7. Add a second one: Type **Link**, paste the URL (the field adds `https://` for you), add the cover image, and click **Done**.
8. Show validation: clear the **Account name** and click **Save**. Point out the message under the field. Then fix it.
9. Point out the **Unsaved changes** note beside **Save**, then click **Save** (or press **⌘↵**).
10. You land on the client's page with a **Saved** toast. Click **Copy link**.

## 4. The Client Experience (2:30)

Switch to the **private window**.

1. Paste the link. Show the **Enter your email** screen. Say: *"No account, no password, and the client's name isn't shown until they're approved."*
2. **Not approved:** enter an address that isn't on the client. Point out the message and that **no email is sent**.
3. **Unknown link:** open `/does-not-exist` in the same window. Say: *"Looks identical. Nobody can guess links to find out who our clients are."*
4. **Approved:** go back to the real link, enter the client email, and click **Continue**.
5. Point out **Email sent, check your inbox** and the **Resend email** countdown (60 seconds).
6. Switch to the inbox. Show the email: logo, **Welcome to Vydia**, the address it's for, and the **Open my page** button. Mention that it works once and expires in 1 hour.
7. Click **Open my page**. You land on the resources page.
8. Show the page:
   - The carousel: scroll or drag through the cards.
   - The grid toggle in the top right, grouped by category.
   - Open the PDF card and the link card.
   - The removed core resource is missing, and the client-specific ones are present.
9. Say: *"There's no sign-out, no account menu, and no links to other pages. It stays signed in on this browser."*
10. **Expired link:** click the email button a second time (or open it in another browser). Show **This Link Has Expired** and **Send a new link**.
11. **Manager:** repeat steps 4 to 7 with the manager's address to show it works for every email on the client.

## 5. Edit and Manage a Client (1:30)

Back in the admin.

1. **Remove access:** open **Lil Example**, remove the manager email, and **Save**. Say: *"That person loses access on their next page load, even though they were already signed in."* (Optional: refresh the manager's session to show the **Enter your email** screen.)
2. **Change the link:** edit the **Link** to `lil-example-2`. Point out **The old link will stop working.**, then **Save** and read the confirmation dialog. Confirm it. Show that the old link now shows **Enter your email**.
3. **Restore a hidden resource** with **Restore**, then **Save**.
4. **Delete:** scroll to the bottom and click **Delete client**. Read the confirmation, then confirm. You return to **Clients**.

## 6. Core Resources (1:00)

1. Click **Resources** in the top bar. Say: *"These appear on every client's page, so changes here apply to everyone immediately."*
2. Click **New Resource**. Walk through the type picker (PDF, Video, Link, Slides), the fields, and **Save**. Point out the **Resource saved** toast.
3. **Reorder:** drag a row by its grip handle, then drag a whole category. Mention the keyboard option: focus a handle, press **Space**, use the arrow keys, press **Space** again. The **Order saved** toast confirms it.
4. Click **Delete** on the new resource and read the confirmation ("It's removed from every client's page.").

## 7. Roles (0:45)

Switch to the **regular admin** browser profile.

1. Show that the title reads **Your Clients** and only assigned clients appear.
2. Open **Resources**. It's read-only, with no handles or buttons.
3. Switch back to the super admin. Open a client and show the **Assigned to** menu. Reassign the client to the regular admin and point out the **Reassigned** toast.
4. Back as the regular admin, refresh: the client now appears.
5. Say: *"Super admins see everything and edit core resources. Regular admins manage only their own clients."*

## 8. Mobile, Themes, Wrap-Up (0:45)

1. Click your **avatar** to open the account menu: your name, the **Dark theme** switch, and **Sign out**. Flip **Dark theme** on, show the whole admin in dark, then flip it back.
2. Shrink the browser to phone width (or use device mode). Show that the header still fits and the avatar menu works. Show the client page and the **Enter your email** screen on mobile.
3. Wrap up: *"That's the full flow: build a client, copy the link, the client signs in with a magic link, and label services stays in control of who sees what. Admins are managed in Supabase, and the admin guide has the details."*

---

## Quick Reference

| Feature | Where to show it |
| ------- | ---------------- |
| Google admin sign-in, no-access message | §2 |
| Search (**/**), Mine / All / Unassigned, Owner column | §2 |
| Auto link from the account name, duplicate-email and field validation | §3 |
| Hide a core resource per client | §3, §5 |
| Client-specific PDF, link, cover image, categories | §3 |
| Unsaved-changes note, **⌘↵** to save, **Saved** toast | §3 |
| Magic-link sign-in, resend countdown, branded email | §4 |
| Not-approved screen, unknown link looks identical | §4 |
| Carousel and grid views | §4 |
| Expired link screen | §4 |
| Removing an email cuts off access | §5 |
| Changing the link (warning and confirm) | §5 |
| Delete a client | §5 |
| Core resources: create, edit, delete, drag to reorder | §6 |
| Super admin vs regular admin | §7 |
| Reassign a client | §7 |
| Account menu, dark theme, mobile layout | §8 |

## If Something Goes Wrong

| Problem | Fix |
| ------- | --- |
| The email doesn't arrive | Wait a minute and check spam. Confirm the sender domain is verified in Resend and the address is on the client. |
| The email button opens the wrong site | Supabase **Site URL** is wrong. Set it to the live site. |
| You see "Too many attempts" | The sign-in form is rate limited. Wait a few minutes, or use a different address. |
| The upload hangs | Check your connection, then remove the file and try again. |
| A client doesn't show in the list | A super admin has it set to **Unassigned**, or it belongs to someone else. Check the **All** view. |
| The old session keeps you signed in | Use the private window, or clear cookies for the site. |

## Recording Tips

- Keep each section to its time budget. Cut the optional steps if you run long.
- Pause for a second after each click so viewers can follow.
- Narrate the *why* ("so no one can guess client links"), not just the clicks.
- Record the browser tab only (not the whole screen) so notifications can't leak in.
- Trim dead air (waiting for uploads or email) in Loom's editor afterward.
