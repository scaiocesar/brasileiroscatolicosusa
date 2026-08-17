const COOKIE = "bceua_admin";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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

export async function createSessionToken(secret: string): Promise<string> {
	const payload = `admin:${Date.now() + WEEK_MS}`;
	const signature = await hmac(secret, payload);
	return `${payload}.${signature}`;
}

export async function isValidSession(
	secret: string | undefined,
	token: string | undefined,
): Promise<boolean> {
	if (!secret || !token) return false;
	const lastDot = token.lastIndexOf(".");
	if (lastDot <= 0) return false;
	const payload = token.slice(0, lastDot);
	const signature = token.slice(lastDot + 1);
	const expected = await hmac(secret, payload);
	if (!timingSafeEqual(signature, expected)) return false;
	const [, expiry] = payload.split(":");
	const expiresAt = Number(expiry);
	return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function sessionCookie(token: string, secure: boolean): string {
	const parts = [
		`${COOKIE}=${token}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		`Max-Age=${Math.floor(WEEK_MS / 1000)}`,
	];
	if (secure) parts.push("Secure");
	return parts.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
	const parts = [
		`${COOKIE}=`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
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

export function passwordsMatch(
	provided: string,
	expected: string | undefined,
): boolean {
	if (!expected) return false;
	return timingSafeEqual(provided, expected);
}
