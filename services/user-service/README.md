# Streamly User Service

Owns public user profiles, channel identity, and user preferences. Authentication credentials, passwords, sessions, and token issuance belong in `auth-service`, not here.

## Requirements

- Node.js 22+
- PostgreSQL from the Streamly infrastructure Compose stack

## Run locally

```bash
cp .env.example .env
npm install
npm run dev
```

The service applies versioned SQL migrations at startup. Set `DATABASE_URL` to your existing PostgreSQL instance.

## Endpoints

- `GET /health/live` — process liveness
- `GET /health/ready` — database readiness
- `GET /api/v1/users/:userId` — public profile
- `GET /api/v1/me/profile` — current user's profile (requires `x-user-id` and internal API key)
- `PUT /api/v1/me/profile` — update current user's profile
- `GET /api/v1/me/preferences` — get current user's preferences
- `PUT /api/v1/me/preferences` — update current user's preferences

Protected endpoints expect `x-internal-api-key: <INTERNAL_API_KEY>` and `x-user-id: <authenticated-user-id>`. This is a development service-to-service contract: the gateway must validate the user's access token and inject the trusted identity headers after stripping any client-supplied versions. Never expose the internal API key or let untrusted clients reach this service directly.

## Data ownership

The service creates its own PostgreSQL schema, `user_service`, within the configured database. It does not own auth credentials or sessions. For a production multi-service deployment, use a separate database/user and credentials per service.

## Notes

- The default internal key is for local development only.
- Public profile lookup returns only public profile fields.
- Profile and preference updates are validated and parameterized.
- This is a working baseline; add service-to-service identity signing, audit events, and production secrets management before deployment.
