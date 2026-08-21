export async function geocodeAddress(query: string): Promise<{
	lat: number;
	lng: number;
	displayName: string;
} | null> {
	const url = new URL("https://nominatim.openstreetmap.org/search");
	url.searchParams.set("q", query);
	url.searchParams.set("format", "json");
	url.searchParams.set("limit", "1");
	url.searchParams.set("countrycodes", "us");

	const response = await fetch(url.toString(), {
		headers: {
			Accept: "application/json",
			"User-Agent":
				"BrasileirosCatolicosEUA/1.0 (https://brasileiroscatolicoseua.com)",
		},
	});

	if (!response.ok) return null;
	const results = (await response.json()) as Array<{
		lat: string;
		lon: string;
		display_name: string;
	}>;
	const first = results[0];
	if (!first) return null;
	return {
		lat: Number(first.lat),
		lng: Number(first.lon),
		displayName: first.display_name,
	};
}

export function formatGeocodeQuery(input: {
	address_line: string;
	city: string;
	state: string;
	zip?: string | null;
}): string {
	return [input.address_line, input.city, input.state, input.zip, "USA"]
		.filter(Boolean)
		.join(", ");
}

export function normalizeUsZip(value: string | null | undefined): string {
	return (value ?? "").replace(/\D/g, "").slice(0, 5);
}

export async function lookupZip(zip: string): Promise<{
	zip: string;
	city: string;
	state: string;
	lat: number;
	lng: number;
} | null> {
	const code = normalizeUsZip(zip);
	if (!/^\d{5}$/.test(code)) return null;

	const response = await fetch(`https://api.zippopotam.us/us/${code}`, {
		headers: { Accept: "application/json" },
	});
	if (!response.ok) return null;

	const data = (await response.json()) as {
		places?: Array<{
			"place name"?: string;
			"state abbreviation"?: string;
			latitude?: string;
			longitude?: string;
		}>;
	};
	const place = data.places?.[0];
	const city = place?.["place name"]?.trim();
	const state = place?.["state abbreviation"]?.trim().toUpperCase();
	const lat = Number(place?.latitude);
	const lng = Number(place?.longitude);
	if (!city || !state || !Number.isFinite(lat) || !Number.isFinite(lng)) {
		return null;
	}
	return { zip: code, city, state, lat, lng };
}
