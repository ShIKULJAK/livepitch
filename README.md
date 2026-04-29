# Live Pitch

Production-minded Next.js app for football competition management.

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL
- Prisma ORM
- NextAuth (Credentials)
- TanStack Query

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure env:
```bash
cp .env.example .env
```
Update `DATABASE_URL` and `AUTH_SECRET`.

3. Generate Prisma client and run migrations:
```bash
npm run prisma:generate
npx prisma migrate deploy
```

4. Seed demo data:
```bash
npm run prisma:seed
```

5. Start app:
```bash
npm run dev
```

## Demo credentials

All seeded users use the same password:

`LivePitch!2026`

- `admin@livepitch.app`
- `manager@livepitch.app`
- `editor@livepitch.app`
- `viewer@livepitch.app`

## Notes

- Dark theme is default.
- Protected routes require authenticated session.
- Admin-only sections: Roles, Billing, Security, Integrations.

# livepitch
