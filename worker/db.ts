import {
	MASS_LANGUAGES,
	SERVICE_TYPE_IDS,
	US_STATES,
	WEEKDAYS,
} from "../shared/constants";
import type {
	Community,
	CommunityInput,
	CommunityService,
	CommunityStatus,
	CommunitySummary,
	MassLanguage,
	MassSchedule,
} from "../shared/types";

type CommunityRow = {
	id: number;
	slug: string;
	name: string;
	description: string | null;
	address_line: string;
	city: string;
	state: string;
	zip: string | null;
	lat: number;
	lng: number;
	website_url: string | null;
	whatsapp: string | null;
	instagram: string | null;
	facebook: string | null;
	email: string | null;
	phone: string | null;
	status: CommunityStatus;
	submitted_by_name: string | null;
	submitted_by_email: string | null;
	admin_notes: string | null;
	created_at: string;
	updated_at: string;
	approved_at: string | null;
};

const STATE_CODES = new Set(US_STATES.map((state) => state.code));
const WEEKDAY_IDS = new Set(WEEKDAYS.map((day) => day.id));
const LANGUAGE_IDS = new Set(MASS_LANGUAGES.map((item) => item.id));
const SERVICE_IDS = new Set(SERVICE_TYPE_IDS);

export function slugify(value: string): string {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
}

async function uniqueSlug(
	db: D1Database,
	base: string,
	ignoreId?: number,
): Promise<string> {
	let slug = base || "comunidade";
	let n = 2;
	while (true) {
		const existing = await db
			.prepare("SELECT id FROM communities WHERE slug = ?")
			.bind(slug)
			.first<{ id: number }>();
		if (!existing || existing.id === ignoreId) return slug;
		slug = `${base}-${n}`;
		n += 1;
	}
}

export async function findDuplicateCommunity(
	db: D1Database,
	name: string,
	city: string,
	state: string,
): Promise<number | null> {
	const row = await db
		.prepare(
			`SELECT id FROM communities
       WHERE lower(trim(name)) = lower(trim(?))
         AND lower(trim(city)) = lower(trim(?))
         AND upper(state) = upper(?)
       LIMIT 1`,
		)
		.bind(name, city, state)
		.first<{ id: number }>();
	return row?.id ?? null;
}

function emptyToNull(value: string | null | undefined): string | null {
	if (value == null) return null;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

function isValidEmail(value: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateInput(
	input: CommunityInput,
	options: { requireSubmitter?: boolean } = {},
): string | null {
	if (!input.name?.trim() || input.name.trim().length < 3) {
		return "Informe o nome da comunidade.";
	}
	if (!input.address_line?.trim()) return "Informe o endereço.";
	if (!input.city?.trim()) return "Informe a cidade.";
	if (!input.state || !STATE_CODES.has(input.state as (typeof US_STATES)[number]["code"])) {
		return "Selecione um estado válido.";
	}
	if (options.requireSubmitter) {
		if (!input.submitted_by_name?.trim()) {
			return "Informe o seu nome.";
		}
		if (
			!input.submitted_by_email?.trim() ||
			!isValidEmail(input.submitted_by_email)
		) {
			return "Informe um e-mail válido.";
		}
	}
	if (input.email && !isValidEmail(input.email)) {
		return "E-mail da comunidade inválido.";
	}
	if (input.submitted_by_email && !isValidEmail(input.submitted_by_email)) {
		return "E-mail de contato inválido.";
	}

	for (const schedule of input.mass_schedules ?? []) {
		if (!WEEKDAY_IDS.has(schedule.day_of_week as (typeof WEEKDAYS)[number]["id"])) {
			return "Dia da missa inválido.";
		}
		if (!/^\d{2}:\d{2}$/.test(schedule.time)) {
			return "Horário da missa deve estar no formato HH:MM.";
		}
		if (!LANGUAGE_IDS.has(schedule.language as MassLanguage)) {
			return "Idioma da missa inválido.";
		}
	}

	for (const service of input.services ?? []) {
		if (!SERVICE_IDS.has(service.service_type as (typeof SERVICE_TYPE_IDS)[number])) {
			return "Serviço inválido.";
		}
	}

	return null;
}

async function attachRelated(
	db: D1Database,
	rows: CommunityRow[],
): Promise<Community[]> {
	if (rows.length === 0) return [];
	const ids = rows.map((row) => row.id);
	const placeholders = ids.map(() => "?").join(", ");

	const [schedules, services] = await db.batch([
		db
			.prepare(
				`SELECT * FROM mass_schedules WHERE community_id IN (${placeholders}) ORDER BY sort_order, day_of_week, time`,
			)
			.bind(...ids),
		db
			.prepare(
				`SELECT * FROM community_services WHERE community_id IN (${placeholders})`,
			)
			.bind(...ids),
	]);

	const schedulesById = new Map<number, MassSchedule[]>();
	for (const row of (schedules.results ?? []) as Array<
		MassSchedule & { community_id: number }
	>) {
		const list = schedulesById.get(row.community_id) ?? [];
		list.push({
			id: row.id,
			day_of_week: row.day_of_week,
			time: row.time,
			language: row.language,
			notes: row.notes ?? null,
		});
		schedulesById.set(row.community_id, list);
	}

	const servicesById = new Map<number, CommunityService[]>();
	for (const row of (services.results ?? []) as Array<
		CommunityService & { community_id: number }
	>) {
		const list = servicesById.get(row.community_id) ?? [];
		list.push({
			service_type: row.service_type,
			notes: row.notes ?? null,
		});
		servicesById.set(row.community_id, list);
	}

	return rows.map((row) => ({
		...row,
		mass_schedules: schedulesById.get(row.id) ?? [],
		services: servicesById.get(row.id) ?? [],
	}));
}

export async function listApprovedSitemap(
	db: D1Database,
): Promise<Array<{ slug: string; updated_at: string }>> {
	const rows = await db
		.prepare(
			`SELECT slug, updated_at FROM communities WHERE status = 'approved' ORDER BY name`,
		)
		.all<{ slug: string; updated_at: string }>();
	return rows.results ?? [];
}

export async function listApprovedDetailed(
	db: D1Database,
): Promise<Community[]> {
	const rows = await db
		.prepare(
			`SELECT * FROM communities WHERE status = 'approved' ORDER BY name`,
		)
		.all<CommunityRow>();
	return attachRelated(db, rows.results ?? []);
}

export async function listSummaries(
	db: D1Database,
	status: CommunityStatus = "approved",
): Promise<CommunitySummary[]> {
	const rows = await db
		.prepare(
			`SELECT c.id, c.slug, c.name, c.city, c.state, c.lat, c.lng, c.address_line,
        GROUP_CONCAT(s.service_type) AS service_list
       FROM communities c
       LEFT JOIN community_services s ON s.community_id = c.id
       WHERE c.status = ?
       GROUP BY c.id
       ORDER BY c.name`,
		)
		.bind(status)
		.all<CommunitySummary & { service_list: string | null }>();

	return (rows.results ?? []).map((row) => ({
		id: row.id,
		slug: row.slug,
		name: row.name,
		city: row.city,
		state: row.state,
		lat: row.lat,
		lng: row.lng,
		address_line: row.address_line,
		services: row.service_list ? row.service_list.split(",") : [],
	}));
}

export async function getCommunity(
	db: D1Database,
	slugOrId: string,
	includeHidden = false,
): Promise<Community | null> {
	const byId = /^\d+$/.test(slugOrId);
	const sql = includeHidden
		? `SELECT * FROM communities WHERE ${byId ? "id" : "slug"} = ?`
		: `SELECT * FROM communities WHERE ${byId ? "id" : "slug"} = ? AND status = 'approved'`;
	const row = await db
		.prepare(sql)
		.bind(byId ? Number(slugOrId) : slugOrId)
		.first<CommunityRow>();
	if (!row) return null;
	const [community] = await attachRelated(db, [row]);
	return community ?? null;
}

export async function listAdminCommunities(
	db: D1Database,
	status?: CommunityStatus,
): Promise<Community[]> {
	const query = status
		? db
				.prepare(
					"SELECT * FROM communities WHERE status = ? ORDER BY datetime(created_at) DESC",
				)
				.bind(status)
		: db.prepare(
				"SELECT * FROM communities ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, datetime(created_at) DESC",
			);
	const rows = await query.all<CommunityRow>();
	return attachRelated(db, rows.results ?? []);
}

async function replaceRelated(
	db: D1Database,
	communityId: number,
	input: CommunityInput,
): Promise<void> {
	const statements: D1PreparedStatement[] = [
		db
			.prepare("DELETE FROM mass_schedules WHERE community_id = ?")
			.bind(communityId),
		db
			.prepare("DELETE FROM community_services WHERE community_id = ?")
			.bind(communityId),
	];

	(input.mass_schedules ?? []).forEach((schedule, index) => {
		statements.push(
			db
				.prepare(
					`INSERT INTO mass_schedules (community_id, day_of_week, time, language, notes, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					communityId,
					schedule.day_of_week,
					schedule.time,
					schedule.language,
					emptyToNull(schedule.notes),
					index,
				),
		);
	});

	for (const service of input.services ?? []) {
		statements.push(
			db
				.prepare(
					`INSERT INTO community_services (community_id, service_type, notes)
           VALUES (?, ?, ?)`,
				)
				.bind(
					communityId,
					service.service_type,
					emptyToNull(service.notes),
				),
		);
	}

	await db.batch(statements);
}

export async function createCommunity(
	db: D1Database,
	input: CommunityInput,
	coords: { lat: number; lng: number },
	status: CommunityStatus,
): Promise<Community> {
	const slug = await uniqueSlug(
		db,
		slugify(`${input.name} ${input.city} ${input.state}`),
	);
	const approvedAt = status === "approved" ? new Date().toISOString() : null;

	const result = await db
		.prepare(
			`INSERT INTO communities (
        slug, name, description, address_line, city, state, zip, lat, lng,
        website_url, whatsapp, instagram, facebook, email, phone, status,
        submitted_by_name, submitted_by_email, admin_notes, approved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(
			slug,
			input.name.trim(),
			emptyToNull(input.description),
			input.address_line.trim(),
			input.city.trim(),
			input.state,
			emptyToNull(input.zip),
			coords.lat,
			coords.lng,
			emptyToNull(input.website_url),
			emptyToNull(input.whatsapp),
			emptyToNull(input.instagram),
			emptyToNull(input.facebook),
			emptyToNull(input.email),
			emptyToNull(input.phone),
			status,
			emptyToNull(input.submitted_by_name),
			emptyToNull(input.submitted_by_email),
			emptyToNull(input.admin_notes),
			approvedAt,
		)
		.run();

	const id = result.meta.last_row_id;
	await replaceRelated(db, id, input);
	const created = await getCommunity(db, String(id), true);
	if (!created) throw new Error("Falha ao criar comunidade.");
	return created;
}

export async function updateCommunity(
	db: D1Database,
	id: number,
	input: CommunityInput,
	coords: { lat: number; lng: number },
): Promise<Community | null> {
	const existing = await getCommunity(db, String(id), true);
	if (!existing) return null;

	const slug = await uniqueSlug(
		db,
		slugify(`${input.name} ${input.city} ${input.state}`),
		id,
	);
	const nextStatus = input.status ?? existing.status;
	const approvedAt =
		nextStatus === "approved"
			? (existing.approved_at ?? new Date().toISOString())
			: null;

	await db
		.prepare(
			`UPDATE communities SET
        slug = ?, name = ?, description = ?, address_line = ?, city = ?, state = ?, zip = ?,
        lat = ?, lng = ?, website_url = ?, whatsapp = ?, instagram = ?, facebook = ?,
        email = ?, phone = ?, status = ?, submitted_by_name = ?, submitted_by_email = ?,
        admin_notes = ?, approved_at = ?, updated_at = datetime('now')
       WHERE id = ?`,
		)
		.bind(
			slug,
			input.name.trim(),
			emptyToNull(input.description),
			input.address_line.trim(),
			input.city.trim(),
			input.state,
			emptyToNull(input.zip),
			coords.lat,
			coords.lng,
			emptyToNull(input.website_url),
			emptyToNull(input.whatsapp),
			emptyToNull(input.instagram),
			emptyToNull(input.facebook),
			emptyToNull(input.email),
			emptyToNull(input.phone),
			nextStatus,
			emptyToNull(input.submitted_by_name) ?? existing.submitted_by_name,
			emptyToNull(input.submitted_by_email) ?? existing.submitted_by_email,
			emptyToNull(input.admin_notes),
			approvedAt,
			id,
		)
		.run();

	await replaceRelated(db, id, input);
	return getCommunity(db, String(id), true);
}

export async function setStatus(
	db: D1Database,
	id: number,
	status: CommunityStatus,
): Promise<Community | null> {
	const approvedAt = status === "approved" ? new Date().toISOString() : null;
	const result = await db
		.prepare(
			`UPDATE communities SET status = ?, approved_at = ?, updated_at = datetime('now') WHERE id = ?`,
		)
		.bind(status, approvedAt, id)
		.run();
	if (!result.meta.changes) return null;
	return getCommunity(db, String(id), true);
}

export async function deleteCommunity(
	db: D1Database,
	id: number,
): Promise<boolean> {
	await db.batch([
		db.prepare("DELETE FROM mass_schedules WHERE community_id = ?").bind(id),
		db.prepare("DELETE FROM community_services WHERE community_id = ?").bind(id),
		db.prepare("DELETE FROM communities WHERE id = ?").bind(id),
	]);
	const leftover = await db
		.prepare("SELECT id FROM communities WHERE id = ?")
		.bind(id)
		.first();
	return leftover == null;
}

export async function resolveCoordinates(
	input: CommunityInput,
	geocode: (query: string) => Promise<{ lat: number; lng: number } | null>,
): Promise<{ lat: number; lng: number } | null> {
	if (
		typeof input.lat === "number" &&
		typeof input.lng === "number" &&
		Number.isFinite(input.lat) &&
		Number.isFinite(input.lng)
	) {
		return { lat: input.lat, lng: input.lng };
	}

	const found = await geocode(
		[input.address_line, input.city, input.state, input.zip, "USA"]
			.filter(Boolean)
			.join(", "),
	);
	return found;
}
