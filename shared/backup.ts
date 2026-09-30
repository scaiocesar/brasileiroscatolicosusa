import type {
	Community,
	CommunityInput,
	CommunityService,
	CommunityStatus,
	MassLanguage,
	MassSchedule,
} from "./types";

export const BACKUP_FORMAT = "brasileiroscatolicosusa-backup";
export const BACKUP_VERSION = 1;

export type BackupCommunity = {
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
	whatsapp_group_url: string | null;
	instagram: string | null;
	facebook: string | null;
	email: string | null;
	phone: string | null;
	status: CommunityStatus;
	submitted_by_name: string | null;
	submitted_by_email: string | null;
	admin_notes: string | null;
	coordinator_name: string | null;
	coordinator_phone: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	approved_at: string | null;
	mass_schedules: MassSchedule[];
	services: CommunityService[];
};

export type CommunitiesBackup = {
	format: typeof BACKUP_FORMAT;
	version: number;
	exported_at: string;
	communities: BackupCommunity[];
};

export type ParseBackupResult =
	| { ok: true; backup: CommunitiesBackup }
	| { ok: false; error: string };

const STATUSES = new Set<CommunityStatus>(["pending", "approved", "rejected"]);
const LANGUAGES = new Set<MassLanguage>(["pt", "en", "bilingual"]);

export function communityToBackupItem(community: Community): BackupCommunity {
	return {
		slug: community.slug,
		name: community.name,
		description: community.description,
		address_line: community.address_line,
		city: community.city,
		state: community.state,
		zip: community.zip,
		lat: community.lat,
		lng: community.lng,
		website_url: community.website_url,
		whatsapp: community.whatsapp,
		whatsapp_group_url: community.whatsapp_group_url,
		instagram: community.instagram,
		facebook: community.facebook,
		email: community.email,
		phone: community.phone,
		status: community.status,
		submitted_by_name: community.submitted_by_name,
		submitted_by_email: community.submitted_by_email,
		admin_notes: community.admin_notes,
		coordinator_name: community.coordinator_name,
		coordinator_phone: community.coordinator_phone,
		created_at: community.created_at,
		updated_at: community.updated_at,
		approved_at: community.approved_at,
		mass_schedules: community.mass_schedules.map((item) => ({
			day_of_week: item.day_of_week,
			time: item.time,
			language: item.language,
			notes: item.notes ?? null,
		})),
		services: community.services.map((item) => ({
			service_type: item.service_type,
			notes: item.notes ?? null,
		})),
	};
}

export function buildCommunitiesBackup(
	communities: Community[],
	exportedAt = new Date().toISOString(),
): CommunitiesBackup {
	return {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exported_at: exportedAt,
		communities: communities
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
			.map(communityToBackupItem),
	};
}

export function serializeCommunitiesBackup(backup: CommunitiesBackup): string {
	return `${JSON.stringify(backup, null, 2)}\n`;
}

export function defaultBackupFileName(date = new Date()): string {
	const stamp = date.toISOString().slice(0, 10);
	return `backup-comunidades-${stamp}.txt`;
}

function asString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed === "" ? null : trimmed;
}

function asRequiredString(value: unknown): string | null {
	return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const n = Number(value);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function parseSchedules(value: unknown): MassSchedule[] {
	if (!Array.isArray(value)) return [];
	const schedules: MassSchedule[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const day = asNumber(row.day_of_week);
		const time = asRequiredString(row.time);
		const language = asRequiredString(row.language) as MassLanguage | null;
		if (day == null || day < 0 || day > 6 || !time) continue;
		if (!language || !LANGUAGES.has(language)) continue;
		schedules.push({
			day_of_week: day,
			time,
			language,
			notes: asString(row.notes),
		});
	}
	return schedules;
}

function parseServices(value: unknown): CommunityService[] {
	if (!Array.isArray(value)) return [];
	const services: CommunityService[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") continue;
		const row = item as Record<string, unknown>;
		const serviceType = asRequiredString(row.service_type);
		if (!serviceType) continue;
		services.push({
			service_type: serviceType,
			notes: asString(row.notes),
		});
	}
	return services;
}

function parseBackupCommunity(value: unknown, index: number): BackupCommunity | string {
	if (!value || typeof value !== "object") {
		return `Comunidade #${index + 1}: formato inválido.`;
	}
	const row = value as Record<string, unknown>;
	const name = asRequiredString(row.name);
	const address = asRequiredString(row.address_line);
	const city = asRequiredString(row.city);
	const state = asRequiredString(row.state)?.toUpperCase() ?? null;
	const lat = asNumber(row.lat);
	const lng = asNumber(row.lng);
	const statusRaw = asRequiredString(row.status) as CommunityStatus | null;
	const status =
		statusRaw && STATUSES.has(statusRaw) ? statusRaw : ("pending" as const);

	if (!name) return `Comunidade #${index + 1}: informe o nome.`;
	if (!address) return `Comunidade #${index + 1} (${name}): informe o endereço.`;
	if (!city) return `Comunidade #${index + 1} (${name}): informe a cidade.`;
	if (!state) return `Comunidade #${index + 1} (${name}): informe o estado.`;
	if (lat == null || lng == null) {
		return `Comunidade #${index + 1} (${name}): informe lat/lng.`;
	}

	const slug =
		asRequiredString(row.slug) ??
		name
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80);

	return {
		slug,
		name,
		description: asString(row.description),
		address_line: address,
		city,
		state,
		zip: asString(row.zip),
		lat,
		lng,
		website_url: asString(row.website_url),
		whatsapp: asString(row.whatsapp),
		whatsapp_group_url: asString(row.whatsapp_group_url),
		instagram: asString(row.instagram),
		facebook: asString(row.facebook),
		email: asString(row.email),
		phone: asString(row.phone),
		status,
		submitted_by_name: asString(row.submitted_by_name),
		submitted_by_email: asString(row.submitted_by_email),
		admin_notes: asString(row.admin_notes),
		coordinator_name: asString(row.coordinator_name),
		coordinator_phone: asString(row.coordinator_phone),
		created_at: asString(row.created_at),
		updated_at: asString(row.updated_at),
		approved_at: asString(row.approved_at),
		mass_schedules: parseSchedules(row.mass_schedules),
		services: parseServices(row.services),
	};
}

export function parseCommunitiesBackup(text: string): ParseBackupResult {
	const trimmed = text.trim();
	if (!trimmed) {
		return { ok: false, error: "Arquivo de backup vazio." };
	}

	let raw: unknown;
	try {
		raw = JSON.parse(trimmed);
	} catch {
		return {
			ok: false,
			error: "Backup inválido: esperava um arquivo de texto JSON.",
		};
	}

	if (!raw || typeof raw !== "object") {
		return { ok: false, error: "Backup inválido." };
	}

	const root = raw as Record<string, unknown>;
	if (root.format !== BACKUP_FORMAT) {
		return {
			ok: false,
			error: `Formato não reconhecido. Use um backup gerado por este painel (${BACKUP_FORMAT}).`,
		};
	}

	const version = asNumber(root.version);
	if (version == null || version > BACKUP_VERSION) {
		return {
			ok: false,
			error: `Versão de backup não suportada (${String(root.version)}).`,
		};
	}

	if (!Array.isArray(root.communities)) {
		return { ok: false, error: "Backup sem lista de comunidades." };
	}

	const communities: BackupCommunity[] = [];
	for (let i = 0; i < root.communities.length; i += 1) {
		const parsed = parseBackupCommunity(root.communities[i], i);
		if (typeof parsed === "string") {
			return { ok: false, error: parsed };
		}
		communities.push(parsed);
	}

	return {
		ok: true,
		backup: {
			format: BACKUP_FORMAT,
			version: version || 1,
			exported_at:
				asString(root.exported_at) ?? new Date().toISOString(),
			communities,
		},
	};
}

export function backupCommunityToInput(
	community: BackupCommunity,
): CommunityInput {
	return {
		name: community.name,
		description: community.description,
		address_line: community.address_line,
		city: community.city,
		state: community.state,
		zip: community.zip,
		lat: community.lat,
		lng: community.lng,
		website_url: community.website_url,
		whatsapp: community.whatsapp,
		whatsapp_group_url: community.whatsapp_group_url,
		instagram: community.instagram,
		facebook: community.facebook,
		email: community.email,
		phone: community.phone,
		status: community.status,
		submitted_by_name: community.submitted_by_name,
		submitted_by_email: community.submitted_by_email,
		admin_notes: community.admin_notes,
		coordinator_name: community.coordinator_name,
		coordinator_phone: community.coordinator_phone,
		mass_schedules: community.mass_schedules,
		services: community.services,
	};
}
