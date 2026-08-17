import {
	MASS_LANGUAGES,
	SERVICE_TYPES,
	US_STATES,
	WEEKDAYS,
} from "./constants";
import {
	canonicalUrl,
	DEFAULT_DESCRIPTION,
	SITE_NAME,
	SITE_ORIGIN,
} from "./seo";
import type { Community, CommunitySummary } from "./types";

export type PublicCommunity = Omit<
	Community,
	"submitted_by_name" | "submitted_by_email" | "admin_notes"
>;

export function toPublicCommunity(community: Community): PublicCommunity {
	return {
		id: community.id,
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
		instagram: community.instagram,
		facebook: community.facebook,
		email: community.email,
		phone: community.phone,
		status: community.status,
		created_at: community.created_at,
		updated_at: community.updated_at,
		approved_at: community.approved_at,
		mass_schedules: community.mass_schedules,
		services: community.services,
	};
}

export function filterSummaries(
	communities: CommunitySummary[],
	query: { state?: string; city?: string; q?: string; service?: string },
): CommunitySummary[] {
	const state = query.state?.trim().toUpperCase();
	const city = query.city?.trim().toLowerCase();
	const needle = query.q?.trim().toLowerCase();
	const service = query.service?.trim();
	return communities.filter((community) => {
		if (state && community.state !== state) return false;
		if (city && community.city.toLowerCase() !== city) return false;
		if (service && !community.services.includes(service)) return false;
		if (
			needle &&
			!`${community.name} ${community.city} ${community.state}`
				.toLowerCase()
				.includes(needle)
		) {
			return false;
		}
		return true;
	});
}

export function buildLlmsTxt(communities: CommunitySummary[]): string {
	const byState = groupByState(communities);
	const stateLinks = byState
		.map(
			([state, items]) =>
				`- [${stateName(state)} (${items.length})](${canonicalUrl("/index.md")}): Comunidades em ${stateName(state)}, sigla \`${state}\``,
		)
		.join("\n");

	return `# ${SITE_NAME}

> ${DEFAULT_DESCRIPTION}

Este diretório lista comunidades católicas brasileiras nos Estados Unidos (paróquias, missas em português, catequese e sacramentos). O conteúdo público está em português do Brasil. Páginas HTML têm versão Markdown no mesmo caminho com \`.md\`. Dados pessoais de quem cadastrou a comunidade não são publicados.

Como usar:

- Para uma resposta curta, leia este arquivo e \`/index.md\`.
- Para o catálogo completo, leia \`/llms-full.txt\`.
- Para uma comunidade específica, abra \`/comunidade/{slug}.md\` ou \`GET /api/communities/{slug}\`.
- Para filtrar, use \`GET /api/communities?state=FL&city=Miami&q=nome&service=missa\`.
- Serviços válidos: ${SERVICE_TYPES.map((item) => `\`${item.id}\``).join(", ")}.
- Estados usam sigla dos EUA (ex.: \`FL\`, \`MA\`, \`TX\`).

## Páginas

- [Mapa e índice](${canonicalUrl("/index.md")}): Lista de todas as comunidades aprovadas, agrupadas por estado
- [Catálogo completo](${canonicalUrl("/llms-full.txt")}): Todas as comunidades com endereço, horários de missa e contato, em um único arquivo
- [API OpenAPI](${canonicalUrl("/openapi.json")}): Especificação JSON da API pública
- [Informe sua comunidade](${canonicalUrl("/informe.md")}): Como cadastrar uma comunidade no mapa

## API

- [Listar comunidades](${SITE_ORIGIN}/api/communities): JSON com nome, cidade, estado, coordenadas e serviços. Query: \`state\`, \`city\`, \`q\`, \`service\`
- [Detalhe da comunidade](${SITE_ORIGIN}/api/communities/{slug}): JSON com endereço, horários de missa, serviços e contato público

## Estados

${stateLinks || "- Nenhuma comunidade aprovada no momento."}

## Optional

- [Mapa interativo](${SITE_ORIGIN}/): Interface humana (React). Prefira as versões Markdown ou a API
- [Sitemap](${canonicalUrl("/sitemap.xml")}): URLs HTML para indexação
`;
}

export function buildIndexMarkdown(communities: CommunitySummary[]): string {
	const byState = groupByState(communities);
	const sections = byState
		.map(([state, items]) => {
			const links = items
				.map(
					(community) =>
						`- [${community.name}](${canonicalUrl(`/comunidade/${community.slug}.md`)}): ${community.city}, ${community.state}`,
				)
				.join("\n");
			return `## ${stateName(state)} (${state})\n\n${links}`;
		})
		.join("\n\n");

	return `# ${SITE_NAME}

> ${DEFAULT_DESCRIPTION}

${communities.length} comunidade${communities.length === 1 ? "" : "s"} católica${communities.length === 1 ? "" : "s"} brasileira${communities.length === 1 ? "" : "s"} aprovada${communities.length === 1 ? "" : "s"} nos Estados Unidos.

Versão humana: ${SITE_ORIGIN}/
Catálogo completo: ${canonicalUrl("/llms-full.txt")}
API: ${SITE_ORIGIN}/api/communities

${sections || "Nenhuma comunidade aprovada no momento."}
`;
}

export function buildLlmsFull(communities: PublicCommunity[]): string {
	if (communities.length === 0) {
		return `# ${SITE_NAME}\n\n> ${DEFAULT_DESCRIPTION}\n\nNenhuma comunidade aprovada no momento.\n`;
	}
	const pages = communities.map((community) => communityMarkdown(community));
	return `# ${SITE_NAME} — catálogo completo

> ${DEFAULT_DESCRIPTION}

${communities.length} comunidades. Cada bloco abaixo é uma comunidade.

${pages.join("\n\n---\n\n")}
`;
}

export function buildInformeMarkdown(): string {
	return `# Informe sua comunidade

> Cadastre uma comunidade católica brasileira nos Estados Unidos para aparecer no mapa.

Use o formulário humano em ${canonicalUrl("/informe")}. O pré-cadastro é revisado pela equipe antes de ficar público.

Informe nome da comunidade, endereço, cidade, estado, horários de missa e serviços (missa, catequese, sacramentos, grupos). Depois da aprovação, a comunidade passa a aparecer no mapa, em \`/comunidade/{slug}.md\` e na API.
`;
}

export function communityMarkdown(community: PublicCommunity): string {
	const page = canonicalUrl(`/comunidade/${community.slug}`);
	const lines = [
		`# ${community.name}`,
		"",
		`> Comunidade católica brasileira em ${community.city}, ${community.state}`,
		"",
		`- Página: ${page}`,
		`- Markdown: ${page}.md`,
		`- JSON: ${SITE_ORIGIN}/api/communities/${community.slug}`,
		`- Endereço: ${community.address_line}, ${community.city}, ${community.state}${community.zip ? ` ${community.zip}` : ""}`,
		`- Coordenadas: ${community.lat}, ${community.lng}`,
	];

	if (community.description?.trim()) {
		lines.push("", community.description.trim());
	}

	if (community.mass_schedules.length > 0) {
		lines.push("", "## Horários de missa");
		for (const item of community.mass_schedules) {
			const day = weekdayLabel(item.day_of_week);
			const language = languageLabel(item.language);
			const notes = item.notes?.trim() ? ` — ${item.notes.trim()}` : "";
			lines.push(`- ${day} ${item.time} (${language})${notes}`);
		}
	}

	if (community.services.length > 0) {
		lines.push("", "## Serviços");
		for (const item of community.services) {
			const notes = item.notes?.trim() ? ` — ${item.notes.trim()}` : "";
			lines.push(`- ${serviceLabel(item.service_type)}${notes}`);
		}
	}

	const contacts = [
		community.phone ? `- Telefone: ${community.phone}` : null,
		community.email ? `- E-mail: ${community.email}` : null,
		community.website_url ? `- Site: ${community.website_url}` : null,
		community.whatsapp ? `- WhatsApp: ${community.whatsapp}` : null,
		community.instagram ? `- Instagram: ${community.instagram}` : null,
		community.facebook ? `- Facebook: ${community.facebook}` : null,
	].filter((item): item is string => Boolean(item));

	if (contacts.length > 0) {
		lines.push("", "## Contato", ...contacts);
	}

	return `${lines.join("\n")}\n`;
}

export function openApiSpec() {
	return {
		openapi: "3.1.0",
		info: {
			title: SITE_NAME,
			description: DEFAULT_DESCRIPTION,
			version: "1.0.0",
		},
		servers: [{ url: SITE_ORIGIN }],
		paths: {
			"/api/communities": {
				get: {
					summary: "Listar comunidades aprovadas",
					parameters: [
						{
							name: "state",
							in: "query",
							schema: { type: "string", example: "FL" },
							description: "Sigla do estado dos EUA",
						},
						{
							name: "city",
							in: "query",
							schema: { type: "string", example: "Miami" },
						},
						{
							name: "q",
							in: "query",
							schema: { type: "string" },
							description: "Busca por nome, cidade ou estado",
						},
						{
							name: "service",
							in: "query",
							schema: {
								type: "string",
								enum: SERVICE_TYPES.map((item) => item.id),
							},
						},
					],
					responses: {
						"200": { description: "Lista de comunidades" },
					},
				},
			},
			"/api/communities/{slug}": {
				get: {
					summary: "Detalhe de uma comunidade aprovada",
					parameters: [
						{
							name: "slug",
							in: "path",
							required: true,
							schema: { type: "string" },
						},
					],
					responses: {
						"200": { description: "Comunidade" },
						"404": { description: "Não encontrada" },
					},
				},
			},
			"/llms.txt": {
				get: { summary: "Índice para agentes de IA" },
			},
			"/llms-full.txt": {
				get: { summary: "Catálogo completo em Markdown" },
			},
			"/index.md": {
				get: { summary: "Índice Markdown das comunidades" },
			},
		},
	};
}

function groupByState(
	communities: CommunitySummary[],
): Array<[string, CommunitySummary[]]> {
	const grouped = new Map<string, CommunitySummary[]>();
	for (const community of communities) {
		const list = grouped.get(community.state) ?? [];
		list.push(community);
		grouped.set(community.state, list);
	}
	return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function stateName(code: string): string {
	return US_STATES.find((state) => state.code === code)?.name ?? code;
}

function weekdayLabel(id: number): string {
	return WEEKDAYS.find((item) => item.id === id)?.label ?? String(id);
}

function languageLabel(id: string): string {
	return MASS_LANGUAGES.find((item) => item.id === id)?.label ?? id;
}

function serviceLabel(id: string): string {
	return SERVICE_TYPES.find((item) => item.id === id)?.label ?? id;
}
