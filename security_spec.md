# Phase 0: Payload-First Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Master Gate & Relational Ownership**: Every `/students/{studentId}` document must have `studentId == request.auth.uid` and `data.uid == request.auth.uid`. Every subcollection document (`/students/{studentId}/attempts/{attemptId}` and `/students/{studentId}/doubts/{doubtId}`) requires that the parent `/students/{studentId}` document exists (`exists(...)`) and belongs to `request.auth.uid` (`get(...).data.uid == request.auth.uid`).
2. **Verified Identity**: All write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **Strict Schema & Anti-Shadow Keys**: Every create operation enforces `data.keys().hasAll(...)` and `data.keys().hasOnly(...)`. Every update operation wraps logic in `isValidStudentProfile(incoming())` and enforces `incoming().diff(existing()).affectedKeys().hasOnly(...)`.
4. **Immortal & Temporal Integrity**: `uid` and `createdAt` are immutable on update (`incoming().uid == existing().uid && incoming().createdAt == existing().createdAt`). Creation requires `incoming().createdAt == request.time`, and updates require `incoming().updatedAt == request.time`.
5. **Path Variable Hardening & Volumetric Boundaries**: All document IDs (`studentId`, `attemptId`, `doubtId`) are validated with `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars). Every string and array is strictly bounded in size.

## 2. The "Dirty Dozen" Payloads (All Must Return `PERMISSION_DENIED`)
1. **Payload 1 (Unauthenticated Read/Write)**: `auth = null` attempting `get` on `/students/user_1`.
2. **Payload 2 (Unverified Email Write)**: `auth = { uid: "user_1", token: { email_verified: false } }` attempting `create` on `/students/user_1`.
3. **Payload 3 (Identity Spoofing on Create)**: `auth.uid = "user_1"` creating `/students/user_1` with `uid: "user_2"`.
4. **Payload 4 (Cross-User PII/Profile Read)**: `auth.uid = "user_2"` attempting `get` or `list` on `/students/user_1`.
5. **Payload 5 (Shadow Field Injection on Create)**: Creating `/students/user_1` with an extra undeclared field `isAdmin: true`.
6. **Payload 6 (Shadow Field Injection on Update)**: Updating `/students/user_1` with `isVerified: true` outside `affectedKeys().hasOnly(...)`.
7. **Payload 7 (Value Poisoning on Update)**: Updating `/students/user_1` field `adaptiveRating` with a string `"999999"` instead of a bounded number.
8. **Payload 8 (Immortal Field Mutation)**: Updating `/students/user_1` by changing `createdAt` or `uid`.
9. **Payload 9 (Client Timestamp Forgery)**: Creating `/students/user_1` with a past/future timestamp where `createdAt != request.time`.
10. **Payload 10 (Orphaned Subcollection Write)**: Creating `/students/user_1/attempts/att_1` when `/students/user_1` does not exist.
11. **Payload 11 (Path ID Poisoning)**: Creating `/students/user_1/attempts/invalid$id!@#` failing `isValidId()`.
12. **Payload 12 (Unbounded Array Exhaustion)**: Updating `/students/user_1` with `weakTopics` containing 25 items (`size() > 10`).

## 3. Red Team Audit & Conflict Report
- `/students/{studentId}`:
  - Identity Spoofing: Blocked (`studentId == request.auth.uid && data.uid == request.auth.uid`).
  - State Shortcutting: Bounded rating (`800..2400`), accuracy (`0..100`).
  - Resource Poisoning: All strings and `weakTopics` array strictly size-checked.
  - Update Validation Helper: `isValidStudentProfile(incoming())` wraps the entire `allow update` block.
- `/students/{studentId}/attempts/{attemptId}`:
  - Master Gate: Enforces parent `/students/{studentId}` existence and ownership. Immutable history (no updates allowed).
- `/students/{studentId}/doubts/{doubtId}`:
  - Master Gate: Enforces parent `/students/{studentId}` existence and ownership.
