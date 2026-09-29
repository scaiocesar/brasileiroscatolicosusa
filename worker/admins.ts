import { hashPassword } from "./auth";
import type { AdminUser, AdminUserStatus } from "../shared/types";

type AdminRow = {
	id: number;
	username: string;
	username_key: string;
	display_name: string | null;
	password_hash: string;
	status: AdminUserStatus;
	created_at: string;
	updated_at: string;
	last_login_at: string | null;
};

export type AdminRecord = AdminRow;

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,40}$/;

export function normalizeUsernameKey(username: string): string {
	return username.trim().toLowerCase();
}

export function validateAdminUsername(username: string): string | null {
	const value = username.trim();
	if (!USERNAME_RE.test(value)) {
		return "Usuário deve ter 3–40 caracteres (letras, números, . _ -).";
	}
	return null;
}

export function validateAdminPassword(password: string): string | null {
	if (password.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
	if (password.length > 128) return "A senha é longa demais.";
	return null;
}

function toPublic(row: AdminRow): AdminUser {
	return {
		id: row.id,
		username: row.username,
		display_name: row.display_name,
		status: row.status,
		created_at: row.created_at,
		updated_at: row.updated_at,
		last_login_at: row.last_login_at,
	};
}

export async function countAdmins(db: D1Database): Promise<number> {
	const row = await db
		.prepare("SELECT COUNT(*) AS total FROM admins")
		.first<{ total: number }>();
	return row?.total ?? 0;
}

export async function countActiveAdmins(db: D1Database): Promise<number> {
	const row = await db
		.prepare("SELECT COUNT(*) AS total FROM admins WHERE status = 'active'")
		.first<{ total: number }>();
	return row?.total ?? 0;
}

export async function listAdmins(db: D1Database): Promise<AdminUser[]> {
	const rows = await db
		.prepare(
			`SELECT id, username, username_key, display_name, password_hash, status,
        created_at, updated_at, last_login_at
       FROM admins
       ORDER BY datetime(created_at) ASC`,
		)
		.all<AdminRow>();
	return (rows.results ?? []).map(toPublic);
}

export async function getAdminById(
	db: D1Database,
	id: number,
): Promise<AdminRecord | null> {
	if (!Number.isInteger(id) || id <= 0) return null;
	return (
		(await db
			.prepare(
				`SELECT id, username, username_key, display_name, password_hash, status,
          created_at, updated_at, last_login_at
         FROM admins WHERE id = ?`,
			)
			.bind(id)
			.first<AdminRow>()) ?? null
	);
}

export async function getAdminByUsername(
	db: D1Database,
	username: string,
): Promise<AdminRecord | null> {
	const key = normalizeUsernameKey(username);
	if (!key) return null;
	return (
		(await db
			.prepare(
				`SELECT id, username, username_key, display_name, password_hash, status,
          created_at, updated_at, last_login_at
         FROM admins WHERE username_key = ?`,
			)
			.bind(key)
			.first<AdminRow>()) ?? null
	);
}

export async function createAdmin(
	db: D1Database,
	input: {
		username: string;
		display_name?: string | null;
		password: string;
		authSecret: string;
		status?: AdminUserStatus;
	},
): Promise<AdminUser> {
	const username = input.username.trim();
	const usernameError = validateAdminUsername(username);
	if (usernameError) throw new Error(usernameError);
	const passwordError = validateAdminPassword(input.password);
	if (passwordError) throw new Error(passwordError);

	const usernameKey = normalizeUsernameKey(username);
	const existing = await getAdminByUsername(db, username);
	if (existing) throw new Error("Já existe um admin com esse usuário.");

	const passwordHash = await hashPassword(input.authSecret, input.password);
	const displayName = input.display_name?.trim() || null;
	const status = input.status ?? "active";

	const result = await db
		.prepare(
			`INSERT INTO admins (username, username_key, display_name, password_hash, status)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, username, username_key, display_name, password_hash, status,
         created_at, updated_at, last_login_at`,
		)
		.bind(username, usernameKey, displayName, passwordHash, status)
		.first<AdminRow>();

	if (!result) throw new Error("Não foi possível criar o admin.");
	return toPublic(result);
}

export async function updateAdmin(
	db: D1Database,
	id: number,
	input: {
		username?: string;
		display_name?: string | null;
	},
): Promise<AdminUser | null> {
	const existing = await getAdminById(db, id);
	if (!existing) return null;

	const username =
		input.username !== undefined ? input.username.trim() : existing.username;
	const usernameError = validateAdminUsername(username);
	if (usernameError) throw new Error(usernameError);

	const usernameKey = normalizeUsernameKey(username);
	if (usernameKey !== existing.username_key) {
		const clash = await getAdminByUsername(db, username);
		if (clash && clash.id !== id) {
			throw new Error("Já existe um admin com esse usuário.");
		}
	}

	const displayName =
		input.display_name !== undefined
			? input.display_name?.trim() || null
			: existing.display_name;

	const result = await db
		.prepare(
			`UPDATE admins
       SET username = ?, username_key = ?, display_name = ?, updated_at = datetime('now')
       WHERE id = ?
       RETURNING id, username, username_key, display_name, password_hash, status,
         created_at, updated_at, last_login_at`,
		)
		.bind(username, usernameKey, displayName, id)
		.first<AdminRow>();

	return result ? toPublic(result) : null;
}

export async function setAdminStatus(
	db: D1Database,
	id: number,
	status: AdminUserStatus,
): Promise<AdminUser | null> {
	if (status === "blocked") {
		const active = await countActiveAdmins(db);
		const current = await getAdminById(db, id);
		if (!current) return null;
		if (current.status === "active" && active <= 1) {
			throw new Error("Não é possível bloquear o último admin ativo.");
		}
	}

	const result = await db
		.prepare(
			`UPDATE admins
       SET status = ?, updated_at = datetime('now')
       WHERE id = ?
       RETURNING id, username, username_key, display_name, password_hash, status,
         created_at, updated_at, last_login_at`,
		)
		.bind(status, id)
		.first<AdminRow>();

	return result ? toPublic(result) : null;
}

export async function resetAdminPassword(
	db: D1Database,
	id: number,
	password: string,
	authSecret: string,
): Promise<AdminUser | null> {
	const passwordError = validateAdminPassword(password);
	if (passwordError) throw new Error(passwordError);
	const existing = await getAdminById(db, id);
	if (!existing) return null;

	const passwordHash = await hashPassword(authSecret, password);
	const result = await db
		.prepare(
			`UPDATE admins
       SET password_hash = ?, updated_at = datetime('now')
       WHERE id = ?
       RETURNING id, username, username_key, display_name, password_hash, status,
         created_at, updated_at, last_login_at`,
		)
		.bind(passwordHash, id)
		.first<AdminRow>();

	return result ? toPublic(result) : null;
}

export async function touchAdminLogin(
	db: D1Database,
	id: number,
): Promise<void> {
	await db
		.prepare(
			`UPDATE admins
       SET last_login_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
		)
		.bind(id)
		.run();
}

export async function ensureBootstrapAdmin(
	db: D1Database,
	authSecret: string,
	envUsername: string | undefined,
	envPassword: string | undefined,
): Promise<AdminRecord | null> {
	const total = await countAdmins(db);
	if (total > 0) return null;
	if (!envUsername?.trim() || !envPassword) return null;

	const created = await createAdmin(db, {
		username: envUsername.trim(),
		display_name: "Administrador",
		password: envPassword,
		authSecret,
		status: "active",
	});
	return getAdminById(db, created.id);
}

export function publicAdmin(row: AdminRecord): AdminUser {
	return toPublic(row);
}
