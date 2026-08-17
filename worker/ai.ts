import { canonicalUrl } from "../shared/seo";

const CORS = "Access-Control-Allow-Origin";

export function markdownResponse(
	body: string,
	options: { path?: string; plain?: boolean; status?: number } = {},
): Response {
	const headers = new Headers({
		"Content-Type": options.plain
			? "text/plain; charset=utf-8"
			: "text/markdown; charset=utf-8",
		"Cache-Control": "public, max-age=3600",
		[CORS]: "*",
	});
	headers.append("Link", `<${canonicalUrl("/llms.txt")}>; rel="describedby"`);
	if (options.path) {
		const markdown =
			options.path === "/"
				? canonicalUrl("/index.md")
				: canonicalUrl(`${options.path.replace(/\/+$/, "")}.md`);
		headers.append(
			"Link",
			`<${markdown}>; rel="alternate"; type="text/markdown"`,
		);
	}
	return new Response(body, {
		status: options.status ?? 200,
		headers,
	});
}

export function jsonPublic(data: unknown, status = 200): Response {
	return Response.json(data, {
		status,
		headers: {
			[CORS]: "*",
			"Cache-Control": "public, max-age=300",
			"X-Robots-Tag": "noindex",
		},
	});
}

export function wantsMarkdown(request: Request): boolean {
	const accept = request.headers.get("Accept") ?? "";
	return accept.includes("text/markdown") && !accept.includes("text/html");
}

export function isPublicAiPath(pathname: string): boolean {
	return (
		pathname === "/llms.txt" ||
		pathname === "/llms-full.txt" ||
		pathname === "/index.md" ||
		pathname === "/informe.md" ||
		pathname === "/openapi.json" ||
		pathname === "/sitemap.xml" ||
		pathname === "/api/communities" ||
		pathname.startsWith("/api/communities/") ||
		/^\/comunidade\/[^/]+\.md$/.test(pathname)
	);
}
