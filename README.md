# URL Shortener API

Backend API for a personal URL shortener application. It manages user
registration, authentication, and the creation and listing of shortened URLs.

The public redirect flow is intentionally outside this service: an API Gateway
and Lambda function can resolve a short code and redirect the visitor to the
original URL.

## Tech Stack

- Node.js and TypeScript
- Express
- MongoDB Atlas with Mongoose
- JSON Web Tokens (JWT) for authenticated routes
- bcrypt for password hashing
- nanoid for short-code generation

## Architecture

The project follows a small module-based structure:

```text
src/
  config/       Environment configuration
  database/     MongoDB connection
  middleware/   JWT authentication middleware
  modules/
    auth/       User registration and login
    url/        Short URL creation and user URL listing
  app.ts        Express application and middleware setup
  server.ts     Application bootstrap
```

Request flow:

```text
HTTP request -> route -> controller -> service -> Mongoose model -> MongoDB
```

Main responsibilities:

- `auth`: stores users with hashed passwords and generates JWTs on login.
- `url`: creates a seven-character code and associates it with the authenticated user.
- `authMiddleware`: validates `Authorization: Bearer <token>` for protected endpoints.

Current business rules:

- A user may create up to five shortened URLs.
- Login requests are limited to five attempts per 15 minutes per IP.
- All API requests are limited to 200 requests per 15 minutes per IP.

## API Endpoints

| Method | Path | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/auth/test` | No | Basic API availability check |
| `POST` | `/auth/register` | No | Create an account |
| `POST` | `/auth/login` | No | Authenticate and receive a JWT |
| `POST` | `/url` | Bearer token | Create a shortened URL |
| `GET` | `/url` | Bearer token | List URLs created by the user |

Example login request:

```json
{
  "login": "username-or-email",
  "password": "your-password"
}
```

Example create URL request:

```json
{
  "originalUrl": "https://example.com/a-long-page"
}
```

## Environment Variables

Create a `.env` file in this directory:

```env
PORT=3300
MONGO_URI=mongodb+srv://<app_user>:<url_encoded_password>@<cluster>.mongodb.net/shortner?appName=shortner
BASE_URL=http://localhost:3300
JWT_SECRET=<long_random_secret>
JWT_EXPIRES_IN=1d
```

| Variable | Purpose |
| --- | --- |
| `PORT` | Port where the API listens. Defaults to `3100` when omitted. |
| `MONGO_URI` | MongoDB connection string used by Mongoose. |
| `BASE_URL` | Base URL returned when a short URL is created. |
| `JWT_SECRET` | Secret used to sign and verify access tokens. |
| `JWT_EXPIRES_IN` | Token validity period, for example `1d`. |

Never commit `.env` or paste its values into issues, screenshots, or logs. The
repository ignores `.env`; `.env.example` must contain placeholders only.

If a MongoDB password contains special characters, URL-encode it before placing
it in `MONGO_URI`. For Atlas, use a dedicated application user with read/write
access only to the application database rather than an administrative user.

Generate a JWT secret locally with a cryptographically random value, for
example:

```bash
openssl rand -base64 48
```

## Run Locally

Requirements:

- Node.js 20 or newer
- npm
- An accessible MongoDB database, such as MongoDB Atlas

Install dependencies:

```bash
npm ci
```

Create and configure the environment file:

```bash
cp .env.example .env
```

Add `PORT` if needed and update all placeholder credentials and secrets in
`.env`. Keep `BASE_URL` aligned with the configured port.

Start the API in development mode:

```bash
npm run dev
```

Check that it is responding:

```bash
curl http://localhost:3300/auth/test
```

Expected response:

```text
OK
```

This endpoint checks HTTP availability only. During startup, also verify that
the server logs `Mongo connected`; the current application can continue
listening even when the database connection fails.

## Security Notes

Controls currently implemented by the API:

- Passwords are stored as bcrypt hashes rather than plaintext.
- Protected URL endpoints require a signed JWT bearer token.
- Login and general API traffic are rate limited.
- CORS is limited to configured frontend origins in the application code.

Secure configuration checklist:

- Keep `MONGO_URI` and `JWT_SECRET` in environment variables or a secrets
  manager, never in source control.
- Use a dedicated MongoDB user with the minimum permissions required for this
  application.
- Restrict the MongoDB Atlas IP access list to the environments that need
  access. Do not keep `0.0.0.0/0` enabled for a production deployment.
- Serve the API and redirect endpoint over HTTPS in production.
- Keep `JWT_EXPIRES_IN` reasonably short and rotate `JWT_SECRET` if it is ever
  exposed.
- Review the CORS allowlist before deployment and include only real frontend
  domains.
- Do not log authorization headers, JWTs, passwords, or MongoDB connection
  strings.

Hardening still recommended before treating this API as production-ready:

- Validate required environment variables at startup and fail immediately when
  MongoDB cannot connect.
- Add request validation and normalization on the API, including restricting
  `originalUrl` to valid `http`/`https` destinations and enforcing consistent
  password requirements independently of the frontend.
- Configure Express proxy handling correctly when running behind a load
  balancer or platform proxy so rate limiting uses the intended client IP.
- Add security-focused automated tests for authentication, authorization, rate
  limits, and invalid input.

## Production Build

Compile and run the generated JavaScript:

```bash
npm run build
npm start
```

## Docker

A `Dockerfile` and a `docker-compose.yml` are available for the API. The
Compose setup loads `.env` but does not provision MongoDB; `MONGO_URI` must
point to an existing database.

The current container configuration exposes port `3100`. When using a different
`PORT`, such as `3300`, update the Docker port mapping and exposed port
accordingly before starting it. For a deployed environment, inject secrets
through the hosting platform or a secrets manager instead of distributing a
`.env` file in the image.

```bash
docker compose up --build
```

## Related Redirect Service

This API generates and stores short codes, but it does not currently expose a
public redirect endpoint such as `GET /:code`. Resolution of a short URL and
the redirect to its original address are handled by the separate API Gateway
and Lambda flow.
