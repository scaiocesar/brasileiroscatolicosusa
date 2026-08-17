import { GA_MEASUREMENT_ID } from "../shared/seo";

export const CONSENT_STORAGE_KEY = "cookie-consent";
export type CookieConsent = "accepted" | "denied";

declare global {
	interface Window {
		dataLayer: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

export function getCookieConsent(): CookieConsent | null {
	try {
		const value = localStorage.getItem(CONSENT_STORAGE_KEY);
		if (value === "accepted" || value === "denied") return value;
	} catch {
		return null;
	}
	return null;
}

export function setCookieConsent(value: CookieConsent): void {
	try {
		localStorage.setItem(CONSENT_STORAGE_KEY, value);
	} catch {
		return;
	}
}

export function loadGoogleAnalytics(): void {
	if (window.gtag) return;

	window.dataLayer = window.dataLayer || [];
	window.gtag = (...args: unknown[]) => {
		window.dataLayer.push(args);
	};
	window.gtag("js", new Date());
	window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });

	const script = document.createElement("script");
	script.async = true;
	script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
	document.head.appendChild(script);
}

export function trackPageView(path: string, title: string): void {
	if (getCookieConsent() !== "accepted") return;
	loadGoogleAnalytics();
	window.gtag?.("event", "page_view", {
		page_title: title,
		page_location: window.location.href,
		page_path: path,
		send_to: GA_MEASUREMENT_ID,
	});
}
