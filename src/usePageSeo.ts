import { useEffect } from "react";
import type { SeoDocument } from "../shared/seo";
import { safeJsonLd } from "../shared/seo";

export function usePageSeo(seo: SeoDocument) {
	useEffect(() => {
		document.title = seo.title;
		setNamedMeta("description", seo.description);
		setNamedMeta("robots", seo.robots);
		setPropertyMeta("og:title", seo.title);
		setPropertyMeta("og:description", seo.description);
		setPropertyMeta("og:url", seo.canonical);
		setNamedMeta("twitter:title", seo.title);
		setNamedMeta("twitter:description", seo.description);

		const canonical = document.querySelector('link[rel="canonical"]');
		canonical?.setAttribute("href", seo.canonical);
		for (const link of document.querySelectorAll('link[rel="alternate"][hreflang]')) {
			link.setAttribute("href", seo.canonical);
		}
		const markdown = document.querySelector(
			'link[rel="alternate"][type="text/markdown"]',
		);
		if (seo.markdown) {
			markdown?.setAttribute("href", seo.markdown);
		} else {
			markdown?.remove();
		}

		const jsonLd = document.getElementById("json-ld-page");
		if (jsonLd) jsonLd.textContent = safeJsonLd(seo.jsonLd);
	}, [seo]);
}

function setNamedMeta(name: string, content: string) {
	document.querySelector(`meta[name="${name}"]`)?.setAttribute("content", content);
}

function setPropertyMeta(property: string, content: string) {
	document
		.querySelector(`meta[property="${property}"]`)
		?.setAttribute("content", content);
}
