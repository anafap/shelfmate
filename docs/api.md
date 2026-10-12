# API contract

Phase 1 adds accounts and households under `/api/v1`. Errors use Problem Details and a correlation ID. Health endpoints remain public.

- POST `/auth/register`: `{displayName,email,password}`; 201 session. Password: 12–128 characters. Name: 1–80. Email: valid, max 254.
- POST `/auth/login`: `{email,password}`; 200 session, generic 401 for invalid credentials.
- POST `/auth/refresh`: `{refreshToken}`; atomically rotates both tokens; 401 for expired/replayed tokens.
- POST `/auth/logout`: bearer authenticated; revokes current session; 204.
- GET `/me`: authenticated profile.
- POST `/households`: `{name,timeZone}` with explicit IANA zone; 201 household. One household per user.
- GET `/households/current`: household or 404 when onboarding is needed.
- GET `/households/current/members`: member profiles, accessible only to members.
- GET `/households/current/invites`: owner-only metadata, never stored tokens.
- POST `/households/current/invites`: `{invitedEmail?: string}`; owner-only `{id,token,expiresAt}` once. Share privately; expires in seven days.
- DELETE `/households/current/invites/{id}`: owner-only revocation; 204.
- POST `/household-invites/redeem`: `{token}`; authenticated joined household. Invalid/expired/revoked/redeemed: 400; capacity/existing membership: 409; email mismatch: 403.

Session: `{accessToken,refreshToken,expiresAt,user:{id,displayName,email}}`. Use `Authorization: Bearer <accessToken>`. Access expires in 15 minutes, refresh in 30 days; logout immediately invalidates both. Random opaque tokens are stored only as SHA-256 hashes. Refresh rotation is serialized and single-use. Authentication and invite redemption are limited to 30 requests/minute per remote IP.

Household: `{id,name,timeZone,ownerUserId}`. Members: `{userId,displayName,role,joinedAt}`. Locks and unique membership/slot constraints enforce two-member capacity. No leave/delete/ownership transfer API in this phase.

Apply explicit EF migrations before startup. Health readiness checks connectivity only. Inventory, shopping, SignalR, in-app alerts, and scheduled push dispatch are described below. Push delivery still requires Expo and Android provider credentials.

## Phase 2 inventory contract

All routes below require current household membership and are scoped from the bearer identity. Foreign-household item IDs return 404.

- GET `/households/current/categories`: system reference categories `{id,name,key,isSystemDefined}`.
- GET `/households/current/inventory?category=&status=Active&search=&sort=expiry&page=1&pageSize=20`: `{items,total,page,pageSize}`. Status: Active (default), Consumed, Discarded, All. Sort: expiry (unknown dates last), name, updated. Page size: 1–100; search max 120 characters.
- POST `/households/current/inventory`: 201 item. Body `{name,categoryId,quantity,unit,purchaseDate?,expiryDate?,expiryType,storageLocation?,notes?,reminderEnabled}`. Name max 120, quantity >0 and <=1,000,000 with at most three decimals, units piece/g/kg/ml/l/pack/bottle/box. Dates use YYYY-MM-DD, 1900–2100; purchase cannot be after household-local today. Missing expiry requires Unknown; provided expiry requires Printed or Estimated. Location max 80; notes max 2000. Default location is Home.
- GET `/households/current/inventory/{id}`: item.
- PATCH `/households/current/inventory/{id}`: complete editable snapshot as above, plus required `version` UUID. Only Active items can be edited. A stale version or racing update returns 409; reload the latest record before reviewing/resubmitting. No last-writer-wins behavior.
- POST `/households/current/inventory/{id}/consume` or `/discard`: `{version}`; only Active can transition. History remains in the database; reminder flag is disabled. No hard delete or reactivation endpoint.

Item includes editable fields plus `{id,householdId,status,version,expiryStatus,daysRemaining,householdLocalDate,createdBy,updatedBy,createdAt,updatedAt}`. Active expiryStatus is Expired (<0 days), ExpiringSoon (0–7), OK (>7), or Unknown (missing date). Display day 0 as expiry today. Consumed/Discarded items have null expiryStatus/daysRemaining. ExpiryType remains distinct from lifecycle/urgency. No date is invented from a purchase date.

Inventory is refreshed after local writes and in response to household-scoped SignalR resource-change events. System categories are migration-seeded reference data, not sample household records. Consumed/Discarded filters serve as the archive/history view.

## Phase 3 dashboard

GET `/households/current/dashboard` requires current membership and returns `{householdId,householdName,householdLocalDate,activeCount,expiringSoonCount,expiryTodayOrPastCount,shoppingListCount,useFirst}`. Counts include only Active records. ExpiringSoon counts 1–7 days; today/past counts dates <= household-local today. Unknown dates count toward activeCount but not date-based counts or Use First. Use First includes the first ten Active items with non-null dates, ordered by expiry date, then name and ID; it uses the inventory item DTO including Printed/Estimated labels. `shoppingListCount` is the current count of ToBuy shopping items. Reads use one consistent database snapshot and one captured clock instant.

## Phase 4 shopping

Member-scoped `/households/current/shopping-items`: GET returns item list; POST `{name,categoryId?,quantity?,unit?,notes?}` creates; PATCH `/{id}` accepts those fields and required `version`; DELETE `/{id}?version=` removes after version checking. Names/quantities/units/notes use inventory bounds. DTO includes status, version, purchaser ID/name/time, linked inventory ID and audit fields.

POST `/{id}/purchase` takes `{version,purchased,operationId}`. Operation ID must be a UUID, retained by the client on retry. Identical last-operation retries return the record without toggling or changing purchaser/time. Stale unrelated versions return 409. Unchecking clears purchase metadata; transferred items cannot be unchecked.

POST `/{id}/transfer-to-inventory` takes `{version,item:<inventory create fields>,confirmSeparateItem:false}`. Purchase and transfer are separate. Transfer locks the shopping row and creates/link inventory in one transaction; repeated/concurrent transfer returns the same inventory record, even after a lost response. Existing active inventory with the same name requires explicit `confirmSeparateItem:true`; otherwise 409 prompts review. Only purchased records transfer. Dashboard shoppingListCount now counts ToBuy records.

## Phase 5 live changes

Authenticated SignalR hub `/hubs/household` assigns the connection to its server-resolved household group; clients cannot choose household IDs or subscribe to another group. `ResourceChanged` carries only `{resource}` and clients refetch authoritative records. Successful writes publish after the API operation completes; replay-safe writes can emit harmless refetch events. Disconnect/reconnect and foreground resume trigger refetch. Hub access tokens expire and reconnect obtains a fresh token; logout stops the subscription and clears private caches. Browser WebSocket tokens use `access_token` only on this hub route; hosting/proxy logs must not record that query parameter.

## Phase 6 reminders

GET/PUT `/me/notification-preferences` applies to the caller's current household. Preferences: `{pushEnabled,inAppEnabled,dayOffsets,mutedCategoryIds,localDeliveryTime}`. Defaults: push off, in-app on, offsets [7,3,1,0], 09:00 local time. Offsets must be unique integers 0–365 (up to 16); local delivery uses HH:mm; muted IDs must be known categories. The largest selected offset controls that user's computed urgency window.

GET `/households/current/alerts` returns current Active, reminder-enabled products within that window (including passed dates), filtered by in-app/category preferences. Unknown dates never generate alerts. GET/POST `/me/push-devices` lists safe metadata/registers `{token,platform}`; DELETE `/{id}` invalidates the caller's device. Registering binds the token to the authenticated account/session; online logout invalidates its associated device.

The scheduled worker checks calendar dates, selected offsets, household-local delivery time, membership, preferences, lifecycle, date snapshot and valid tokens at dispatch. Notification logs have unique user+item+date+offset keys. A durable claim precedes network dispatch; an uncertain/crashed attempt is not blindly resent, preventing duplicate messages at the cost of possible missed delivery. In-app alerts remain available. Expo ticket receipts invalidate DeviceNotRegistered tokens. Push delivery is not guaranteed at an exact time. Real Expo project/FCM credentials and physical-device verification are separate prerequisites; no working push is claimed without them.
