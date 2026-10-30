# Streamly Auth Service

Fastify + TypeScript authentication service for local Streamly development.

## Features

- User registration and login
- Argon2id password hashing
- Short-lived signed JWT access tokens
- Opaque refresh tokens stored only as SHA-256 hashes
- Refresh-token rotation and logout revocation
- `GET /api/v1/auth/me` protected by JWT
- PostgreSQL schema and migration
- Zod input validation, CORS, Helmet, rate limiting
- Health/readiness endpoints

## Setup

Run the infrastructure Compose stack first. Copy the environment file and set a real random JWT secret:

```bash
cp .env.example .env
# Generate a secret with: openssl rand -base64 48
```

Set `JWT_ACCESS_SECRET` in `.env` to the generated value. Then:

```bash
pnpm install
```

If this service is part of the Streamly workspace, run commands from the repository root and ensure workspace configuration includes `services/auth-service`.

Apply the SQL migration using `psql`:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migrations/001_auth.sql
```

Or from the repository root with the database URL loaded from `services/auth-service/.env`:

```bash
psql "postgresql://streamly:streamly_dev_password@localhost:5432/streamly" \
  -v ON_ERROR_STOP=1 -f services/auth-service/migrations/001_auth.sql
```

Start:

```bash
pnpm --filter @streamly/auth-service dev
```

Endpoints:
- `GET /health/live`
- `GET /health/ready`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me` (Bearer access token)

## Example requests

Register:

```bash
curl -i http://localhost:3002/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"jit@example.com","password":"a-long-demo-password","displayName":"Jit"}'
```

Login:

```bash
curl -i http://localhost:3002/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"jit@example.com","password":"a-long-demo-password"}'
```

Call the protected endpoint with the returned access token:

```bash
curl http://localhost:3002/api/v1/auth/me \
  -H 'authorization: Bearer YOUR_ACCESS_TOKEN'
```

Refresh:

```bash
curl -X POST http://localhost:3002/api/v1/auth/refresh \
  -H 'content-type: application/json' \
  -d '{"refreshToken":"YOUR_REFRESH_TOKEN"}'
```

Logout revokes the refresh token provided in the request. Access JWTs are stateless and remain valid until expiry, so keep access-token TTL short; immediate access-token revocation would require a denylist or token-version check.

## Production hardening still required

- Email verification and password-reset workflows
- Account lockout / abuse controls and bot mitigation
- Key rotation using asymmetric JWT keys or a managed signing service
- Refresh-token reuse detection and family-wide revocation
- HTTPS and secure cookie-based refresh token transport where appropriate
- Security review, integration tests, and migration tooling
- A transactional strategy for user creation plus session creation

This is a useful working development baseline, not a fully audited production identity provider.
