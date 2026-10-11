import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

/**
 * Secret used to sign/verify JWTs.
 *
 * Read lazily on each call (rather than captured at module load) so that:
 *  - tests / tooling that set `process.env.JWT_SECRET` after import still work,
 *  - the same module instance behaves consistently across the request lifecycle.
 *
 * In production a missing secret is a hard failure — signing tokens with
 * `undefined` (jsonwebtoken throws) or a shared fallback would be a security
 * hole. Outside production we fall back to a fixed development secret so that
 * `next dev` and the test-suite work without extra configuration.
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is not configured (must be at least 16 characters)."
    );
  }

  return "dev-insecure-jwt-secret-change-me";
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function comparePassword(
  password: string,
  hashedPassword: string
): boolean {
  return bcrypt.compareSync(password, hashedPassword);
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}
