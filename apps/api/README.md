# Booking System API (development)

This is a minimal API skeleton for the Booking System used for local development and experimenting with the Identity domain.

Quick start

Install dependencies from the `apps/api` folder:

```bash
cd apps/api
npm install
npm run dev
```

Endpoints

- POST /identity/register
  - Body: { "email": "user@example.com", "password": "secret", "roles": ["patient"] }
  - Returns: { "id": "uuid" }

- GET /identity/:id
  - Returns: basic user projection (id, email, roles, createdAt)

Notes

- This implementation uses an in-memory repository for demo and testing purposes.
- Passwords are hashed using `bcryptjs`.
- The design follows DDD/CQRS patterns with separate command and query handlers; no heavy business logic is included in handlers.
