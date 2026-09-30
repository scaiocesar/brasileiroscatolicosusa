import { GA_MEASUREMENT_ID } from "../shared/seo";

export const CONSENT_STORAGE_KEY = "cookie-consent";
export type CookieConsent = "accepted" | "denied";

declare global {
	interface Window {
		dataLayer: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

let scriptRequested = false;

function isGaDebugEnabled(): boolean {
	if (import.meta.env.DEV) return true;
	try {
		return new URLSearchParams(window.location.search).has("debug_ga");
	} catch {
		return false;
	}
}

function debugGa(...args: unknown[]): void {
	if (!isGaDebugEnabled()) return;
	console.info("[GA]", ...args);
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

function ensureGtagStub(): void {
	window.dataLayer = window.dataLayer || [];
	if (window.gtag) return;
	// Must be a classic function: gtag.js expects an Arguments object in
	// dataLayer, not a rest-parameter Array (which silently drops hits).
	window.gtag = function gtag() {
		// eslint-disable-next-line prefer-rest-params
		window.dataLayer.push(arguments);
	};
}

function applyConsent(value: CookieConsent | null): void {
	ensureGtagStub();
	const granted = value === "accepted";
	window.gtag?.("consent", "update", {
		ad_storage: "denied",
		ad_user_data: "denied",
		ad_personalization: "denied",
		analytics_storage: granted ? "granted" : "denied",
	});
	debugGa("consent update", {
		analytics_storage: granted ? "granted" : "denied",
	});
}

/** Carrega o gtag com Consent Mode. Sem aceite, analytics fica denied. */
export function initGoogleAnalytics(): void {
	ensureGtagStub();

	if (!scriptRequested) {
		window.gtag?.("consent", "default", {
			ad_storage: "denied",
			ad_user_data: "denied",
			ad_personalization: "denied",
			analytics_storage: "denied",
			wait_for_update: 500,
		});
		window.gtag?.("js", new Date());
		window.gtag?.("config", GA_MEASUREMENT_ID, {
			send_page_view: false,
			anonymize_ip: true,
		});

		const script = document.createElement("script");
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
		script.onload = () => debugGa("gtag.js loaded", GA_MEASUREMENT_ID);
		script.onerror = () => console.warn("[GA] falha ao carregar gtag.js");
		document.head.appendChild(script);
		scriptRequested = true;
		debugGa("script requested", GA_MEASUREMENT_ID);
	}

	const consent = getCookieConsent();
	if (consent) applyConsent(consent);
}

/** @deprecated use initGoogleAnalytics — mantido para imports existentes */
export function loadGoogleAnalytics(): void {
	initGoogleAnalytics();
	if (getCookieConsent() === "accepted") applyConsent("accepted");
}

export function grantAnalyticsConsent(): void {
	setCookieConsent("accepted");
	initGoogleAnalytics();
	applyConsent("accepted");
	debugGa("consent accepted");
}

export function denyAnalyticsConsent(): void {
	setCookieConsent("denied");
	initGoogleAnalytics();
	applyConsent("denied");
	debugGa("consent denied");
}

export function trackPageView(path: string, title: string): void {
	initGoogleAnalytics();
	if (getCookieConsent() !== "accepted") {
		debugGa("page_view skipped (sem consentimento)", path);
		return;
	}
	window.gtag?.("event", "page_view", {
		page_title: title,
		page_location: window.location.href,
		page_path: path,
		send_to: GA_MEASUREMENT_ID,
	});
	debugGa("page_view", path, title);
}
