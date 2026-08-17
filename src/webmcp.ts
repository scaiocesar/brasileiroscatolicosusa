import { SERVICE_TYPE_IDS, US_STATES } from "../shared/constants";
import type { Community, CommunitySummary } from "../shared/types";

export const US_STATE_CODES = US_STATES.map((state) => state.code);

export function asTrimmedString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed ? trimmed : "";
}

export function filterMapCommunities(
	communities: CommunitySummary[],
	query: { q?: string; state?: string; service?: string },
): CommunitySummary[] {
	const needle = query.q?.trim().toLowerCase() ?? "";
	const state = query.state?.trim().toUpperCase() ?? "";
	const service = query.service?.trim() ?? "";
	return communities.filter((community) => {
		if (state && community.state !== state) return false;
		if (service && !community.services.includes(service)) return false;
		if (!needle) return true;
		return `${community.name} ${community.city} ${community.state}`
			.toLowerCase()
			.includes(needle);
	});
}

export function communityCard(community: {
	slug: string;
	name: string;
	city: string;
	state: string;
	address_line: string;
	services: Array<string | { service_type: string }>;
}) {
	return {
		slug: community.slug,
		name: community.name,
		city: community.city,
		state: community.state,
		address: community.address_line,
		services: community.services.map((item) =>
			typeof item === "string" ? item : item.service_type,
		),
		path: `/comunidade/${community.slug}`,
	};
}

export function communityDetails(community: Community) {
	const summary: CommunitySummary = {
		id: community.id,
		slug: community.slug,
		name: community.name,
		city: community.city,
		state: community.state,
		lat: community.lat,
		lng: community.lng,
		address_line: community.address_line,
		services: community.services.map((item) => item.service_type),
	};
	return {
		...communityCard(summary),
		description: community.description,
		zip: community.zip,
		lat: community.lat,
		lng: community.lng,
		website_url: community.website_url,
		whatsapp: community.whatsapp,
		instagram: community.instagram,
		facebook: community.facebook,
		email: community.email,
		phone: community.phone,
		mass_schedules: community.mass_schedules,
		services: community.services,
	};
}

export function parseStateCode(value: unknown): string | undefined {
	const state = asTrimmedString(value);
	if (state === undefined) return undefined;
	if (state === "") return "";
	const code = state.toUpperCase();
	if (!US_STATE_CODES.includes(code as (typeof US_STATE_CODES)[number])) {
		throw new Error(
			`Estado inválido: "${state}". Use a sigla dos EUA, por exemplo FL, MA ou TX.`,
		);
	}
	return code;
}

export function parseServiceId(value: unknown): string | undefined {
	const service = asTrimmedString(value);
	if (service === undefined) return undefined;
	if (service === "") return "";
	if (!SERVICE_TYPE_IDS.includes(service as (typeof SERVICE_TYPE_IDS)[number])) {
		throw new Error(
			`Serviço inválido: "${service}". Valores: ${SERVICE_TYPE_IDS.join(", ")}.`,
		);
	}
	return service;
}

export function findCommunity(
	communities: CommunitySummary[],
	query: { slug?: string; name?: string },
): CommunitySummary | null {
	const slug = query.slug?.trim().toLowerCase();
	if (slug) {
		return communities.find((item) => item.slug === slug) ?? null;
	}
	const name = query.name?.trim().toLowerCase();
	if (!name) return null;
	const exact = communities.filter((item) => item.name.toLowerCase() === name);
	if (exact.length === 1) return exact[0];
	if (exact.length > 1) return null;
	const partial = communities.filter((item) =>
		item.name.toLowerCase().includes(name),
	);
	return partial.length === 1 ? partial[0] : null;
}

export function ambiguousMatches(
	communities: CommunitySummary[],
	name: string,
): CommunitySummary[] {
	const needle = name.trim().toLowerCase();
	return communities.filter(
		(item) =>
			item.name.toLowerCase() === needle ||
			item.name.toLowerCase().includes(needle),
	);
}
