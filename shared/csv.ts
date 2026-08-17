import type { CommunityInput, MassLanguage, MassSchedule } from "./types";
import { SERVICE_TYPE_IDS, US_STATES } from "./constants";

export const COMMUNITY_CSV_COLUMNS = [
	"name",
	"description",
	"address_line",
	"city",
	"state",
	"zip",
	"lat",
	"lng",
	"website_url",
	"phone",
	"email",
	"instagram",
	"facebook",
	"whatsapp",
	"mass_schedules",
	"services",
	"source_url",
	"admin_notes",
] as const;

const STATE_CODES = new Set(US_STATES.map((state) => state.code));
const SERVICE_IDS = new Set<string>(SERVICE_TYPE_IDS);

export type CommunityCsvRow = {
	name: string;
	description: string;
	address_line: string;
	city: string;
	state: string;
	zip: string;
	lat: string;
	lng: string;
	website_url: string;
	phone: string;
	email: string;
	instagram: string;
	facebook: string;
	whatsapp: string;
	mass_schedules: string;
	services: string;
	source_url: string;
	admin_notes: string;
};

function escapeCsv(value: string): string {
	if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
	return value;
}

export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let cell = "";
	let quoted = false;

	for (let i = 0; i < text.length; i += 1) {
		const char = text[i];
		const next = text[i + 1];
		if (quoted) {
			if (char === '"' && next === '"') {
				cell += '"';
				i += 1;
			} else if (char === '"') {
				quoted = false;
			} else {
				cell += char;
			}
			continue;
		}
		if (char === '"') {
			quoted = true;
		} else if (char === ",") {
			row.push(cell);
			cell = "";
		} else if (char === "\n") {
			row.push(cell);
			if (row.some((value) => value.trim())) rows.push(row);
			row = [];
			cell = "";
		} else if (char !== "\r") {
			cell += char;
		}
	}
	row.push(cell);
	if (row.some((value) => value.trim())) rows.push(row);
	return rows;
}

export function serializeCommunityCsv(rows: CommunityCsvRow[]): string {
	const header = COMMUNITY_CSV_COLUMNS.join(",");
	const lines = rows.map((row) =>
		COMMUNITY_CSV_COLUMNS.map((column) => escapeCsv(row[column] ?? "")).join(
			",",
		),
	);
	return `${[header, ...lines].join("\n")}\n`;
}

function splitHeader(header: string[]): Map<string, number> {
	return new Map(
		header.map((name, index) => [name.trim().toLowerCase(), index]),
	);
}

function cell(row: string[], index: Map<string, number>, key: string): string {
	const position = index.get(key);
	if (position == null) return "";
	return (row[position] ?? "").trim();
}

function parseJsonSchedules(raw: string): MassSchedule[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.flatMap((item) => {
			if (!item || typeof item !== "object") return [];
			const schedule = item as Partial<MassSchedule>;
			const day = Number(schedule.day_of_week);
			const time = String(schedule.time ?? "");
			const language = (schedule.language ?? "pt") as MassLanguage;
			if (!Number.isInteger(day) || day < 0 || day > 6) return [];
			if (!/^\d{2}:\d{2}$/.test(time)) return [];
			if (!["pt", "en", "bilingual"].includes(language)) return [];
			return [
				{
					day_of_week: day,
					time,
					language,
					notes: schedule.notes ? String(schedule.notes) : null,
				},
			];
		});
	} catch {
		return [];
	}
}

function parseServices(raw: string): CommunityInput["services"] {
	const ids = raw
		.split(/[;|,]/)
		.map((value) => value.trim())
		.filter((value) => SERVICE_IDS.has(value));
	const unique = [...new Set(ids.length ? ids : ["missa"])];
	return unique.map((service_type) => ({ service_type }));
}

function optionalUrl(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
	return trimmed;
}

function optionalEmail(value: string): string | null {
	const trimmed = value.trim();
	if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
	return trimmed;
}

export function csvRowsToInputs(text: string): {
	inputs: CommunityInput[];
	errors: string[];
} {
	const table = parseCsv(text.replace(/^\uFEFF/, ""));
	const errors: string[] = [];
	if (table.length < 2) {
		return { inputs: [], errors: ["O CSV está vazio."] };
	}

	const index = splitHeader(table[0] ?? []);
	if (!index.has("name") || !index.has("city") || !index.has("state")) {
		return {
			inputs: [],
			errors: ["O CSV precisa das colunas name, city e state."],
		};
	}

	const inputs: CommunityInput[] = [];
	table.slice(1).forEach((row, offset) => {
		const line = offset + 2;
		const name = cell(row, index, "name");
		const address_line = cell(row, index, "address_line");
		const city = cell(row, index, "city");
		const state = cell(row, index, "state").toUpperCase();
		if (!name || name.length < 3) {
			errors.push(`Linha ${line}: informe o nome da comunidade.`);
			return;
		}
		if (!address_line) {
			errors.push(`Linha ${line} (${name}): informe o endereço.`);
			return;
		}
		if (!city) {
			errors.push(`Linha ${line} (${name}): informe a cidade.`);
			return;
		}
		if (!STATE_CODES.has(state as (typeof US_STATES)[number]["code"])) {
			errors.push(`Linha ${line} (${name}): estado inválido.`);
			return;
		}

		const latRaw = cell(row, index, "lat");
		const lngRaw = cell(row, index, "lng");
		const lat = latRaw ? Number(latRaw) : null;
		const lng = lngRaw ? Number(lngRaw) : null;
		const source = cell(row, index, "source_url");
		const notes = [
			cell(row, index, "admin_notes"),
			source ? `Fonte: ${source}` : "",
		]
			.filter(Boolean)
			.join("\n");

		inputs.push({
			name,
			description: cell(row, index, "description") || null,
			address_line,
			city,
			state,
			zip: cell(row, index, "zip") || null,
			lat: Number.isFinite(lat) ? lat : null,
			lng: Number.isFinite(lng) ? lng : null,
			website_url: optionalUrl(cell(row, index, "website_url")),
			phone: cell(row, index, "phone") || null,
			email: optionalEmail(cell(row, index, "email")),
			instagram: cell(row, index, "instagram") || null,
			facebook: cell(row, index, "facebook") || null,
			whatsapp: cell(row, index, "whatsapp") || null,
			admin_notes: notes || null,
			mass_schedules: parseJsonSchedules(cell(row, index, "mass_schedules")),
			services: parseServices(cell(row, index, "services")),
		});
	});

	return { inputs, errors };
}
