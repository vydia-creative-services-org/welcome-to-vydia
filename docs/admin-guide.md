# Vydia Onboarding: Admin Guide

For label services and creative services. It covers everything you do in the admin panel at `welcometovydia.com/admin`. You never edit anything on a client's page directly: you change the client or the main resources here, and the page updates the next time anyone opens it.

## Signing in

1. Go to `welcometovydia.com/admin` and click **Sign in with Google**.
2. Use your **@vydia.com** Google account. It also has to be on the admin list. If you see "You don't have access.", ask someone who is already an admin to add you (see [Adding an admin](#adding-an-admin)).

You stay signed in. Click your picture at the top right for your name, the **Dark theme** switch, and **Sign out**. The theme follows your computer's setting until you change it.

## Super admins and admins

There are two kinds of admin.

| | Super admin | Admin |
| --- | --- | --- |
| See clients | Every client | Only clients assigned to you |
| Open a client's page | Any client | Only your clients |
| Create a client | Yes | Yes (it's assigned to you) |
| Edit or delete a client | Any client | Only your clients |
| Add exclusive resources to a client | Any client | Only your clients |
| Hide a main resource for a client | Any client | Only your clients |
| View main resources | Yes | Yes, read-only |
| Add, edit, delete, or reorder main resources | Yes | No |
| Reassign a client to another admin | Yes | No |

A client is assigned to the admin who creates it. Only one admin owns a client at a time. If you can't find a client, it belongs to someone else: ask a super admin. Super admins have a **Super admin** badge next to their name.

Super admins can reassign a client from its page with the **Assigned to** menu. They can switch the client list between **Mine**, **All**, and **Unassigned**, and the **Owner** column shows who owns each client. Choosing **Unassigned** hides the client from every regular admin until it's assigned again.

## How it fits together

- A **main resource** is a card everyone sees: a guide, a tutorial video, a pitch form. You manage them under **Resources**.
- A **client** is one entry in the admin panel. Creating a client gives them a page at `welcometovydia.com/their-link` and a list of emails that are allowed to open it.
- On one client you can **hide** a main resource (only for them) and add **exclusive** resources (only they see them).

Clients never see an account area, a sign-out button, or a list of other pages. A link shows either their resources or an "Enter your email" screen.

## Create a new client

1. Open **Clients** and click **New client**.
2. Type the **Account name**. The **Link** fills in for you (for example "Lil Example" becomes `lil-example`). You can change it: 3 to 60 characters, lowercase letters, numbers, and hyphens.
3. Enter the **Email**: the client's own address.
4. Click **Add email** for each manager or alternate address. The label (Manager, Alt, Assistant, or anything you like) is optional. Every email signs in on its own, and capital letters don't matter.
5. Under **Resources**, click **Remove** on anything this client should not see. The row turns gray, dashed, and struck through, with a **Hidden** badge. **Restore** brings it back.
6. Optional: add **exclusive resources** (see below).
7. Click **Save**. Nothing is saved until you do, and either everything saves or nothing does.

You land on the client's page in the admin, with a **Saved** confirmation. **Every email you just added is sent its own link** ("Open your Vydia Onboarding page"). That includes an address that's already on another client. Emails that were already on the client aren't emailed again when you save. If a send fails, a yellow **Welcome email not sent to …** notice appears at the top of the page with a **Retry** button.

The emailed link never expires and works in any browser, as many times as they like. Removing the email from the client switches it off. **Copy link** still gives you the page's address if you'd like to send it yourself too.

## Exclusive resources

Use **Add client-specific resource** (under **Client-Specific Resources**) for something only this client should see, like a release plan.

1. Give it a **Title** (up to 120 characters) and pick a **Type**.
2. Add the content:
   - **PDF** and **Video**: upload the file. For videos, use MP4 at 1080p or smaller.
   - **Link**: enter the web address (pitch forms, external pages).
   - **Slide deck**: upload a PDF, PowerPoint, or Keynote file, **or** enter a link such as Google Slides, not both.
3. Optional **Cover image**: JPG, PNG, or WebP up to 5 MB, with alt text. PDFs without a cover use their first page automatically; everything else uses the Vydia tile.
4. Pick a **Category**. Pick an existing one from the dropdown, or choose **+ Add new…**. "getting started" and "Getting Started" count as the same category.
5. Click **Done**, then **Save** the client.

Wait for **Uploading…** to finish before you save. If a field is wrong, the message under it tells you what to fix.

## Editing a client

Open the client from the list, change anything, and click **Save**.

- **Removing an email cuts off that person immediately.** The next time they open the page they see the "Enter your email" screen, even though they were signed in before.
- **Changing the link breaks the old one.** You'll see a warning ("The old link will stop working - send the client the new one") and a confirmation before it saves. Old links are not redirected, so send the client the new one.
- **Open** shows you exactly what the client sees. As an admin signed in with Google you can open any client's page.

## Deleting a client

Open the client, scroll to the bottom, and click **Delete client**, then confirm. This permanently removes the client, their emails, their hidden-resource choices, and their exclusive resources and files. Anyone who was attached only to that client loses access. The link can be reused for a new client.

## Main resources (everyone sees these)

Open **Resources** in the top bar. Changes here apply to **every client immediately**. Only super admins can change main resources. Other admins see the list read-only and can hide a main resource for their own clients from the client's page.

- **New resource** adds one. A new one appears on every client's page automatically (you can hide it per client afterwards).
- **Edit** and **Delete** are on each row. Deleting removes it from every client, and any per-client hides for it too.
- **Reorder:** drag a row's grip handle to change the order inside a category, or drag a category's handle to move the whole group. Keyboard: focus a handle, press Space, move with the arrow keys, press Space again.
- **Categories** group the cards in the client's grid view. Cards are shown in the order you set here.

## What clients see

1. They open the Welcome link and see **Enter your email**.
2. They type their address and click **Continue**. If it's attached to that client, they get a link by email ("Open your Vydia Onboarding page") and the screen says **Email sent, check your inbox**. **Resend email** unlocks after 60 seconds.
3. If it isn't, nothing is sent and they see: "This email isn’t approved to view this page. Make sure you’re using the URL provided by Vydia label services, or contact them if you’re having trouble."
4. They click the link in the email and land on their page. They stay signed in on that browser. The same link keeps working: on another browser, on their phone, next month.

The page has a carousel and a grid view (grouped by category). The client's name never appears until they have access, and a link for a client that doesn't exist looks exactly the same as one that does.

## When something goes wrong

| What the client says                                  | What to check                                                                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| "It says my email isn't approved."                    | Open the client and check the spelling of that address, and that it's on **that** client (not a different one). Add it and save.          |
| "I never got the email."                              | Ask them to check spam and wait a minute. Then ask them to use **Resend email**. Make sure the address is on the client.                   |
| "The link says it has expired."                       | They have an older one-hour link from before links became permanent. Ask them to enter their email again; the new link never expires.   |
| "The link says it's no longer active."                | That email was removed from the client (or the client was deleted). Add the email back and save: they're sent a new link.               |
| "I changed browsers and I'm asked for my email again." | Normal. Each browser signs in separately. They can request a new link.                                                                     |
| "The old link stopped working."                       | The client's link was changed. Send them the current one from the client's page.                                                           |

## Adding an admin

Admins are managed in Supabase, not in this panel. In the Supabase dashboard open **Table editor → `admins`** and add a row with the person's **@vydia.com** email. Their name and picture fill in the first time they sign in with Google. Delete the row to remove them. They need a real Google Workspace account.

New rows are regular admins. To make someone a super admin, set their **`role`** to `super`; set it back to `regular` to undo. Deleting an admin leaves their clients unassigned, so only super admins can see them until they're reassigned.

## For developers: cleaning up uploads

If someone uploads a file and then leaves the form without saving, the file stays in storage. Run `npm run storage:sweep` about once a month to list files nothing references that are over 24 hours old, and `npm run storage:sweep -- --delete` to remove them. Files from deleted clients and resources are cleaned up automatically.
