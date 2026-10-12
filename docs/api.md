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

Apply explicit EF migrations before startup. Health readiness checks connectivity only. Inventory is described below. Shopping, sync, alerts and push remain future phases.

## Phase 2 inventory contract

All routes below require current household membership and are scoped from the bearer identity. Foreign-household item IDs return 404.

- GET `/households/current/categories`: system reference categories `{id,name,key,isSystemDefined}`.
- GET `/households/current/inventory?category=&status=Active&search=&sort=expiry&page=1&pageSize=20`: `{items,total,page,pageSize}`. Status: Active (default), Consumed, Discarded, All. Sort: expiry (unknown dates last), name, updated. Page size: 1–100; search max 120 characters.
- POST `/households/current/inventory`: 201 item. Body `{name,categoryId,quantity,unit,purchaseDate?,expiryDate?,expiryType,storageLocation?,notes?,reminderEnabled}`. Name max 120, quantity >0 and <=1,000,000 with at most three decimals, units piece/g/kg/ml/l/pack/bottle/box. Dates use YYYY-MM-DD, 1900–2100; purchase cannot be after household-local today. Missing expiry requires Unknown; provided expiry requires Printed or Estimated. Location max 80; notes max 2000. Default location is Home.
- GET `/households/current/inventory/{id}`: item.
- PATCH `/households/current/inventory/{id}`: complete editable snapshot as above, plus required `version` UUID. Only Active items can be edited. A stale version or racing update returns 409; reload the latest record before reviewing/resubmitting. No last-writer-wins behavior.
- POST `/households/current/inventory/{id}/consume` or `/discard`: `{version}`; only Active can transition. History remains in the database; reminder flag is disabled. No hard delete or reactivation endpoint.

Item includes editable fields plus `{id,householdId,status,version,expiryStatus,daysRemaining,householdLocalDate,createdBy,updatedBy,createdAt,updatedAt}`. Active expiryStatus is Expired (<0 days), ExpiringSoon (0–7), OK (>7), or Unknown (missing date). Display day 0 as expiry today. Consumed/Discarded items have null expiryStatus/daysRemaining. ExpiryType remains distinct from lifecycle/urgency. No date is invented from a purchase date.

Phase 2 uses authoritative fetch/refetch; SignalR and reminder delivery remain future phases. System categories are migration-seeded reference data, not sample household records. Consumed/Discarded filters serve as the archive/history view.
