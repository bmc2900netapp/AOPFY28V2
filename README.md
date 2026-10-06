# FY28 AOP Intake

Internal NetApp OCIO initiative-intake portal for the **FY28 Annual Operating Plan**. Replaces the legacy FY27 SharePoint intake (110 ungoverned fields) with a guided 5-phase wizard, conditional logic, validation, person autocomplete, a transcript importer, and an admin dashboard.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Prisma · NextAuth (Microsoft Entra ID) · Microsoft Graph · Recharts

---

## Quick start

```bash
# 1. Install dependencies (lockfile included)
yarn install

# 2. Configure environment
cp .env.example .env     # then fill in real values

# 3. Generate the Prisma client & create the user-account tables
yarn prisma generate
yarn prisma db push

# 4. Run
yarn dev                 # http://localhost:3000
```

---

## Architecture at a glance

| Area | Location |
|------|----------|
| Routes / pages | `app/` (App Router) |
| Intake wizard (5 phases) | `app/dashboard/new/_components/intake-wizard.tsx` |
| Admin dashboard + charts | `app/dashboard/admin/_components/` |
| Submission detail / owner edit | `app/dashboard/submission/[id]/_components/` |
| Transcript importer | `app/dashboard/transcript/` + `app/api/transcript/parse/route.ts` |
| API routes | `app/api/` (submissions, people search, admin export, transcript parse) |
| Shared UI components | `components/ui/` |
| SharePoint data layer | `lib/sharepoint-store.ts` |
| Org directory (reps/areas) | `lib/org-directory.ts` |
| Field metadata / options | `lib/field-metadata.ts` |
| Duplicate detection (fuzzy) | `lib/similarity.ts` |
| Version info | `lib/version.ts` |
| Auth config | `auth.ts` |
| Data model | `prisma/schema.prisma` |

### Data flow
- **Submissions** are stored in a **SharePoint list** (the source of truth), not the database. All CRUD goes through `lib/sharepoint-store.ts`, which calls Microsoft Graph. Field⇄column mapping lives in `FIELD_TO_COLUMN`.
- **User accounts** are the only thing stored in Postgres (via Prisma) — used for authentication.
- **Identity:** the signed-in user is read from request headers injected by the host platform; roles are derived from `ADMIN_EMAILS`.

---

## ⚠️ Platform-specific pieces to re-wire when migrating

This app was built to run on the Abacus.AI hosting platform. The following rely on that platform and **must be re-implemented** in another environment:

1. **SharePoint access** — `lib/sharepoint-store.ts` and `app/api/people/search/route.ts` obtain a Microsoft Graph token via a platform *viewer-connector* exchange (`x-abacus-user-api-key` → connector token). Replace with your own Graph auth (e.g. app-only client credentials or on-behalf-of flow using the Entra ID values in `.env`).
2. **Signed-in identity** — code reads `x-abacus-user-email` / `x-abacus-user-name` headers injected by the platform proxy (see `getViewerIdentity` in `lib/sharepoint-store.ts`). With real SSO you'll read identity from the NextAuth session instead; there is intentionally no login page in the hosted version.
3. **LLM API** — the transcript parser (`app/api/transcript/parse/route.ts`) calls the Abacus RouteLLM endpoint using `ABACUSAI_API_KEY`. Point this at your own LLM provider (OpenAI-compatible chat/completions with JSON response format).
4. **Database** — set `DATABASE_URL` to your own Postgres instance.

Search the codebase for `x-abacus`, `abacus`, and `_getViewerConnectorToken` to find every touch-point.

---

## Key features
- 5-phase guided intake with conditional fields and entry-time validation
- Business Area selector that auto-fills ESTC Rep + CIO Staff engagement points
- Person fields with directory + Microsoft Graph autocomplete
- Transcript import: upload/paste an interview, parse into recommended initiatives, save as drafts
- Admin dashboard with charts, governance fields, and CSV export
- Sortable tables; owner self-edit of submissions; fuzzy duplicate detection

## Versioning
Single source of truth: `lib/version.ts`. Current release: **v1.7.0**.
