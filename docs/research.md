# **Vydia Onboarding Microsite Research**

## **Overview**

Vydia's Label and Client Relations team (L\&A) requires a branded, editable welcome page for each new client (client). Currently, they send each client a Seismic link to bookmark, which contains necessary onboarding materials and resources. The plan is to replace this with a Vydia-owned site hosted at *welcometovydia.com/client-name\]*. This microsite will be built with Next.js and React on Vercel, with content managed in Sanity Studio and viewer authentication handled by Supabase Auth.

Each page consists of a header, an intro, and a library of resource cards grouped into titled sections. The default layout is identical for every client, but each client record can override the intro, include additional information, and substitute its own sections. The core effort involves configuring the four-part content model, establishing access rules, and ensuring Sanity is intuitive enough for the L\&A team to manage without developer assistance.

## **Problem and Context**

- The L\&A team currently uses Seismic solely to send new clients a bookmarked link containing all onboarding content and resources.  
- The goal is to create a "branded Google microsite".  
- The L\&A team needs the ability to add and remove resources (and potentially other elements).  
- The existing site must be accurately recreated (reference available at `docs/screenshots/sample website.png`).  
- Because clients bookmark the link, the page's URL must remain stable for the duration of the client's usage.

## **Product Definition**

### **Page Structure**

1. Header Banner: A styled background featuring the Vydia logo (`docs/logo/gamma-vydia-white.svg`).  
2. Intro: Globally used rich text editable from Sanity. The initial text provided is: "Vydia Onboarding\! Check out the resources below to get started:" followed by three bullet points that name and describe each section.  
3. Resource Card Sections: Each section is a titled grid containing resource cards.

### **Initial Sections**

The three section names used in the intro bullets are:

- Vydia Platform Resources: A comprehensive guide to the platform, including video tutorials.  
- Playlisting and Sync Pitch Forms: Forms to utilize playlisting and sync services for promoting upcoming and existing releases.  
- Additional Services: Publishing administration, physical distribution, and broadcast distribution.

### **Card Contents**

Each card includes a cover image (or a PDF page preview as a fallback), a title, and an "Added on" date line.

### **Resource Types**

Supported formats include PDFs, videos, external links, and slide decks.

### **The Existing Site**

- Reference: `docs/screenshots/sample website.png`  
- Pitch forms function as link-type cards, eliminating the need for a form builder.  
- Although the original screenshot displays horizontally scrollable rows, the new version will utilize a grid layout for resources.  
- The new version will retain the colored file-type icons featured on each card in the screenshot.

## **Stakeholders and Access**

- New clients and clients will access the bookmarked link to utilize the resources.  
- The internal L\&A team and Creative Services can create client sites, edit resources, and modify layouts directly within Sanity Studio.  
- The designated internal L\&A and Creative Services @vydia.com emails can sign in to view every client’s site.  
- I am responsible for building the site, developing the Sanity schema, and creating a Loom video to train the L\&A team on using Sanity Studio as designed.  
- There are only two Sanity seats available: one shared team login for labelrelationships@vydia.com and one for creativeservices@vydia.com. Personal logins will not be used.   

## **Tech Stack**

- Hosting: Vercel.  
- Frontend: Next.js and React.  
- CMS & Editor: Sanity and Sanity Studio.  
- File Storage: Sanity will store all PDFs, videos, slide decks, and cover images. Supabase serves as a potential backup repository for resource files.  
- Authentication: Supabase Auth (email/password and Google sign-in) for viewer login.   Domain: Managed by the product team; the URL pattern will be https\://welcometovydia.com/)\[client-name\].  
- Assets: All Seismic assets will be manually added to Sanity once the schema is complete.  
- Architecture Note: Sanity handles content and the approved email list, while Supabase manages user sign-ins. The site must reconcile these two separate systems upon each visit. 

## **Content Model**

The final schema consists of four components:

- Client: One record per client; creating a client generates their microsite. Fields include Client Name (which generates the URL slug), Allowed Emails (with labelrelationships@vydia.com and creativeservices@vydia.com granted permanent access), Optional Extra-Info Fields, Customization Fields (to be added post-prototype), Intro Text Override, Additional Info section, and a Section Override (allowing clients to feature custom sections).  
- Resource: A single item in the library hosted in Sanity. Fields include Title, Type, File or Link, Optional Cover Photo, and an automatic "Added on" date with a manual override option.  
- Section: A display group on the website. Fields include Title, Optional Subtitle, and an Ordered List of Resources.  
- Website: The global layout. Governs ordered sections and any global modifications to the intro text.

### **Component Relationships**

\`\`\`mermaid

client \---\> page at /\[client-name\]

                 |

                 |  renders

                 v

website (global)

   header

   intro text                      (client can override)

   optional client additional information

   section: title, subtitle, \[resource, resource, ...\]    (client can override the set of sections)

   section: title, subtitle, \[resource, ...\]

                                  |

                                  v

                       resource: title, type, file/link, cover photo

\`\`\`

### **Rage Rendering Sequence**

1. The page is served at /\[client-name\] following a successful sign-in.  
2. The intro displays the client’s specific override text; if none exists, it defaults to the website’s global intro.  
3. Any additional client information appears directly beneath the intro.  
4. The sections display the client’s section overrides; if none are set, the global ordered sections are rendered.  
5. Each section displays its designated resources sequentially as cards.

### **Clarifying Notes**

- A "section override" entirely replaces the global sections rather than adding to them.  
- "Additional info" functions as part of the optional extra-info fields.  
- The header branding is currently fixed.

## **User Flows**

### **Flow 1: Create a New Microsite**

1. The L\&A team opens Sanity Studio.  
2. They create a new client object.  
3. They input the client's name.  
4. They input the approved emails (the two internal @vydia.com emails have default access).  
5. They optionally complete additional info and customization fields.  
6. They publish the object.  
7. The site is live at *https\://welcometovydia.com/)\[client-name\].*

### **Flow 2: Edit Resources**

1. The L\&A team navigates to the resources section in Sanity Studio.  
2. They add, modify, or remove resources, adding optional cover photos as needed.  
3. Once resources are updated, they open the sections area.  
4. Within each section object, they configure the title, subtitle, and ordered list of resources.  
5. Once sections are finalized, they open the website layout area.  
6. They verify that all sections and intro texts are correct.

### **Clarifying Notes**

- This flow operates on three layers: resources populate sections, and sections populate the website. A resource not assigned to a section will not be visible on any page.   

## **Access Control**

- Each client record contains an approved email list (which is part of the Sanity schema). The two internal @vydia.com emails maintain permanent access.  
- Because the URL slug is derived from the easily guessable client name, strict email verification is the primary security measure.  
- To prevent URL scraping to determine the client roster, users entering a non-existent client URL must still sign in before receiving an "client doesn't exist" error.     
- Returning clients should not face aggressive session expirations (e.g., daily timeouts) since they bookmark the page.     
- After sign-in, the UI response (messaging and timing) for an unknown client must be identical to the response for a known client to which the user lacks access.  
- Email/password sign-ups require email confirmation to prevent users from registering unowned addresses (Google sign-in is inherently verified).  
- The system must use case-insensitive email comparisons when checking the approved list.  
- Clients do not hold formal accounts; their approved email simply grants access to their specific pages via gated sessions.

## **Risks**

- URL Stability: URLs are generated from client names. Renaming a client could break their bookmarked link. A locked slug, automatic redirect, or customizable slug must be implemented to handle name collisions and special characters.  
- "Added On" Dates: Sanity automatically generates timestamps. The manual override in the schema must ensure this reflects the original addition date, not the last edited date.  
- Missing Cover Photos: Cover photos are optional; the UI must ensure cards still match the initial design without them.  
- Global Editing Impact: Modifying a global resource updates it across all client sites. A publish webhook is required to refresh affected Next.js pages, preventing editors from thinking the publish failed.  
- Storage Limits: Tutorial videos will now be hosted in Sanity; it is unverified whether Sanity's storage and bandwidth quotas can support this.

## **Clarifications**

- Section overrides completely replace global sections, they do not append to them.  
- There are no user accounts; access is strictly gated by verified email sessions.  
- Security responses for "unknown client" and "unapproved user" must be indistinguishable.  
- Resources will display in a grid with file-type icons, not as scrolling horizontal rows.

## **Post-Prototype Open Questions**

- Confirm with the L\&A team if operating from a single shared Sanity login is acceptable, as it prevents tracking individual user changes.  
- Customization Inquiries:  
  - Should a client profile picture be included?  
  - Are there other requested customization options (e.g., custom background images)?

## **Next steps**

- Build the prototype: implement the four-part schema, global layout, client overrides, Supabase authentication, the unknown-client security rule, and manually upload Seismic assets.  
- Record a Loom walkthrough for the L\&A and Creative Services teams.  
- Present the prototype, address the open questions, and subsequently implement the customization fields.
