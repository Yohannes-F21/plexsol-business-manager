import { hash, verify } from "@node-rs/argon2";

/** Argon2id options (OWASP-recommended baseline). */
const ARGON2_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  // @node-rs/argon2 defaults to Argon2id.
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    // Parameters are embedded in the Argon2 encoded hash.
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
