/**
 * Parses a Postgres connection string into discrete parts.
 *
 * People paste Supabase's URI with their raw password, which may contain characters
 * that break URL parsing (`@ # / ? %`). The password is taken verbatim between the first
 * ":" after the user and the LAST "@"; only strings that don't fit that shape are parsed
 * as standard (percent-encoded) URLs.
 */
export interface ConnectionParts {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  params: URLSearchParams;
}

const PATTERN = /^postgres(?:ql)?:\/\/([^:@/]+)(?::(.*))?@([^@/?#:]+)(?::(\d+))?(?:\/([^?#]*))?(?:\?(.*))?$/;

export function parseConnectionString(raw: string): ConnectionParts {
  const input = raw.trim();
  // Raw first: the password is everything between "user:" and the last "@" (as typed).
  const m = PATTERN.exec(input);
  if (m) {
    const [, user, password = "", host, port, database, query] = m;
    return {
      host,
      port: port ? Number(port) : 5432,
      user,
      password,
      database: database || "postgres",
      params: new URLSearchParams(query ?? ""),
    };
  }
  const url = new URL(input);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("The database URL is not a valid postgres:// connection string.");
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres",
    params: url.searchParams,
  };
}

/** Same string with the password replaced, safe to print. */
export function redactConnectionString(raw: string): string {
  try {
    const p = parseConnectionString(raw);
    return `postgresql://${p.user}:***@${p.host}:${p.port}/${p.database}`;
  } catch {
    return "(unparseable connection string)";
  }
}
