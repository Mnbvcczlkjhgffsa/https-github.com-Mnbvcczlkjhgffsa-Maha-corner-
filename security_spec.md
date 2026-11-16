# Follower Management Security Specification (MAHA CORNER)

## 1. Data Invariants
1. **PII Isolation:** Personal information (`name`, `mobile`) in `/followers/{followerId}` MUST only be readable (`get`, `list`), updatable, or deletable by verified Admin (`kamleshpatil9719@gmail.com` with `email_verified == true` or `/admins/{uid}`).
2. **Duplicate Prevention:** Each phone number maps deterministically to a SHA-256 hex `followerId`. Creating a `/followers/{followerId}` record requires creating a matching `/follower_hashes/{followerId}` document atomically (`existsAfter`), and updates by non-admins are forbidden (`update: if isAdmin()`), making duplicate registrations impossible at the database layer.
3. **Consent & Strict Schema:** Every `/followers` create payload MUST have `consentGiven == true`, a valid 10-digit Indian mobile (`^[6-9][0-9]{9}$`), `name` length `2..80`, bounded `interests` array (`1..6` strings), and server timestamp (`createdAt == request.time`). No ghost fields are allowed (`hasAll` + `hasOnly`).
4. **No Hash Enumeration / Scraping:** `/follower_hashes/{hashId}` allows single-document `get` ONLY for exact valid 64-char SHA-256 hex IDs to check duplicate state gracefully, and strictly forbids `list: if false` so attackers cannot list all hashes.

## 2. Adversarial "Dirty Dozen" Attack Payloads
1. Unauthenticated or non-admin `get` on `/followers/{followerId}` -> **PERMISSION_DENIED**
2. Unauthenticated or non-admin `list` on `/followers` -> **PERMISSION_DENIED**
3. Non-admin `update` or `delete` on `/followers/{followerId}` -> **PERMISSION_DENIED**
4. `list` query on `/follower_hashes` -> **PERMISSION_DENIED**
5. Creating `/followers/{id}` with `consentGiven: false` -> **PERMISSION_DENIED**
6. Creating `/followers/{id}` with invalid mobile `"12345"` -> **PERMISSION_DENIED**
7. Creating `/followers/{id}` with ghost field `{ isAdmin: true }` -> **PERMISSION_DENIED**
8. Creating `/followers/{id}` without matching `/follower_hashes/{id}` batch write -> **PERMISSION_DENIED**
9. Creating `/followers/{id}` with forged client timestamp `createdAt` != `request.time` -> **PERMISSION_DENIED**
10. Poisoning `/followers/{poisonedId}` with >128 char or special-char document ID -> **PERMISSION_DENIED**
11. Unverified email spoofing `kamleshpatil9719@gmail.com` with `email_verified: false` -> **PERMISSION_DENIED**
12. Non-admin tampering `/portal_stats/summary` to decrement or jump counter by +999 -> **PERMISSION_DENIED**
