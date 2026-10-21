# Welcome to Vydia: Editor Guide

A quick reference for the Label & Artist Relations and Creative Services teams. It's the written version of the Loom walkthrough.

**Where to edit:** `welcometovydia.com/studio`. Sign in with the shared team login (`labelrelationships@vydia.com` or `creativeservices@vydia.com`).

## How the site is put together

Every artist page is built from the same pieces:

```
Resources  →  go onto  →  the Website (shown on every artist page)
```

- A **Resource** is one card: a PDF, a video, a link (pitch forms), or a slide deck.
- The **Website** holds which resources show, in order. Every artist sees it unless their artist record says otherwise.
- An **Artist** is one client. Creating an artist creates their page at `welcometovydia.com/their-url`.

> **A resource only shows up on the site once it's on the Website (or an artist's resource override).** A new resource you haven't added anywhere won't appear.

The sidebar on the left matches this: **Artists**, then **Resources** and **Website**.

## Create a page for a new artist

1. Click **Artists**, then the **+** button at the top of the list.
2. Type the **Artist name**.
3. Under **URL**, click **Generate**. This makes the web address, for example `jane-doe`.
4. Open the **Access** tab and add each client email under **Allowed emails** (click **Add item** for each one). Upper/lower case doesn't matter.
   - You don't need to add `labelrelationships@` or `creativeservices@`. They can always see every page.
5. Optional, on the **Page content** tab:
   - **Additional info:** a box shown below the resources in grid view (for example, who their rep is).
   - **Resource override:** see "Give one artist different resources" below.
6. Click **Publish** (bottom right).
7. To see the page, open the **…** menu next to Publish and choose **Open site**.

Send the client their link: `https://welcometovydia.com/<the URL>`. The first time, they'll create a login with that email (or use Google) and confirm it from their inbox.

## Add or update a resource

1. Click **Resources**, then **+**.
2. Fill in:
   - **Title**: shown on the card.
   - **Type**: PDF, Video, Link (pitch forms and other web pages), or Slide deck.
   - **File** or **Link URL**, depending on the type. PDFs and videos are uploaded. Links are pasted. Slide decks can be either.
   - **Cover photo** (optional). Without one, PDFs automatically use their first page, and everything else gets a dark Vydia tile with the title.
   - **Added on**: the date on the card. It's set automatically when you create the resource, and editing the resource later doesn't change it. When copying something over from Seismic, set it to the original date.
3. For PDFs, wait a few seconds after uploading: the **PDF first-page preview** fills in by itself. Password-protected PDFs can't be previewed (you'll see a message), so they use the Vydia tile.
4. Click **Publish**.
5. Now add it to the Website (next step), or it won't appear on the site.

Videos: export as MP4 at 1080p or smaller to keep file sizes down.

## Put resources on the page

1. Click **Website**.
2. Under **Resources**, click **Add item** and search for the resource by title.
3. Drag the handles to change the order. Cards appear on the site in this order.
4. Under **Internal viewers**, add any other `@vydia.com` people who should be able to see every artist page.
5. Click **Publish**.

Changes to the Website or to a resource show up on **every** artist page that uses them, within a few seconds of publishing. You don't need to do anything else.

## Give one artist different resources

On the artist's **Page content** tab, add resources under **Resource override**.

- If you add **any** resources there, they **replace** the Website resources on that artist's page. They aren't added on.
- To show a resource to just one artist, create it under **Resources** first, then add it here (and not to the Website).
- To go back to the Website resources, remove everything from **Resource override** and publish.

## Changing an artist's web address

Clients bookmark their link, so the **URL** locks the first time you publish. Renaming the artist doesn't change the URL.

If you really need a new address:

1. Open the artist, click the **…** menu next to Publish, and choose **Change URL…**.
2. Confirm. The old address is saved under **Previous URLs** (Advanced tab) and keeps working: it sends people to the new one.
3. Type or **Generate** the new URL, then **Publish**. It locks again.

Some web addresses are reserved (like `studio` or `login`), and an address another artist uses or used before can't be reused. Studio tells you if you pick one of those.

## Things to know

- **Edits to a shared resource change every artist page that uses it.** If one artist needs something different, make a separate resource for them.
- You can't delete a resource that's still on the Website or an artist's resource override. Remove it from those first. Studio shows where it's used.
- Red messages under a field must be fixed before **Publish** will work. They explain what's wrong (for example, "Upload a PDF.").
- Unpublished changes don't appear on the site. If something isn't showing, check for a **Draft** label at the top of the document and publish.

## Troubleshooting

**"My client says they can't see their page."**
1. Check the spelling of their email under the artist's **Allowed emails**.
2. Make sure they signed in with that same email. On the "This page isn't available" screen, they can click **Sign in with a different email**.
3. If they created a login with a password, they need to click the confirmation link in their inbox first. Google sign-in doesn't need this.
4. Check the artist is **published**.

**"My client went to welcometovydia.com and sees instructions."**
The home page doesn't list artists (on purpose). Resend their personal link.

**"I want to see an artist's page myself."**
Open the artist in Studio and choose **Open site** from the **…** menu. Your team login can see every page.

**"Someone left; remove their access."**
Delete their email from **Allowed emails** and publish. They lose access the next time they load the page.
