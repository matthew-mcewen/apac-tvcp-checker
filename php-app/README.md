# APAC Specialists of ATC (TVCP) Checker — PHP edition

A plain PHP + HTML/CSS/JS version of the TVCP eligibility checker and application
form. No build step, no database, no Node/Composer required — just PHP with the
`curl` extension (standard on almost every shared host).

## What it does

A visitor enters their VATSIM CID, clicks **Check**, and the app looks them up on
the public VATSIM API to see if they meet the Specialists of ATC eligibility
rules (minimum rating, time since last rating change, hours logged on their
current rating). If eligible, they can consent and submit an application, which
is posted to a Discord channel (and optionally logged to a Google Sheet).

## Deploying on cPanel (shared hosting)

1. In cPanel, open **File Manager**, navigate to `public_html` (or a subfolder
   if you want the form at e.g. `yoursite.com/tvcp/`).
2. Upload the zip of this `php-app` folder and extract it there.
3. Rename `config.example.json` to `config.json` (or copy it), then edit it:
   - `delivery.discord.webhook_url` — paste your Discord webhook URL. Get one
     from your Discord server: **Server Settings → Integrations → Webhooks →
     New Webhook → Copy Webhook URL**.
   - `delivery.discord.enabled` — set to `true` to receive applications in
     Discord.
   - `delivery.google_sheets` — optional, see below.
   - `tvcp.*` — the eligibility thresholds (minimum rating, days since rating
     change, minimum hours). Leave as-is unless the rules change.
4. That's it — no build step, no `composer install`. Visit the page in your
   browser to confirm it loads.

Requirements: PHP 7.4 or newer, with the `curl` extension enabled (this is on
by default on virtually all cPanel hosts).

### Optional: logging applications to a Google Sheet

This doesn't require any Google API credentials — it uses a small script
attached to your own Sheet:

1. Create a Google Sheet.
2. In the Sheet, go to **Extensions → Apps Script**, delete the placeholder
   code, and paste:

   ```javascript
   function doPost(e) {
     const data = JSON.parse(e.postData.contents);
     const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     sheet.appendRow([
       data.submitted_at,
       data.cid,
       data.rating,
       data.region_path,
       data.last_rating_change,
     ]);
     return ContentService.createTextOutput(JSON.stringify({ ok: true }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```

3. Click **Deploy → New deployment**, choose type **Web app**, set "Who has
   access" to **Anyone**, then deploy. Copy the resulting web app URL.
4. In `config.json`, set `delivery.google_sheets.enabled` to `true` and paste
   the URL into `delivery.google_sheets.webhook_url`.

## Security notes

- `config.json` contains your Discord webhook URL and is blocked from direct
  web access by the included `.htaccess` — don't remove that file. (This only
  works on real Apache hosting like cPanel; PHP's own built-in test server
  used for local preview ignores `.htaccess`, so don't expose that to the
  internet.)
- There are no user accounts, passwords, or database — nothing else to secure.

## Local testing

From this folder, run:

```bash
php -S localhost:8000
```

Then open `http://localhost:8000` in a browser.

## Files

- `index.html`, `assets/` — the frontend (HTML/CSS/JS), styled identically to
  the original app, with automatic light/dark mode based on the visitor's
  device/browser setting.
- `api/check.php`, `api/submit.php` — the two endpoints the frontend calls.
- `lib/` — shared PHP logic (VATSIM API client, eligibility rules, Discord/
  Sheets delivery).
- `config.json` — your settings (not committed to git; copy from
  `config.example.json`).
