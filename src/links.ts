import { SITE_ORIGIN } from "../shared/seo";

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

export function whatsappGroupUrl(value: string | null | undefined): string | null {
	const url = externalUrl(value);
	if (!url) return null;
	try {
		const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
		if (
			host === "chat.whatsapp.com" ||
			host === "whatsapp.com" ||
			host.endsWith(".whatsapp.com")
		) {
			return url;
		}
		return null;
	} catch {
		return null;
	}
}

export function communityShareUrl(slug: string): string {
	return `${SITE_ORIGIN}/comunidade/${slug}`;
}

export function whatsappShareUrl(text: string): string {
	return `https://wa.me/?text=${encodeURIComponent(text)}`;
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

export function mapsUrl(
	address: string,
	city: string,
	state: string,
	zip?: string | null,
): string {
	return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
		[address, city, state, zip].filter(Boolean).join(", "),
	)}`;
}

export function mapsDirectionsUrl(lat: number, lng: number): string {
	return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
