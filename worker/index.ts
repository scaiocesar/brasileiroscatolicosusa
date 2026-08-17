import { Hono } from "hono";
import type { Context } from "hono";
import type { CommunityInput, CommunityStatus } from "../shared/types";
import {
	clearSessionCookie,
	clientIp,
	createSessionToken,
	getLockout,
	isJsonRequest,
	isSameOrigin,
	isValidSession,
	readCookie,
	recordLoginFailure,
	recordLoginSuccess,
	secretsMatch,
	sessionCookie,
} from "./auth";
import {
	createCommunity,
	deleteCommunity,
	findDuplicateCommunity,
	getCommunity,
	listAdminCommunities,
	listApprovedDetailed,
	listApprovedSitemap,
	listSummaries,
	resolveCoordinates,
	setStatus,
	updateCommunity,
	validateInput,
} from "./db";
import { formatGeocodeQuery, geocodeAddress } from "./geocode";
import { applyHtmlSeo, withStatus } from "./seo";
import { verifyTurnstile } from "./turnstile";
import { csvRowsToInputs } from "../shared/csv";
import {
	buildIndexMarkdown,
	buildInformeMarkdown,
	buildLlmsFull,
	buildLlmsTxt,
	communityMarkdown,
	filterSummaries,
	openApiSpec,
	toPublicCommunity,
} from "../shared/llms";
import { buildSitemapXml, seoForPath } from "../shared/seo";
import { isPublicAiPath, jsonPublic, markdownResponse, wantsMarkdown } from "./ai";

const app = new Hono<{ Bindings: Env }>();

function isSecureRequest(request: Request): boolean {
	return new URL(request.url).protocol === "https:";
}

async function requireAdmin(c: Context<{ Bindings: Env }>): Promise<boolean> {
	if (!isSameOrigin(c.req.raw) && c.req.method !== "GET") return false;
	const token = readCookie(c.req.raw.headers.get("Cookie"));
	return isValidSession(c.env.AUTH_SECRET, token);
}

app.use("*", async (c, next) => {
	const url = new URL(c.req.url);
	if (
		url.hostname === "www.brasileiroscatolicosusa.org" &&
		(c.req.method === "GET" || c.req.method === "HEAD")
	) {
		url.hostname = "brasileiroscatolicosusa.org";
		return c.redirect(url.toString(), 301);
	}
	await next();
});

app.use("*", async (c, next) => {
	if (c.req.method === "OPTIONS" && isPublicAiPath(c.req.path)) {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
				"Access-Control-Max-Age": "86400",
			},
		});
	}
	await next();
});

app.get("/sitemap.xml", async (c) => {
	const communities = await listApprovedSitemap(c.env.DB);
	return new Response(buildSitemapXml(communities), {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
			"Access-Control-Allow-Origin": "*",
		},
	});
});

app.get("/llms.txt", async (c) => {
	const communities = await listSummaries(c.env.DB, "approved");
	return markdownResponse(buildLlmsTxt(communities), { plain: true });
});

app.get("/llms-full.txt", async (c) => {
	const communities = await listApprovedDetailed(c.env.DB);
	return markdownResponse(
		buildLlmsFull(communities.map(toPublicCommunity)),
		{ plain: true },
	);
});

app.get("/index.md", async (c) => {
	const communities = await listSummaries(c.env.DB, "approved");
	return markdownResponse(buildIndexMarkdown(communities), { path: "/" });
});

app.get("/informe.md", () => {
	return markdownResponse(buildInformeMarkdown(), { path: "/informe" });
});

app.get("/openapi.json", () => jsonPublic(openApiSpec()));

app.get("/api/config", (c) => {
	return c.json({
		turnstileSiteKey: c.env.TURNSTILE_SITE_KEY ?? "",
	});
});

app.get("/api/communities", async (c) => {
	const communities = filterSummaries(await listSummaries(c.env.DB, "approved"), {
		state: c.req.query("state"),
		city: c.req.query("city"),
		q: c.req.query("q"),
		service: c.req.query("service"),
	});
	return jsonPublic({ communities });
});

app.get("/api/communities/:slug", async (c) => {
	const community = await getCommunity(c.env.DB, c.req.param("slug"), false);
	if (!community) return jsonPublic({ error: "Comunidade não encontrada." }, 404);
	return jsonPublic({ community: toPublicCommunity(community) });
});

app.post("/api/geocode", async (c) => {
	const body = (await c.req.json().catch(() => null)) as {
		address_line?: string;
		city?: string;
		state?: string;
		zip?: string;
	} | null;
	if (!body?.address_line || !body.city || !body.state) {
		return c.json({ error: "Informe endereço, cidade e estado." }, 400);
	}
	const found = await geocodeAddress(
		formatGeocodeQuery({
			address_line: body.address_line,
			city: body.city,
			state: body.state,
			zip: body.zip,
		}),
	);
	if (!found) {
		return c.json(
			{ error: "Não foi possível localizar o endereço. Ajuste o pin no mapa." },
			404,
		);
	}
	return c.json(found);
});

app.post("/api/submissions", async (c) => {
	const input = (await c.req.json().catch(() => null)) as CommunityInput | null;
	if (!input) return c.json({ error: "Dados inválidos." }, 400);

	const valid = validateInput(input, { requireSubmitter: true });
	if (valid) return c.json({ error: valid }, 400);

	const human = await verifyTurnstile(
		c.env.TURNSTILE_SECRET,
		input.turnstile_token,
		c.req.header("CF-Connecting-IP") ?? null,
	);
	if (!human) {
		return c.json({ error: "Falha na verificação anti-spam. Tente novamente." }, 400);
	}

	const coords = await resolveCoordinates(input, geocodeAddress);
	if (!coords) {
		return c.json(
			{
				error:
					"Não foi possível localizar o endereço. Arraste o pin no mapa para a posição correta.",
			},
			400,
		);
	}

	const community = await createCommunity(c.env.DB, input, coords, "pending");
	return c.json({ ok: true, id: community.id, slug: community.slug }, 201);
});

app.post("/api/admin/login", async (c) => {
	if (!isSameOrigin(c.req.raw) || !isJsonRequest(c.req.raw)) {
		return c.json({ error: "Não autorizado." }, 403);
	}
	if (!c.env.ADMIN_USERNAME || !c.env.ADMIN_PASSWORD || !c.env.AUTH_SECRET) {
		return c.json({ error: "Administração ainda não configurada." }, 500);
	}

	const ip = clientIp(c.req.raw);
	const lockout = await getLockout(c.env.DB, ip);
	if (lockout.locked) {
		return c.json(
			{ error: "Muitas tentativas. Tente novamente em alguns minutos." },
			{
				status: 429,
				headers: { "Retry-After": String(lockout.retryAfterSec) },
			},
		);
	}

	const body = (await c.req.json().catch(() => null)) as {
		username?: string;
		password?: string;
		turnstile_token?: string;
	} | null;

	const human = await verifyTurnstile(
		c.env.TURNSTILE_SECRET,
		body?.turnstile_token,
		c.req.header("CF-Connecting-IP") ?? null,
	);
	if (!human) {
		await recordLoginFailure(c.env.DB, ip);
		return c.json({ error: "Falha na verificação anti-spam. Tente novamente." }, 400);
	}

	const usernameOk = await secretsMatch(
		c.env.AUTH_SECRET,
		body?.username?.trim() ?? "",
		c.env.ADMIN_USERNAME,
	);
	const passwordOk = await secretsMatch(
		c.env.AUTH_SECRET,
		body?.password ?? "",
		c.env.ADMIN_PASSWORD,
	);

	if (!usernameOk || !passwordOk) {
		await recordLoginFailure(c.env.DB, ip);
		return c.json({ error: "Usuário ou senha inválidos." }, 401);
	}

	await recordLoginSuccess(c.env.DB, ip);
	const token = await createSessionToken(c.env.AUTH_SECRET, c.env.ADMIN_USERNAME);
	return c.json(
		{ ok: true },
		{
			headers: {
				"Set-Cookie": sessionCookie(token, isSecureRequest(c.req.raw)),
			},
		},
	);
});

app.post("/api/admin/logout", (c) => {
	return c.json(
		{ ok: true },
		{
			headers: {
				"Set-Cookie": clearSessionCookie(isSecureRequest(c.req.raw)),
			},
		},
	);
});

app.get("/api/admin/me", async (c) => {
	const ok = await requireAdmin(c);
	return c.json({ authenticated: ok }, ok ? 200 : 401);
});

app.get("/api/admin/communities", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const status = c.req.query("status") as CommunityStatus | undefined;
	const allowed: CommunityStatus[] = ["pending", "approved", "rejected"];
	const filter = status && allowed.includes(status) ? status : undefined;
	const communities = await listAdminCommunities(c.env.DB, filter);
	return c.json({ communities });
});

app.get("/api/admin/communities/:id", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const community = await getCommunity(c.env.DB, c.req.param("id"), true);
	if (!community) return c.json({ error: "Comunidade não encontrada." }, 404);
	return c.json({ community });
});

app.post("/api/admin/communities", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const input = (await c.req.json().catch(() => null)) as CommunityInput | null;
	if (!input) return c.json({ error: "Dados inválidos." }, 400);
	const valid = validateInput(input);
	if (valid) return c.json({ error: valid }, 400);
	const coords = await resolveCoordinates(input, geocodeAddress);
	if (!coords) {
		return c.json({ error: "Informe ou localise a posição no mapa." }, 400);
	}
	const community = await createCommunity(
		c.env.DB,
		input,
		coords,
		input.status ?? "approved",
	);
	return c.json({ community }, 201);
});

app.post("/api/admin/communities/import", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const body = (await c.req.json().catch(() => null)) as { csv?: string } | null;
	if (!body?.csv?.trim()) {
		return c.json({ error: "Envie o conteúdo do CSV." }, 400);
	}

	const parsed = csvRowsToInputs(body.csv);
	if (parsed.inputs.length === 0) {
		return c.json(
			{
				error: parsed.errors[0] || "Nenhuma comunidade válida no CSV.",
				imported: 0,
				skipped: 0,
				errors: parsed.errors,
			},
			400,
		);
	}

	const errors = [...parsed.errors];
	let imported = 0;
	let skipped = 0;

	for (const input of parsed.inputs) {
		const duplicate = await findDuplicateCommunity(
			c.env.DB,
			input.name,
			input.city,
			input.state,
		);
		if (duplicate) {
			skipped += 1;
			errors.push(`${input.name} (${input.city}, ${input.state}): já cadastrada.`);
			continue;
		}

		const valid = validateInput(input);
		if (valid) {
			skipped += 1;
			errors.push(`${input.name}: ${valid}`);
			continue;
		}

		const coords = await resolveCoordinates(input, geocodeAddress);
		if (!coords) {
			skipped += 1;
			errors.push(
				`${input.name}: não foi possível localizar o endereço. Ajuste no CSV e importe de novo.`,
			);
			continue;
		}

		await createCommunity(c.env.DB, input, coords, "pending");
		imported += 1;
	}

	return c.json({ ok: true, imported, skipped, errors });
});

app.put("/api/admin/communities/:id", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const input = (await c.req.json().catch(() => null)) as CommunityInput | null;
	if (!input) return c.json({ error: "Dados inválidos." }, 400);
	const valid = validateInput(input);
	if (valid) return c.json({ error: valid }, 400);
	const coords = await resolveCoordinates(input, geocodeAddress);
	if (!coords) {
		return c.json({ error: "Informe ou localise a posição no mapa." }, 400);
	}
	const community = await updateCommunity(
		c.env.DB,
		Number(c.req.param("id")),
		input,
		coords,
	);
	if (!community) return c.json({ error: "Comunidade não encontrada." }, 404);
	return c.json({ community });
});

app.post("/api/admin/communities/:id/approve", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const community = await setStatus(
		c.env.DB,
		Number(c.req.param("id")),
		"approved",
	);
	if (!community) return c.json({ error: "Comunidade não encontrada." }, 404);
	return c.json({ community });
});

app.post("/api/admin/communities/:id/reject", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const community = await setStatus(
		c.env.DB,
		Number(c.req.param("id")),
		"rejected",
	);
	if (!community) return c.json({ error: "Comunidade não encontrada." }, 404);
	return c.json({ community });
});

app.delete("/api/admin/communities/:id", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const ok = await deleteCommunity(c.env.DB, Number(c.req.param("id")));
	if (!ok) return c.json({ error: "Comunidade não encontrada." }, 404);
	return c.json({ ok: true });
});

app.notFound(async (c) => {
	if (c.req.path.startsWith("/api/")) {
		return c.json({ error: "Não encontrado." }, 404);
	}
	return servePublicPage(c);
});

async function servePublicPage(c: Context<{ Bindings: Env }>): Promise<Response> {
	const url = new URL(c.req.url);
	const markdownPage = await serveMarkdownPage(c, url);
	if (markdownPage) return markdownPage;

	const response = await c.env.ASSETS.fetch(c.req.raw);
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("text/html")) return response;

	const match = url.pathname.match(/^\/comunidade\/([^/]+)\/?$/);
	if (match) {
		const community = await getCommunity(c.env.DB, decodeURIComponent(match[1]));
		if (wantsMarkdown(c.req.raw) && community) {
			return markdownResponse(communityMarkdown(toPublicCommunity(community)), {
				path: `/comunidade/${community.slug}`,
			});
		}
		const rewritten = applyHtmlSeo(response, seoForPath(url.pathname, community));
		return community ? rewritten : withStatus(rewritten, 404);
	}

	if (wantsMarkdown(c.req.raw)) {
		const path = url.pathname.replace(/\/+$/, "") || "/";
		if (path === "/") {
			const communities = await listSummaries(c.env.DB, "approved");
			return markdownResponse(buildIndexMarkdown(communities), { path: "/" });
		}
		if (path === "/informe") {
			return markdownResponse(buildInformeMarkdown(), { path: "/informe" });
		}
	}

	return applyHtmlSeo(response, seoForPath(url.pathname));
}

async function serveMarkdownPage(
	c: Context<{ Bindings: Env }>,
	url: URL,
): Promise<Response | null> {
	const communityMd = url.pathname.match(/^\/comunidade\/([^/]+)\.md$/);
	if (communityMd) {
		const community = await getCommunity(
			c.env.DB,
			decodeURIComponent(communityMd[1]),
		);
		if (!community) {
			return markdownResponse("Comunidade não encontrada.\n", {
				plain: true,
				status: 404,
			});
		}
		return markdownResponse(communityMarkdown(toPublicCommunity(community)), {
			path: `/comunidade/${community.slug}`,
		});
	}
	return null;
}

export default app;
