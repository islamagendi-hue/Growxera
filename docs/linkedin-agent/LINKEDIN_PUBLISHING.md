# Direct publishing to LinkedIn

The studio can post approved items on the owner's personal LinkedIn profile through LinkedIn's
official, self-serve **Share on LinkedIn** product. Nothing is posted without an approval of the
exact version (text, file, planned time). Any edit cancels the approval.

## How it works

1. The owner approves a post that has a planned time.
2. A scheduler calls `/api/studio/publish-due` every few minutes. Posts whose time has come are
   published once. A post that can't go out within 3 hours of its time is held back (blocked), not
   posted late.
3. The studio records the post link. It marks the post **verified** only if LinkedIn returns the post
   with the same text. Otherwise the owner opens the link and confirms.
4. If LinkedIn gives no clear answer, the post is never re-sent automatically. The owner checks the
   profile and records what they found.

Approved posts with no planned time are only posted with **Publish now** on the item page.

## Limits (from LinkedIn's terms for self-serve apps)

- The access token lasts 60 days and there is no refresh token. The studio warns 7 days before
  expiry; the owner clicks **Reconnect**.
- Posting only. Reading posts, comments and analytics stays restricted (see Capabilities).
- One image or one PDF per post. Posts with more files are published manually.
- Untested until the first real post. The Capabilities page switches "Publish a text post" to
  *Available* only after an API post is confirmed live.

## One-time setup

### 1. LinkedIn developer app (owner, about 10 minutes)

1. Go to <https://www.linkedin.com/developers/apps> and click **Create app**.
2. Name: `Growx Era Studio`. LinkedIn Page: the Growx Era page (LinkedIn requires one; posts still
   go to your personal profile). Upload a logo, accept the terms, create.
3. **Products** tab: request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect**.
   Both are self-serve.
4. **Auth** tab: under *Authorized redirect URLs* add exactly
   `https://www.growxera.com/studio/linkedin/callback` (the Capabilities page shows the URL this
   deployment expects).
5. Keep the **Client ID** and **Client Secret** on that tab for step 2. Never paste them in chat,
   GitHub or docs.

### 2. App keys

Easiest: Studio → **Capabilities** → paste the Client ID and Client Secret → **Save keys**. The
secret is stored encrypted (key derived from `SUPABASE_SERVICE_ROLE_KEY`, table `li_linkedin_app`,
migration `20261013000000`). Alternatively set them as Vercel environment variables (Production),
which take precedence:

| Name | Value |
|---|---|
| `LINKEDIN_CLIENT_ID` | from the Auth tab |
| `LINKEDIN_CLIENT_SECRET` | from the Auth tab (also the key that encrypts the stored token) |

Optional: `LINKEDIN_API_VERSION` (`YYYYMM`, default `202606`) if LinkedIn retires the default;
`CRON_SECRET` only if a scheduler other than the one below is used. Redeploy after adding them.

### 3. Database (Claude, with approval)

Apply `supabase/migrations/20261012000000_linkedin_publishing.sql` to the growxera project. It
adds one table, `li_linkedin_connection` (RLS on, no browser access).

### 4. Connect (owner)

Studio → **Capabilities** → **Connect LinkedIn** → approve on LinkedIn. Nothing is posted.

### 5. Scheduler (Claude, with approval)

Free option: Supabase `pg_cron` + `pg_net` call the endpoint every 5 minutes. The secret is
generated inside the database and kept in Supabase Vault; nobody sees or copies it. The app checks
it with `li_check_cron_secret()` (from the migration).

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'studio_cron_secret');
select cron.schedule('studio-publish-due', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://www.growxera.com/api/studio/publish-due',
    headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name = 'studio_cron_secret'))
  );
$$);
```

To stop all automatic publishing at any time: `select cron.unschedule('studio-publish-due');`
or click **Disconnect** on the Capabilities page.

### 6. First test (owner)

Approve one post and use **Publish now**. Check it on LinkedIn, then confirm it in the studio.
