# Security Specification - Anime Tracker

This specification documents the security invariants, failure scenarios, and validation rules governing the Firestore database for the Anime Tracker application.

## 1. Data Invariants

1. **Owner Lock**: Every `AnimeTrack` document must belong to a specific authenticated user. Once saved, the `userId` field cannot be modified or falsified.
2. **Immutable Identity**: The `animeId` (Mal API ID or custom ID) is immutable after creation.
3. **Temporal Integrity**: The `createdAt` timestamp is set to the server-side `request.time` upon creation and is immutable, while `updatedAt` matches the server time on any edit.
4. **Range Safeguards**: User-provided anime ratings/scores must be mapped strictly between `0` and `10` inclusive.
5. **String Boundary Defenses**: Text headers are capped, and `notes` fields are limited to `5000` characters to prevent malicious payload bloating (Denial of Wallet attacks).
6. **No Anonymous Scraping**: Read access to a tracked record is strictly restricted to the owning client (`userId == request.auth.uid`).

---

## 2. The "Dirty Dozen" Payloads (Security Edge Cases)

The following payload attempts must be rejected by Firestore Security Rules:

1. **Spoofed Ownership (Create)**: High-privilege write attempting to create a record on behalf of another user's UID.
2. **Ghost Creation (Missing Required)**: Writing an entry missing key elements like `title` or `status`.
3. **Impersonate Modification (Update)**: Editing a record belonging to another user.
4. **Modify Parent Identifier (Update)**: Altering the immutable `animeId` of an existing record.
5. **Hijack Ownership Field (Update)**: Changing the `userId` field of a record to transfer it.
6. **Illegal Rating (Above bounds)**: Rating an anime `11` out of 10.
7. **Negative Episode Multiplier**: Setting episodes watched or total episodes to negative values.
8. **Malicious Notes Bloat (Overflow)**: Writing notes that exceed `5000` characters.
9. **Tampered Creation Timestamp**: Providing a system-falsified client timestamp for `createdAt`.
10. **Tampered Update Timestamp**: Skipping or falsifying `updatedAt` during a change action.
11. **Illegal Status Value**: Setting status to `"super_fan"` or an arbitrary unlisted value.
12. **Foreign Access Vector**: Non-authentic/unauthenticated users requesting a document or listing records.

---

## 3. Test Cases Verification

Both automated audits and manual verification processes confirm that:
- Read/write privileges are blocked for unauthenticated users.
- Resource creation verifies ownership `userId == request.auth.uid`.
- Resource modification limits field updates strictly through structured schema validations.
