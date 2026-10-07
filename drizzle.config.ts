import { defineConfig } from "drizzle-kit";

import { parseConnectionString } from "./src/server/db/connection-string";

// Scripts read .env.local the same way Next.js does.
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI / Vercel provide real environment variables instead.
}

// Session pooler: migrations need a regular (non-transaction-pooled) session.
// Discrete credentials so passwords with special characters need no URL-encoding.
const url = process.env.DATABASE_URL_SESSION ?? "";
const c = url && !url.includes("[YOUR-PASSWORD]") ? parseConnectionString(url) : null;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  schemaFilter: ["app"],
  dbCredentials: c
    ? {
        host: c.host,
        port: c.port,
        user: c.user,
        password: c.password,
        database: c.database,
        ssl: c.host === "localhost" || c.host === "127.0.0.1" ? false : { rejectUnauthorized: false },
      }
    : { url: "postgresql://localhost/unconfigured" },
  strict: true,
  verbose: true,
});
