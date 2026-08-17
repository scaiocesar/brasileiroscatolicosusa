export function externalUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

export function whatsappUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	const digits = value.replace(/\D/g, "");
	if (!digits) return null;
	return `https://wa.me/${digits}`;
}

export function instagramUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://instagram.com/${trimmed.replace(/^@/, "")}`;
}

export function facebookUrl(value: string | null | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://facebook.com/${trimmed}`;
}

export function mapsUrl(address: string, city: string, state: string): string {
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${city}, ${state}`)}`;
}
