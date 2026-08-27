# eBay sale-status sync — scoping notes

Not built yet. This is what it'll take when we get to it.

## Goal
Automatically pull order/refund status from your eBay seller account so a
`sales` row with `channel = 'eBay'` (and someday a return) can update itself
instead of you re-typing what eBay already knows.

## What you already have
API keys — good. Worth confirming before we start:
- Are they **sandbox** or **production** keys? Sandbox is worth building
  against first even if slower, since mistakes there don't touch real orders.
- Do you have a registered eBay application (Client ID + Client Secret from
  the eBay Developer Program), or just a personal access token? The sync
  needs the former — a personal token alone won't support the OAuth flow
  below.

## The flow
1. **OAuth consent (one-time, per your seller account).** eBay's Sell APIs
   need a *user* access token, not just an app token — that means a
   3-legged OAuth flow: you click "Connect eBay" in Settings, get sent to
   eBay to log in and approve access, eBay redirects back with an
   authorization code, and the app exchanges that for an access token +
   refresh token. The refresh token gets stored (encrypted) so the app can
   silently mint new access tokens going forward without you re-logging in
   every hour.
2. **Order sync.** A scheduled job (or a "Sync now" button to start) calls
   eBay's Sell Fulfillment API (`GET /sell/fulfillment/v1/order`) for
   recent orders, and matches each one to a `sales` row — most reliably by
   storing eBay's order ID on the sale the first time it matches (needs one
   new column: `sales.external_ref text`), falling back to fuzzy-matching
   by date + price for anything sold before the sync existed.
3. **Status + refund updates.** Once matched, order status (shipped,
   delivered) and refund/cancellation events can flow back to update the
   sale — and eventually create a `returns` row automatically instead of
   you doing it by hand.

## Small schema addition when we start
```sql
alter table sales add column if not exists external_ref text;
create unique index if not exists sales_external_ref_idx on sales(external_ref) where external_ref is not null;
```

## Order of operations
1. Confirm sandbox vs. production keys and app registration
2. Build the OAuth connect flow + token storage
3. Build one-way sync: eBay order → match existing `sales` row → show status
4. Layer in refund/return detection once the basic sync is solid

No code yet — just wanted this written down so it's not a cold start when
we pick it up.
