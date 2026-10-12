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

Apply explicit EF migrations before startup. Health readiness checks connectivity only. Inventory, shopping, sync, alerts and push remain future phases.
