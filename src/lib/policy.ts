/** Limits shared by forms (client) and validation (server). No dependencies, safe to import anywhere. */

export const PASSWORD_MIN = 8;

/** bcrypt only uses the first 72 bytes; anything far longer is not a real password. */
export const PASSWORD_MAX = 200;

/** RFC 5321 limit for an e-mail address. */
export const EMAIL_MAX = 254;

/** Largest id Postgres `integer` columns can hold. */
export const MAX_ID = 2_147_483_647;
