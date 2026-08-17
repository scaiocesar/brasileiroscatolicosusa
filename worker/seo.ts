import type { SeoDocument } from "../shared/seo";
import { safeJsonLd } from "../shared/seo";

export function applyHtmlSeo(response: Response, seo: SeoDocument): Response {
	return new HTMLRewriter()
		.on("title", {
			element(el) {
				el.setInnerContent(seo.title);
			},
		})
		.on('meta[name="description"]', {
			element(el) {
				el.setAttribute("content", seo.description);
			},
		})
		.on('meta[name="robots"]', {
			element(el) {
				el.setAttribute("content", seo.robots);
			},
		})
		.on('link[rel="canonical"]', {
			element(el) {
				el.setAttribute("href", seo.canonical);
			},
		})
		.on('link[rel="alternate"]', {
			element(el) {
				el.setAttribute("href", seo.canonical);
			},
		})
		.on('meta[property="og:title"]', {
			element(el) {
				el.setAttribute("content", seo.title);
			},
		})
		.on('meta[property="og:description"]', {
			element(el) {
				el.setAttribute("content", seo.description);
			},
		})
		.on('meta[property="og:url"]', {
			element(el) {
				el.setAttribute("content", seo.canonical);
			},
		})
		.on('meta[name="twitter:title"]', {
			element(el) {
				el.setAttribute("content", seo.title);
			},
		})
		.on('meta[name="twitter:description"]', {
			element(el) {
				el.setAttribute("content", seo.description);
			},
		})
		.on("script#json-ld-page", {
			element(el) {
				el.setInnerContent(safeJsonLd(seo.jsonLd), { html: true });
			},
		})
		.transform(response);
}

export function withStatus(response: Response, status: number): Response {
	return new Response(response.body, {
		status,
		statusText: status === 404 ? "Not Found" : response.statusText,
		headers: response.headers,
	});
}
