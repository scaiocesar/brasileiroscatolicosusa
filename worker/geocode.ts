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
