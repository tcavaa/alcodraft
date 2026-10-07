/** Shared by the proxy (no DB access) and the session code. */
export const SESSION_COOKIE = "alcodraft_session";

/** Sessions slide: every visit within this window keeps the user signed in. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Don't write `last_seen_at` more often than this. */
export const SESSION_TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export const LOGIN_PATH = "/admin/login";
export const HOME_PATH = "/admin";
