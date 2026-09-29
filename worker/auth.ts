const COOKIE = "bceua_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;
const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function timingSafeEqual(a: string, b: string): boolean {
	const encoder = new TextEncoder();
	const aa = encoder.encode(a);
	const bb = encoder.encode(b);
	if (aa.byteLength !== bb.byteLength) return false;
	let out = 0;
	for (let i = 0; i < aa.byteLength; i += 1) out |= aa[i] ^ bb[i];
	return out === 0;
}

async function hmac(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(value),
	);
	return btoa(String.fromCharCode(...new Uint8Array(signature)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

export async function secretsMatch(
	secret: string,
	provided: string,
	expected: string,
): Promise<boolean> {
	const left = await hmac(secret, provided.normalize("NFC"));
	const right = await hmac(secret, expected.normalize("NFC"));
	return timingSafeEqual(left, right);
}

export async function hashPassword(
	secret: string,
	password: string,
): Promise<string> {
	return hmac(secret, password.normalize("NFC"));
}

export async function verifyPasswordHash(
	secret: string,
	password: string,
	passwordHash: string,
): Promise<boolean> {
	const left = await hashPassword(secret, password);
	return timingSafeEqual(left, passwordHash);
}

export async function createSessionToken(
	secret: string,
	username: string,
): Promise<string> {
	const nonce = crypto.randomUUID();
	const payload = `v2:${username}:${Date.now() + SESSION_MS}:${nonce}`;
	const signature = await hmac(secret, payload);
	return `${payload}.${signature}`;
}

export async function getSessionUsername(
	secret: string | undefined,
	token: string | undefined,
): Promise<string | null> {
	if (!secret || !token) return null;
	const lastDot = token.lastIndexOf(".");
	if (lastDot <= 0) return null;
	const payload = token.slice(0, lastDot);
	const signature = token.slice(lastDot + 1);
	const expected = await hmac(secret, payload);
	if (!timingSafeEqual(signature, expected)) return null;
	const parts = payload.split(":");
	if (parts[0] !== "v2" || parts.length < 4) return null;
	const expiresAt = Number(parts[2]);
	if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
	const username = parts[1]?.trim();
	return username || null;
}

export async function isValidSession(
	secret: string | undefined,
	token: string | undefined,
): Promise<boolean> {
	return (await getSessionUsername(secret, token)) != null;
}

export function sessionCookie(token: string, secure: boolean): string {
	const parts = [
		`${COOKIE}=${token}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Strict",
		`Max-Age=${Math.floor(SESSION_MS / 1000)}`,
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
	const parts = [
		`${COOKIE}=`,
		"Path=/",
		"HttpOnly",
		"SameSite=Strict",
		"Max-Age=0",
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

export function readCookie(
	header: string | null,
	name = COOKIE,
): string | undefined {
	if (!header) return undefined;
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) return rest.join("=");
	}
	return undefined;
}

type AttemptRow = {
	failures: number;
	locked_until: string | null;
};

export async function getLockout(
	db: D1Database,
	ip: string,
): Promise<{ locked: boolean; retryAfterSec: number }> {
	const row = await db
		.prepare("SELECT failures, locked_until FROM login_attempts WHERE ip = ?")
		.bind(ip)
		.first<AttemptRow>();
	if (!row?.locked_until) return { locked: false, retryAfterSec: 0 };
	const until = Date.parse(row.locked_until);
	if (!Number.isFinite(until) || until <= Date.now()) {
		return { locked: false, retryAfterSec: 0 };
	}
	return {
		locked: true,
		retryAfterSec: Math.ceil((until - Date.now()) / 1000),
	};
}

export async function recordLoginFailure(
	db: D1Database,
	ip: string,
): Promise<void> {
	const now = new Date().toISOString();
	const row = await db
		.prepare("SELECT failures, locked_until FROM login_attempts WHERE ip = ?")
		.bind(ip)
		.first<AttemptRow>();
	const previous = row?.failures ?? 0;
	const stillLocked =
		row?.locked_until && Date.parse(row.locked_until) > Date.now();
	const failures = stillLocked ? previous + 1 : previous >= MAX_FAILURES ? 1 : previous + 1;
	const lockedUntil =
		failures >= MAX_FAILURES
			? new Date(Date.now() + LOCKOUT_MS).toISOString()
			: null;
	await db
		.prepare(
			`INSERT INTO login_attempts (ip, failures, last_attempt_at, locked_until)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET
         failures = excluded.failures,
         last_attempt_at = excluded.last_attempt_at,
         locked_until = excluded.locked_until`,
		)
		.bind(ip, failures, now, lockedUntil)
		.run();
}

export async function recordLoginSuccess(
	db: D1Database,
	ip: string,
): Promise<void> {
	await db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
}

export function clientIp(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ||
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
		"local"
	);
}

export function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get("Origin");
	if (!origin) return request.method === "GET" || request.method === "HEAD";
	return origin === new URL(request.url).origin;
}

export function isJsonRequest(request: Request): boolean {
	return (request.headers.get("Content-Type") ?? "")
		.toLowerCase()
		.includes("application/json");
}
