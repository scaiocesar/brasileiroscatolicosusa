import type { Community } from "./types";

export const SITE_ORIGIN = "https://brasileiroscatolicosusa.org";
export const SITE_NAME = "Brasileiros Católicos nos EUA";
export const SITE_EMAIL = "contato@brasileiroscatolicosusa.org";
export const APOSTOLADO_NAME = "Apostolado Brasileiro";
export const APOSTOLADO_URL = "https://apostoladobrasileiro.com/";
export const GA_MEASUREMENT_ID = "G-FJ1GE5Q58M";
export const OG_IMAGE_PATH = "/og-image.png";
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export const DEFAULT_TITLE = "Brasileiros Católicos nos EUA | Missas em português";
export const DEFAULT_DESCRIPTION =
	"Encontre comunidades católicas brasileiras nos Estados Unidos. Mapa de missas em português, catequese, sacramentos e grupos de oração perto de você.";

export type SeoDocument = {
	title: string;
	description: string;
	canonical: string;
	robots: string;
	jsonLd: unknown;
	markdown?: string;
};

export function canonicalUrl(pathname: string): string {
	const path = pathname.replace(/\/+$/, "") || "/";
	return path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`;
}

export function markdownUrl(pathname: string): string {
	const path = pathname.replace(/\/+$/, "") || "/";
	if (path === "/") return canonicalUrl("/index.md");
	return canonicalUrl(`${path}.md`);
}

export function ogImageUrl(): string {
	return `${SITE_ORIGIN}${OG_IMAGE_PATH}`;
}

export function homeSeo(): SeoDocument {
	return {
		title: DEFAULT_TITLE,
		description: DEFAULT_DESCRIPTION,
		canonical: canonicalUrl("/"),
		robots: "index, follow",
		jsonLd: graph([websiteNode(), organizationNode()]),
		markdown: markdownUrl("/"),
	};
}

export function submitSeo(): SeoDocument {
	return {
		title: "Informe sua comunidade | Brasileiros Católicos nos EUA",
		description:
			"Cadastre sua comunidade católica brasileira nos Estados Unidos. Envie endereço, horários de missa em português e serviços para aparecer no mapa.",
		canonical: canonicalUrl("/informe"),
		robots: "index, follow",
		jsonLd: graph([websiteNode(), organizationNode()]),
		markdown: markdownUrl("/informe"),
	};
}

export function adminSeo(): SeoDocument {
	return {
		title: "Administração | Brasileiros Católicos nos EUA",
		description: DEFAULT_DESCRIPTION,
		canonical: canonicalUrl("/admin"),
		robots: "noindex, nofollow",
		jsonLd: graph([websiteNode(), organizationNode()]),
	};
}

export function adminUsersSeo(): SeoDocument {
	return {
		title: "Usuários admin | Brasileiros Católicos nos EUA",
		description: DEFAULT_DESCRIPTION,
		canonical: canonicalUrl("/admin/usuarios"),
		robots: "noindex, nofollow",
		jsonLd: graph([websiteNode(), organizationNode()]),
	};
}

export function adminBackupSeo(): SeoDocument {
	return {
		title: "Backup | Brasileiros Católicos nos EUA",
		description: DEFAULT_DESCRIPTION,
		canonical: canonicalUrl("/admin/backup"),
		robots: "noindex, nofollow",
		jsonLd: graph([websiteNode(), organizationNode()]),
	};
}

export function correctionSeo(community: Community): SeoDocument {
	const path = `/comunidade/${community.slug}/corrigir`;
	return {
		title: `Corrigir ${community.name} | Brasileiros Católicos nos EUA`,
		description: `Sugira uma correção nos dados de ${community.name} em ${community.city}, ${community.state}. A equipe revisa e, se aprovada, atualiza o mapa.`,
		canonical: canonicalUrl(path),
		robots: "noindex, follow",
		jsonLd: graph([websiteNode(), organizationNode()]),
	};
}

export function notFoundSeo(): SeoDocument {
	return {
		title: "Comunidade não encontrada | Brasileiros Católicos nos EUA",
		description: DEFAULT_DESCRIPTION,
		canonical: canonicalUrl("/"),
		robots: "noindex, follow",
		jsonLd: graph([websiteNode(), organizationNode()]),
	};
}

export function communitySeo(community: Community): SeoDocument {
	const path = `/comunidade/${community.slug}`;
	const canonical = canonicalUrl(path);
	const description = communityDescription(community);
	return {
		title: `${community.name} em ${community.city}, ${community.state} | Missa em português`,
		description,
		canonical,
		robots: "index, follow",
		jsonLd: graph([
			websiteNode(),
			organizationNode(),
			churchNode(community, canonical, description),
			breadcrumbNode(community, canonical),
		]),
		markdown: markdownUrl(path),
	};
}

export function seoForPath(
	pathname: string,
	community?: Community | null,
): SeoDocument {
	const path = pathname.replace(/\/+$/, "") || "/";
	if (path === "/informe") return submitSeo();
	if (path === "/admin/usuarios") return adminUsersSeo();
	if (path === "/admin/backup") return adminBackupSeo();
	if (path === "/admin" || path.startsWith("/admin/")) return adminSeo();
	const correctionPath = path.match(/^\/comunidade\/([^/]+)\/corrigir$/);
	if (correctionPath) {
		return community ? correctionSeo(community) : notFoundSeo();
	}
	if (path.startsWith("/comunidade/")) {
		return community ? communitySeo(community) : notFoundSeo();
	}
	return homeSeo();
}

export function buildSitemapXml(
	communities: Array<{ slug: string; updated_at: string }>,
): string {
	const staticPages = [
		{ loc: canonicalUrl("/"), changefreq: "daily", priority: "1.0" },
		{ loc: canonicalUrl("/informe"), changefreq: "monthly", priority: "0.6" },
	];
	const communityPages = communities.map((community) => ({
		loc: canonicalUrl(`/comunidade/${community.slug}`),
		lastmod: community.updated_at.slice(0, 10),
		changefreq: "weekly",
		priority: "0.8",
	}));

	const urls = [...staticPages, ...communityPages]
		.map((entry) => {
			const lastmod =
				"lastmod" in entry && entry.lastmod
					? `<lastmod>${entry.lastmod}</lastmod>`
					: "";
			return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}<changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`;
		})
		.join("");

	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

export function safeJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(/</g, "\\u003c");
}

function communityDescription(community: Community): string {
	if (community.description?.trim()) {
		return trimMeta(community.description, 160);
	}
	const services = community.services
		.map((item) => serviceLabel(item.service_type))
		.filter((label) => label !== "Outros")
		.slice(0, 4);
	const serviceText =
		services.length > 0 ? ` Serviços: ${services.join(", ")}.` : "";
	return trimMeta(
		`Missa em português na ${community.name}, em ${community.city}, ${community.state}. Endereço, horários e contato da comunidade católica brasileira.${serviceText}`,
		160,
	);
}

function serviceLabel(id: string): string {
	const labels: Record<string, string> = {
		missa: "Missa",
		catequese: "Catequese",
		batismo: "Batismo",
		crisma: "Crisma",
		primeira_eucaristia: "Primeira Eucaristia",
		casamento: "Casamento",
		confissao: "Confissão",
		adoracao: "Adoração",
		grupo_oracao: "Grupo de oração",
		jovens: "Pastoral de jovens",
	};
	return labels[id] ?? "Outros";
}

function trimMeta(value: string, max: number): string {
	const text = value.replace(/\s+/g, " ").trim();
	if (text.length <= max) return text;
	return `${text.slice(0, max - 1).trimEnd()}…`;
}

function graph(nodes: Record<string, unknown>[]) {
	return {
		"@context": "https://schema.org",
		"@graph": nodes,
	};
}

function websiteNode(): Record<string, unknown> {
	return {
		"@type": "WebSite",
		"@id": `${SITE_ORIGIN}/#website`,
		name: SITE_NAME,
		url: SITE_ORIGIN,
		inLanguage: "pt-BR",
		description: DEFAULT_DESCRIPTION,
		publisher: { "@id": `${SITE_ORIGIN}/#organization` },
	};
}

function organizationNode(): Record<string, unknown> {
	return {
		"@type": "Organization",
		"@id": `${SITE_ORIGIN}/#organization`,
		name: SITE_NAME,
		url: SITE_ORIGIN,
		logo: ogImageUrl(),
		email: SITE_EMAIL,
		description: DEFAULT_DESCRIPTION,
		contactPoint: {
			"@type": "ContactPoint",
			email: SITE_EMAIL,
			contactType: "customer support",
			availableLanguage: ["Portuguese", "English"],
		},
		sponsor: {
			"@type": "Organization",
			name: APOSTOLADO_NAME,
			url: APOSTOLADO_URL,
		},
	};
}

function churchNode(
	community: Community,
	canonical: string,
	description: string,
): Record<string, unknown> {
	const sameAs = [
		httpUrl(community.website_url),
		socialUrl(community.instagram, "https://instagram.com/"),
		socialUrl(community.facebook, "https://facebook.com/"),
	].filter((value): value is string => Boolean(value));

	return {
		"@type": "CatholicChurch",
		"@id": `${canonical}#place`,
		name: community.name,
		description,
		url: canonical,
		image: ogImageUrl(),
		isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
		address: {
			"@type": "PostalAddress",
			streetAddress: community.address_line,
			addressLocality: community.city,
			addressRegion: community.state,
			...(community.zip ? { postalCode: community.zip } : {}),
			addressCountry: "US",
		},
		geo: {
			"@type": "GeoCoordinates",
			latitude: community.lat,
			longitude: community.lng,
		},
		hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
			`${community.address_line}, ${community.city}, ${community.state}`,
		)}`,
		...(community.phone ? { telephone: community.phone } : {}),
		...(community.email ? { email: community.email } : {}),
		...(sameAs.length > 0 ? { sameAs } : {}),
		areaServed: {
			"@type": "City",
			name: `${community.city}, ${community.state}`,
		},
	};
}

function breadcrumbNode(
	community: Community,
	canonical: string,
): Record<string, unknown> {
	return {
		"@type": "BreadcrumbList",
		itemListElement: [
			{
				"@type": "ListItem",
				position: 1,
				name: SITE_NAME,
				item: canonicalUrl("/"),
			},
			{
				"@type": "ListItem",
				position: 2,
				name: community.name,
				item: canonical,
			},
		],
	};
}

function httpUrl(value: string | null | undefined): string | null {
	if (!value?.trim()) return null;
	const trimmed = value.trim();
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function socialUrl(
	value: string | null | undefined,
	prefix: string,
): string | null {
	if (!value?.trim()) return null;
	const trimmed = value.trim();
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `${prefix}${trimmed.replace(/^@/, "")}`;
}

function escapeXml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
