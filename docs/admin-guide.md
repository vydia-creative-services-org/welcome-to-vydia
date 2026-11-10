# Welcome to Vydia: Admin Guide

For label services and creative services. It covers everything you do in the admin panel at `welcometovydia.com/admin`. You never edit anything on an artist's page directly: you change the artist or the main resources here, and the page updates the next time anyone opens it.

## Signing in

1. Go to `welcometovydia.com/admin` and click **Sign in with Google**.
2. Use your **@vydia.com** Google account. It also has to be on the admin list. If you see "You don't have access.", ask someone who is already an admin to add you (see [Adding an admin](#adding-an-admin)).

You stay signed in. **Sign out** is at the top right of the panel.

## How it fits together

- A **main resource** is a card everyone sees: a guide, a tutorial video, a pitch form. You manage them under **Resources**.
- An **artist** is one client. Creating an artist gives them a page at `welcometovydia.com/their-link` and a list of emails that are allowed to open it.
- On one artist you can **hide** a main resource (only for them) and add **exclusive** resources (only they see them).

Artists never see an account area, a sign-out button, or a list of other pages. A link shows either their resources or an "Enter your email" screen.

## Create a new artist

1. Open **Artists** and click **New artist**.
2. Type the **Artist name**. The **Link** fills in for you (for example "Lil Example" becomes `lil-example`). You can change it: 3 to 60 characters, lowercase letters, numbers, and hyphens.
3. Enter the **Primary email**: the artist's own address.
4. Click **Add email** for each manager or alternate address. The label (Manager, Alt, Assistant, or anything you like) is optional. Every email signs in on its own, and capital letters don't matter.
5. Under **Main resources**, click **Remove** on anything this artist should not see. The row turns gray and struck through. **Restore** brings it back.
6. Optional: add **exclusive resources** (see below).
7. Click **Save**. Nothing is saved until you do, and either everything saves or nothing does.

You land on the artist's page in the admin with the **Welcome link** at the top. Click **Copy link** and paste it into your own email to the artist. The app never sends the Welcome link itself.

## Exclusive resources

Use **Add exclusive resource** for something only this artist should see, like a release plan.

1. Give it a **Title** (up to 120 characters) and pick a **Type**.
2. Add the content:
   - **PDF** and **Video**: upload the file. For videos, use MP4 at 1080p or smaller.
   - **Link**: enter the web address (pitch forms, external pages).
   - **Slide deck**: upload a PDF, PowerPoint, or Keynote file, **or** enter a link such as Google Slides, not both.
3. Optional **Cover image**: JPG, PNG, or WebP up to 5 MB, with alt text. PDFs without a cover use their first page automatically; everything else uses the Vydia tile.
4. Pick a **Category**. It suggests categories that already exist as you type. "getting started" and "Getting Started" count as the same category.
5. Click **Done**, then **Save** the artist.

Wait for **Uploading…** to finish before you save. If a field is wrong, the message under it tells you what to fix.

## Editing an artist

Open the artist from the list, change anything, and click **Save**.

- **Removing an email cuts off that person immediately.** The next time they open the page they see the "Enter your email" screen, even though they were signed in before.
- **Changing the link breaks the old one.** You'll see a warning ("The old link will stop working - send the artist the new one") and a confirmation before it saves. Old links are not redirected, so send the artist the new one.
- **Open page** shows you exactly what the artist sees. As an admin signed in with Google you can open any artist's page.

## Deleting an artist

Open the artist, scroll to the bottom, and click **Delete artist**, then confirm. This permanently removes the artist, their emails, their hidden-resource choices, and their exclusive resources and files. Anyone who was attached only to that artist loses access. The link can be reused for a new artist.

## Main resources (everyone sees these)

Open **Resources** in the top bar. Changes here apply to **every artist immediately**.

- **New main resource** adds one. A new one appears on every artist's page automatically (you can hide it per artist afterwards).
- **Edit** and **Delete** are on each row. Deleting removes it from every artist, and any per-artist hides for it too.
- **Reorder:** drag a row's handle (⠿) to change the order inside a category, or drag a category's handle to move the whole group. Keyboard: focus a handle, press Space, move with the arrow keys, press Space again.
- **Categories** group the cards in the artist's grid view. Cards are shown in the order you set here.

## What artists see

1. They open the Welcome link and see **Enter your email**.
2. They type their address and click **Send link**. If it's attached to that artist, they get a link by email ("Open your Welcome to Vydia page") and the screen says **Email sent, check your inbox**. **Resend email** unlocks after 60 seconds.
3. If it isn't, nothing is sent and they see: "This email isn't approved to view this page. Please contact Vydia label services if you're having trouble."
4. They click the link in the email and land on their page. They stay signed in on that browser.

The page has a carousel and a grid view (grouped by category). The artist's name never appears until they have access, and a link for an artist that doesn't exist looks exactly the same as one that does.

## When something goes wrong

| What the artist says                                  | What to check                                                                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| "It says my email isn't approved."                    | Open the artist and check the spelling of that address, and that it's on **that** artist (not a different one). Add it and save.          |
| "I never got the email."                              | Ask them to check spam and wait a minute. Then ask them to use **Resend email**. Make sure the address is on the artist.                   |
| "The link says it has expired."                       | Links work once and last an hour. Some company email systems open links before the person does. Ask them to enter their email again.      |
| "I changed browsers and I'm asked for my email again." | Normal. Each browser signs in separately. They can request a new link.                                                                     |
| "The old link stopped working."                       | The artist's link was changed. Send them the current one from the artist's page.                                                           |

## Adding an admin

Admins are managed in Supabase, not in this panel. In the Supabase dashboard open **Table editor → `admins`** and add a row with the person's **@vydia.com** email. Their name and picture fill in the first time they sign in with Google. Delete the row to remove them. They need a real Google Workspace account.

## For developers: cleaning up uploads

If someone uploads a file and then leaves the form without saving, the file stays in storage. Run `npm run storage:sweep` about once a month to list files nothing references that are over 24 hours old, and `npm run storage:sweep -- --delete` to remove them. Files from deleted artists and resources are cleaned up automatically.
