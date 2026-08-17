import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LISTING =
	"https://apostoladobrasileiro.com/paroquias-com-missas-em-portugues-nos-estados-unidos/";
const WHERE = "https://apostoladobrasileiro.com/onde-estamos/";
const UA =
	"BrasileirosCatolicosUSA/1.0 (https://brasileiroscatolicosusa.org; directory import)";

const SKIP_TITLES = /^(arch)?diocese of /i;

const STATE_NAME_TO_CODE = {
	alabama: "AL",
	alaska: "AK",
	arizona: "AZ",
	arkansas: "AR",
	california: "CA",
	colorado: "CO",
	connecticut: "CT",
	delaware: "DE",
	"district of columbia": "DC",
	florida: "FL",
	georgia: "GA",
	hawaii: "HI",
	idaho: "ID",
	illinois: "IL",
	indiana: "IN",
	iowa: "IA",
	kansas: "KS",
	kentucky: "KY",
	louisiana: "LA",
	maine: "ME",
	maryland: "MD",
	massachusetts: "MA",
	michigan: "MI",
	minnesota: "MN",
	mississippi: "MS",
	missouri: "MO",
	montana: "MT",
	nebraska: "NE",
	nevada: "NV",
	"new hampshire": "NH",
	"new jersey": "NJ",
	"new mexico": "NM",
	"new york": "NY",
	"north carolina": "NC",
	"north dakota": "ND",
	ohio: "OH",
	oklahoma: "OK",
	oregon: "OR",
	pennsylvania: "PA",
	"rhode island": "RI",
	"south carolina": "SC",
	"south dakota": "SD",
	tennessee: "TN",
	texas: "TX",
	utah: "UT",
	vermont: "VT",
	virginia: "VA",
	washington: "WA",
	"west virginia": "WV",
	wisconsin: "WI",
	wyoming: "WY",
};

const DAYS = {
	domingo: 0,
	sunday: 0,
	segunda: 1,
	"segunda-feira": 1,
	monday: 1,
	terca: 2,
	terça: 2,
	tuesday: 2,
	quarta: 3,
	"quarta-feira": 3,
	wednesday: 3,
	quinta: 4,
	"quinta-feira": 4,
	thursday: 4,
	sexta: 5,
	"sexta-feira": 5,
	friday: 5,
	sabado: 6,
	sábado: 6,
	saturday: 6,
};

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchText(url) {
	const response = await fetch(url, { headers: { "User-Agent": UA } });
	if (!response.ok) {
		throw new Error(`${response.status} ${url}`);
	}
	return response.text();
}

function decodeHtml(value) {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, code) =>
			String.fromCharCode(Number.parseInt(code, 16)),
		);
}

function stripTags(html) {
	return decodeHtml(
		html
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
			.replace(/<[^>]+>/g, " "),
	)
		.replace(/\u00a0/g, " ")
		.replace(/[ \t]+/g, " ")
		.replace(/\n+/g, "\n")
		.trim();
}

function normalizeName(value) {
	return value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function csvEscape(value) {
	const text = value ?? "";
	if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
	return text;
}

function parseMakers(html) {
	const marker = "var AR_OPTIONS_JS = ";
	const start = html.indexOf(marker);
	if (start < 0) {
		throw new Error("Não achei AR_OPTIONS_JS no mapa do Apostolado.");
	}
	const brace = html.indexOf("{", start);
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = brace; i < html.length; i += 1) {
		const char = html[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') inString = true;
		else if (char === "{") depth += 1;
		else if (char === "}") {
			depth -= 1;
			if (depth === 0) {
				const data = JSON.parse(html.slice(brace, i + 1));
				return Object.values(data.makers ?? {});
			}
		}
	}
	throw new Error("JSON do mapa do Apostolado está incompleto.");
}

function parseLabeled(html, label) {
	const regex = new RegExp(
		`<span>\\s*${label}:\\s*</span>\\s*([^<]+)`,
		"i",
	);
	const match = html.match(regex);
	return match ? decodeHtml(match[1]).trim() : "";
}

function parseDay(label) {
	const key = normalizeName(label).replace(/feira/g, "").trim();
	return DAYS[key] ?? DAYS[label.trim().toLowerCase()];
}

function parseTime(raw) {
	const value = raw.trim();
	const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
	if (!match) return null;
	let hour = Number(match[1]);
	const minute = match[2] ? Number(match[2]) : 0;
	const suffix = (match[3] || "").toLowerCase();
	if (suffix === "pm" && hour < 12) hour += 12;
	if (suffix === "am" && hour === 12) hour = 0;
	if (hour > 23 || minute > 59) return null;
	return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseSchedules(html) {
	const items = [
		...html.matchAll(
			/<li>\s*<strong>([^<:]+):?<\/strong>\s*<span>([^<]*)<\/span>/gi,
		),
	];
	return items.flatMap((item) => {
		const day = parseDay(item[1]);
		const time = parseTime(item[2]);
		if (day == null || !time) return [];
		return [{ day_of_week: day, time, language: "pt", notes: null }];
	});
}

function parseUsAddress(raw) {
	const cleaned = raw
		.replace(/,?\s*United States\.?$/i, "")
		.replace(/\s+/g, " ")
		.trim();
	const withZip = cleaned.match(
		/^(.+),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/,
	);
	if (withZip) {
		return {
			address_line: withZip[1].trim(),
			city: withZip[2].trim(),
			state: withZip[3].toUpperCase(),
			zip: withZip[4],
		};
	}
	const noZip = cleaned.match(/^(.+),\s*([^,]+),\s*([A-Za-z]{2})$/);
	if (noZip) {
		return {
			address_line: noZip[1].trim(),
			city: noZip[2].trim(),
			state: noZip[3].toUpperCase(),
			zip: "",
		};
	}
	const dashed = cleaned.match(
		/^(.+?)[-–,]\s*([^-,]+?)[-–,]\s*([A-Za-z]{2})[-–,]\s*(\d{5}(?:-\d{4})?)$/,
	);
	if (dashed) {
		return {
			address_line: dashed[1].trim(),
			city: dashed[2].trim(),
			state: dashed[3].toUpperCase(),
			zip: dashed[4],
		};
	}
	return null;
}

function contactFromValue(value) {
	const trimmed = value.trim();
	if (!trimmed || trimmed === "null") return { phone: "", email: "", website: "" };
	if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
		return {
			phone: "",
			email: "",
			website: trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
		};
	}
	if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
		return { phone: "", email: trimmed, website: "" };
	}
	return { phone: trimmed, email: "", website: "" };
}

async function reverseGeocode(lat, lng) {
	const url = new URL("https://nominatim.openstreetmap.org/reverse");
	url.searchParams.set("lat", String(lat));
	url.searchParams.set("lon", String(lng));
	url.searchParams.set("format", "jsonv2");
	url.searchParams.set("addressdetails", "1");
	url.searchParams.set("zoom", "18");
	const response = await fetch(url, {
		headers: { Accept: "application/json", "User-Agent": UA },
	});
	if (!response.ok) return null;
	const data = await response.json();
	const address = data.address ?? {};
	const state =
		STATE_NAME_TO_CODE[String(address.state ?? "").toLowerCase()] ||
		(address["ISO3166-2-lvl4"] || "").split("-")[1] ||
		"";
	const city =
		address.city ||
		address.town ||
		address.village ||
		address.hamlet ||
		address.suburb ||
		address.municipality ||
		(address.county || "").replace(/\s+County$/i, "");
	const street = [address.house_number, address.road].filter(Boolean).join(" ");
	return {
		address_line: street || data.name || city,
		city,
		state,
		zip: (address.postcode || "").split(";")[0],
	};
}

function extractCommunityLinks(html) {
	return [...new Set([...html.matchAll(/href="(https:\/\/apostoladobrasileiro\.com\/comunidade[^"]+)"/g)].map((m) => m[1]))];
}

function parseMaCommunity(html, url) {
	const title =
		html.match(/<h2[^>]*>\s*([^<]+)\s*<\/h2>/)?.[1]?.trim() ||
		html.match(/<title>([^<]+)/)?.[1]?.split("–")[0].trim() ||
		"";
	const text = stripTags(
		html.match(/<article[\s\S]*?<\/article>/)?.[0] ||
			html.match(/entry-content[\s\S]*?<\/div>/)?.[0] ||
			html,
	);
	const addressMatch =
		text.match(
			/(\d{1,5}\s+[^\n,]+),\s*([A-Za-z .']+),\s*([A-Za-z]{2})\s+(\d{5})/,
		) ||
		text.match(
			/(\d{1,5}\s+[^\n]+?)[-–]\s*([A-Za-z .']+?)[-–]\s*([A-Za-z]{2})[-–]\s*(\d{5})/,
		);
	const phone =
		text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)?.[0] || "";
	const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
	const website =
		text.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[.,]$/, "") || "";
	const schedules = [];
	const portugueseBlock = text.match(
		/Portuguese[^\n]*\n([^\n]+)/i,
	)?.[1];
	if (portugueseBlock) {
		for (const part of portugueseBlock.split(/[/,;]/)) {
			const dayMatch = part.match(
				/(Sun|Mon|Tue|Wed|Thu|Fri|Sat|Sunday|Saturday|Wednesday|Wed)/i,
			);
			const time = parseTime(part);
			const day = dayMatch
				? parseDay(
						{
							sun: "sunday",
							sunday: "sunday",
							mon: "monday",
							tue: "tuesday",
							wed: "wednesday",
							wednesday: "wednesday",
							thu: "thursday",
							fri: "friday",
							sat: "saturday",
							saturday: "saturday",
						}[dayMatch[1].slice(0, 3).toLowerCase()] || dayMatch[1],
					)
				: 0;
			if (time && day != null) {
				schedules.push({
					day_of_week: day,
					time,
					language: "pt",
					notes: "Horário em português (página da comunidade)",
				});
			}
		}
	}
	return {
		url,
		name: decodeHtml(title),
		address: addressMatch
			? {
					address_line: addressMatch[1].replace(/[-–]\s*$/, "").trim(),
					city: addressMatch[2].trim(),
					state: addressMatch[3].toUpperCase(),
					zip: addressMatch[4],
				}
			: null,
		phone,
		email,
		website: website.includes("apostoladobrasileiro.com") ? "" : website,
		schedules,
		text,
	};
}

function mergePrefer(base, extra) {
	if (!extra) return base;
	if (!base.address_line && extra.address?.address_line) {
		base.address_line = extra.address.address_line;
		base.city = extra.address.city || base.city;
		base.state = extra.address.state || base.state;
		base.zip = extra.address.zip || base.zip;
	}
	base.phone ||= extra.phone;
	base.email ||= extra.email;
	base.website_url ||= extra.website;
	if ((!base.mass_schedules || base.mass_schedules.length === 0) && extra.schedules?.length) {
		base.mass_schedules = extra.schedules;
	}
	return base;
}

async function main() {
	console.log("Lendo o mapa público do Apostolado Brasileiro...");
	const listingHtml = await fetchText(LISTING);
	const makers = parseMakers(listingHtml).filter(
		(item) => item?.title && !SKIP_TITLES.test(item.title),
	);
	console.log(`${makers.length} locais no mapa (sem dioceses).`);

	const rows = [];
	for (const [index, maker] of makers.entries()) {
		process.stdout.write(`[${index + 1}/${makers.length}] ${maker.title}\n`);
		let details = {
			address: maker.address || "",
			phone: "",
			email: "",
			website: "",
			schedules: [],
		};
		try {
			const page = await fetchText(maker.link);
			details.address ||= parseLabeled(page, "Endereço");
			details.phone = parseLabeled(page, "Telefone");
			const emailOrSite = parseLabeled(page, "Email");
			const contact = contactFromValue(emailOrSite);
			details.email = contact.email;
			details.website = contact.website;
			details.schedules = parseSchedules(page);
			await sleep(350);
		} catch (error) {
			console.warn(`  falha na ficha: ${error.message}`);
		}

		let parsed = details.address ? parseUsAddress(details.address) : null;
		if (!parsed && maker.latitude && maker.longitude) {
			await sleep(1100);
			parsed = await reverseGeocode(maker.latitude, maker.longitude);
			if (parsed) {
				console.log(`  endereço via mapa: ${parsed.address_line}, ${parsed.city} ${parsed.state}`);
			}
		}

		const contact = contactFromValue(details.phone);
		rows.push({
			name: decodeHtml(maker.title),
			description:
				"Comunidade católica com missa em português listada pelo Apostolado Brasileiro.",
			address_line: parsed?.address_line || "",
			city: parsed?.city || "",
			state: parsed?.state || "",
			zip: parsed?.zip || "",
			lat: maker.latitude ? String(maker.latitude) : "",
			lng: maker.longitude ? String(maker.longitude) : "",
			website_url: details.website,
			phone: contact.phone || details.phone,
			email: details.email,
			instagram: "",
			facebook: "",
			whatsapp: "",
			mass_schedules: JSON.stringify(details.schedules ?? []),
			services: "missa",
			source_url: maker.link,
			admin_notes:
				"Importado do diretório público do Apostolado Brasileiro. Conferir endereço e horários antes de aprovar.",
		});
	}

	console.log("Lendo as comunidades de Massachusetts (Onde estamos)...");
	const whereHtml = await fetchText(WHERE);
	const maPages = [];
	for (const url of extractCommunityLinks(whereHtml)) {
		try {
			const html = await fetchText(url);
			maPages.push(parseMaCommunity(html, url));
			console.log(`  MA: ${maPages.at(-1).name || url}`);
			await sleep(350);
		} catch (error) {
			console.warn(`  falha MA ${url}: ${error.message}`);
		}
	}

	for (const row of rows) {
		const rowName = normalizeName(row.name);
		const extra = maPages.find((page) => {
			const pageName = normalizeName(page.name);
			if (!pageName || pageName.length < 6) return false;
			return rowName.includes(pageName) || pageName.includes(rowName);
		});
		if (extra) mergePrefer(row, extra);
	}

	const known = new Set(
		rows.map((row) => `${normalizeName(row.name)}|${normalizeName(row.city)}`),
	);
	for (const page of maPages) {
		if (!page.address) continue;
		const key = `${normalizeName(page.name)}|${normalizeName(page.address.city)}`;
		if (known.has(key)) continue;
		known.add(key);
		rows.push({
			name: page.name || `Comunidade Católica Brasileira de ${page.address.city}`,
			description:
				"Comunidade católica brasileira da Arquidiocese de Boston, listada pelo Apostolado Brasileiro.",
			address_line: page.address.address_line,
			city: page.address.city,
			state: page.address.state || "MA",
			zip: page.address.zip,
			lat: "",
			lng: "",
			website_url: page.website,
			phone: page.phone,
			email: page.email,
			instagram: "",
			facebook: "",
			whatsapp: "",
			mass_schedules: JSON.stringify(page.schedules ?? []),
			services: "missa",
			source_url: page.url,
			admin_notes:
				"Importado da página Onde estamos do Apostolado Brasileiro. Conferir endereço e horários antes de aprovar.",
		});
	}

	const usable = rows.filter((row) => row.name && row.address_line && row.city && row.state);
	const skipped = rows.length - usable.length;
	const header = [
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
	];
	const csv = [
		header.join(","),
		...usable.map((row) => header.map((key) => csvEscape(row[key] ?? "")).join(",")),
	].join("\n");

	await mkdir(join(ROOT, "data"), { recursive: true });
	const csvPath = join(ROOT, "data/apostolado-comunidades.csv");
	await writeFile(csvPath, `${csv}\n`, "utf8");
	await writeFile(
		join(ROOT, "data/apostolado-comunidades.json"),
		JSON.stringify({ source: LISTING, generated_at: new Date().toISOString(), count: usable.length, communities: usable }, null, 2),
		"utf8",
	);
	console.log(`CSV: ${csvPath}`);
	console.log(`${usable.length} comunidades prontas para importar. ${skipped} sem endereço suficiente.`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
