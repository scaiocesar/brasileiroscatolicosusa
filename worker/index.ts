import { Hono } from "hono";
import type { Context } from "hono";
import type { CommunityInput, CommunityStatus } from "../shared/types";
import {
	clearSessionCookie,
	clientIp,
	createSessionToken,
	getLockout,
	getSessionUsername,
	isJsonRequest,
	isSameOrigin,
	readCookie,
	recordLoginFailure,
	recordLoginSuccess,
	secretsMatch,
	sessionCookie,
	verifyPasswordHash,
} from "./auth";
import {
	countAdmins,
	createAdmin,
	ensureBootstrapAdmin,
	getAdminByUsername,
	listAdmins,
	resetAdminPassword,
	setAdminStatus,
	touchAdminLogin,
	updateAdmin,
} from "./admins";
import {
	createCommunity,
	deleteAllCommunities,
	deleteCommunities,
	deleteCommunity,
	findDuplicateCommunity,
	getCommunity,
	listAdminCommunities,
	listApprovedDetailed,
	listApprovedSitemap,
	listCommunitiesByIds,
	listSummaries,
	resolveCoordinates,
	setStatus,
	setStatusMany,
	updateCommunity,
	upsertCommunityFromBackup,
	validateInput,
} from "./db";
import {
	buildCommunitiesBackup,
	defaultBackupFileName,
	parseCommunitiesBackup,
	serializeCommunitiesBackup,
} from "../shared/backup";
import { formatGeocodeQuery, geocodeAddress, lookupZip, normalizeUsZip } from "./geocode";
import { applyHtmlSeo, withStatus } from "./seo";
import { queueApprovalEmail, queueApprovalEmails } from "./mail";
import { verifyTurnstile } from "./turnstile";
import { csvRowsToInputs } from "../shared/csv";
import {
	createCorrection,
	getCorrection,
	listCorrections,
	sanitizeProposed,
	setCorrectionStatus,
} from "./corrections";
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

app.onError((err, c) => {
	const detail = err instanceof Error ? err.message : "";
	const missingColumn = /no such column/i.test(detail);
	return c.json(
		{
			error: missingColumn
				? "O banco ainda não tem o campo de grupo do WhatsApp. Rode npm run db:migrate:remote."
				: "Algo deu errado. Tente novamente.",
		},
		500,
	);
});

function isSecureRequest(request: Request): boolean {
	return new URL(request.url).protocol === "https:";
}

async function requireAdmin(
	c: Context<{ Bindings: Env }>,
): Promise<{ id: number; username: string } | null> {
	if (!isSameOrigin(c.req.raw) && c.req.method !== "GET") return null;
	if (!c.env.AUTH_SECRET) return null;
	const token = readCookie(c.req.raw.headers.get("Cookie"));
	const username = await getSessionUsername(c.env.AUTH_SECRET, token);
	if (!username) return null;

	await ensureBootstrapAdmin(
		c.env.DB,
		c.env.AUTH_SECRET,
		c.env.ADMIN_USERNAME,
		c.env.ADMIN_PASSWORD,
	);

	const admin = await getAdminByUsername(c.env.DB, username);
	if (!admin || admin.status !== "active") return null;
	return { id: admin.id, username: admin.username };
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
		cartoApiKey: c.env.CARTO_API_KEY ?? "",
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

app.post("/api/communities/:slug/corrections", async (c) => {
	const community = await getCommunity(c.env.DB, c.req.param("slug"), false);
	if (!community) return c.json({ error: "Comunidade não encontrada." }, 404);

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

	const correction = await createCorrection(c.env.DB, community.id, {
		...input,
		lat: coords.lat,
		lng: coords.lng,
	});
	return c.json({ ok: true, id: correction.id }, 201);
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

app.get("/api/zip/:zip", async (c) => {
	const zip = normalizeUsZip(c.req.param("zip"));
	if (!/^\d{5}$/.test(zip)) {
		return c.json({ error: "Informe um ZIP americano de 5 dígitos." }, 400);
	}
	const found = await lookupZip(zip);
	if (!found) {
		return c.json({ error: "CEP não encontrado." }, 404);
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

	const community = await createCommunity(
		c.env.DB,
		{
			...sanitizeProposed(input),
			submitted_by_name: input.submitted_by_name,
			submitted_by_email: input.submitted_by_email,
		},
		coords,
		"pending",
	);
	return c.json({ ok: true, id: community.id, slug: community.slug }, 201);
});

app.post("/api/admin/login", async (c) => {
	if (!isSameOrigin(c.req.raw) || !isJsonRequest(c.req.raw)) {
		return c.json({ error: "Não autorizado." }, 403);
	}
	if (!c.env.AUTH_SECRET) {
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

	const username = body?.username?.trim() ?? "";
	const password = body?.password ?? "";

	await ensureBootstrapAdmin(
		c.env.DB,
		c.env.AUTH_SECRET,
		c.env.ADMIN_USERNAME,
		c.env.ADMIN_PASSWORD,
	);

	let admin = await getAdminByUsername(c.env.DB, username);

	// Fallback: se ainda não houver admins no banco, aceita o usuário das secrets.
	if (!admin && (await countAdmins(c.env.DB)) === 0) {
		const usernameOk = await secretsMatch(
			c.env.AUTH_SECRET,
			username,
			c.env.ADMIN_USERNAME ?? "",
		);
		const passwordOk = await secretsMatch(
			c.env.AUTH_SECRET,
			password,
			c.env.ADMIN_PASSWORD ?? "",
		);
		if (usernameOk && passwordOk) {
			admin = await ensureBootstrapAdmin(
				c.env.DB,
				c.env.AUTH_SECRET,
				c.env.ADMIN_USERNAME,
				c.env.ADMIN_PASSWORD,
			);
		}
	}

	const passwordOk =
		admin != null &&
		(await verifyPasswordHash(c.env.AUTH_SECRET, password, admin.password_hash));

	if (!admin || !passwordOk) {
		await recordLoginFailure(c.env.DB, ip);
		return c.json({ error: "Usuário ou senha inválidos." }, 401);
	}

	if (admin.status === "blocked") {
		await recordLoginFailure(c.env.DB, ip);
		return c.json({ error: "Este usuário está bloqueado." }, 403);
	}

	await recordLoginSuccess(c.env.DB, ip);
	await touchAdminLogin(c.env.DB, admin.id);
	const token = await createSessionToken(c.env.AUTH_SECRET, admin.username);
	return c.json(
		{ ok: true, username: admin.username },
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
	const session = await requireAdmin(c);
	if (!session) return c.json({ authenticated: false }, 401);
	return c.json({
		authenticated: true,
		username: session.username,
		id: session.id,
	});
});

app.get("/api/admin/users", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const users = await listAdmins(c.env.DB);
	return c.json({ users });
});

app.post("/api/admin/users", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	if (!isSameOrigin(c.req.raw) || !isJsonRequest(c.req.raw)) {
		return c.json({ error: "Não autorizado." }, 403);
	}
	const body = (await c.req.json().catch(() => null)) as {
		username?: string;
		display_name?: string | null;
		password?: string;
	} | null;
	if (!body?.username?.trim() || !body.password) {
		return c.json({ error: "Informe usuário e senha." }, 400);
	}
	try {
		const user = await createAdmin(c.env.DB, {
			username: body.username,
			display_name: body.display_name,
			password: body.password,
			authSecret: c.env.AUTH_SECRET!,
		});
		return c.json({ user }, 201);
	} catch (err) {
		return c.json(
			{ error: err instanceof Error ? err.message : "Não foi possível criar." },
			400,
		);
	}
});

app.put("/api/admin/users/:id", async (c) => {
	const session = await requireAdmin(c);
	if (!session) return c.json({ error: "Não autorizado." }, 401);
	if (!isSameOrigin(c.req.raw) || !isJsonRequest(c.req.raw)) {
		return c.json({ error: "Não autorizado." }, 403);
	}
	const id = Number(c.req.param("id"));
	const body = (await c.req.json().catch(() => null)) as {
		username?: string;
		display_name?: string | null;
	} | null;
	if (!body) return c.json({ error: "Dados inválidos." }, 400);
	try {
		const user = await updateAdmin(c.env.DB, id, {
			username: body.username,
			display_name: body.display_name,
		});
		if (!user) return c.json({ error: "Usuário não encontrado." }, 404);
		return c.json({ user });
	} catch (err) {
		return c.json(
			{ error: err instanceof Error ? err.message : "Não foi possível salvar." },
			400,
		);
	}
});

app.post("/api/admin/users/:id/block", async (c) => {
	const session = await requireAdmin(c);
	if (!session) return c.json({ error: "Não autorizado." }, 401);
	const id = Number(c.req.param("id"));
	if (session.id === id) {
		return c.json({ error: "Você não pode bloquear a si mesmo." }, 400);
	}
	try {
		const user = await setAdminStatus(c.env.DB, id, "blocked");
		if (!user) return c.json({ error: "Usuário não encontrado." }, 404);
		return c.json({ user });
	} catch (err) {
		return c.json(
			{
				error:
					err instanceof Error ? err.message : "Não foi possível bloquear.",
			},
			400,
		);
	}
});

app.post("/api/admin/users/:id/unblock", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const id = Number(c.req.param("id"));
	try {
		const user = await setAdminStatus(c.env.DB, id, "active");
		if (!user) return c.json({ error: "Usuário não encontrado." }, 404);
		return c.json({ user });
	} catch (err) {
		return c.json(
			{
				error:
					err instanceof Error ? err.message : "Não foi possível desbloquear.",
			},
			400,
		);
	}
});

app.post("/api/admin/users/:id/reset-password", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	if (!isSameOrigin(c.req.raw) || !isJsonRequest(c.req.raw)) {
		return c.json({ error: "Não autorizado." }, 403);
	}
	const id = Number(c.req.param("id"));
	const body = (await c.req.json().catch(() => null)) as {
		password?: string;
	} | null;
	if (!body?.password) {
		return c.json({ error: "Informe a nova senha." }, 400);
	}
	try {
		const user = await resetAdminPassword(
			c.env.DB,
			id,
			body.password,
			c.env.AUTH_SECRET!,
		);
		if (!user) return c.json({ error: "Usuário não encontrado." }, 404);
		return c.json({ user });
	} catch (err) {
		return c.json(
			{
				error:
					err instanceof Error ? err.message : "Não foi possível resetar a senha.",
			},
			400,
		);
	}
});

app.get("/api/admin/communities", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const status = c.req.query("status") as CommunityStatus | undefined;
	const allowed: CommunityStatus[] = ["pending", "approved", "rejected"];
	const filter = status && allowed.includes(status) ? status : undefined;
	const communities = await listAdminCommunities(c.env.DB, filter);
	return c.json({ communities });
});

app.get("/api/admin/backup", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const communities = await listAdminCommunities(c.env.DB);
	const backup = buildCommunitiesBackup(communities);
	const text = serializeCommunitiesBackup(backup);
	const fileName = defaultBackupFileName();
	return c.json({
		ok: true,
		fileName,
		count: backup.communities.length,
		exported_at: backup.exported_at,
		text,
	});
});

app.post("/api/admin/backup/restore", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const body = (await c.req.json().catch(() => null)) as {
		text?: string;
		mode?: string;
	} | null;
	if (!body?.text?.trim()) {
		return c.json({ error: "Envie o arquivo de backup em texto." }, 400);
	}
	const mode = body.mode === "replace" ? "replace" : "merge";
	const parsed = parseCommunitiesBackup(body.text);
	if (!parsed.ok) {
		return c.json({ error: parsed.error }, 400);
	}

	let cleared = 0;
	if (mode === "replace") {
		cleared = await deleteAllCommunities(c.env.DB);
	}

	let created = 0;
	let updated = 0;
	const errors: string[] = [];

	for (const item of parsed.backup.communities) {
		try {
			const result = await upsertCommunityFromBackup(c.env.DB, item);
			if (result === "created") created += 1;
			else updated += 1;
		} catch (err) {
			errors.push(
				`${item.name}: ${err instanceof Error ? err.message : "falha ao restaurar"}`,
			);
		}
	}

	return c.json({
		ok: true,
		mode,
		cleared,
		created,
		updated,
		total: parsed.backup.communities.length,
		errors,
	});
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
	if (community.status === "approved") queueApprovalEmail(c, community);
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

app.post("/api/admin/communities/batch", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const body = (await c.req.json().catch(() => null)) as {
		action?: string;
		ids?: unknown;
	} | null;
	const action = body?.action;
	const ids = Array.isArray(body?.ids)
		? body.ids.filter((id): id is number => Number.isInteger(id) && id > 0)
		: [];
	const unique = [...new Set(ids)].slice(0, 200);
	if (unique.length === 0) {
		return c.json({ error: "Selecione ao menos uma comunidade." }, 400);
	}

	if (action === "approve" || action === "reject") {
		const pending =
			action === "approve"
				? (await listCommunitiesByIds(c.env.DB, unique)).filter(
						(community) => community.status !== "approved",
					)
				: [];
		const updated = await setStatusMany(
			c.env.DB,
			unique,
			action === "approve" ? "approved" : "rejected",
		);
		if (action === "approve") queueApprovalEmails(c, pending);
		return c.json({ ok: true, updated, deleted: 0 });
	}
	if (action === "delete") {
		const deleted = await deleteCommunities(c.env.DB, unique);
		return c.json({ ok: true, updated: 0, deleted });
	}
	return c.json({ error: "Ação inválida." }, 400);
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
	const existing = await getCommunity(c.env.DB, c.req.param("id"), true);
	if (!existing) return c.json({ error: "Comunidade não encontrada." }, 404);
	const community = await updateCommunity(
		c.env.DB,
		existing.id,
		input,
		coords,
	);
	if (!community) return c.json({ error: "Comunidade não encontrada." }, 404);
	if (existing.status !== "approved" && community.status === "approved") {
		queueApprovalEmail(c, community);
	}
	return c.json({ community });
});

app.post("/api/admin/communities/:id/approve", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const existing = await getCommunity(c.env.DB, c.req.param("id"), true);
	if (!existing) return c.json({ error: "Comunidade não encontrada." }, 404);
	const community = await setStatus(c.env.DB, existing.id, "approved");
	if (!community) return c.json({ error: "Comunidade não encontrada." }, 404);
	if (existing.status !== "approved") queueApprovalEmail(c, community);
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

app.get("/api/admin/corrections", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const status = c.req.query("status") as CommunityStatus | undefined;
	const allowed: CommunityStatus[] = ["pending", "approved", "rejected"];
	const filter = status && allowed.includes(status) ? status : undefined;
	const corrections = await listCorrections(c.env.DB, filter);
	return c.json({ corrections });
});

app.post("/api/admin/corrections/:id/approve", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const current = await getCorrection(c.env.DB, Number(c.req.param("id")));
	if (!current) return c.json({ error: "Correção não encontrada." }, 404);
	if (current.status !== "pending") {
		return c.json({ error: "Essa correção já foi revisada." }, 400);
	}

	const body = (await c.req.json().catch(() => null)) as CommunityInput | null;
	const input = sanitizeProposed(body ?? current.proposed);
	const valid = validateInput(input);
	if (valid) return c.json({ error: valid }, 400);
	const coords = await resolveCoordinates(input, geocodeAddress);
	if (!coords) {
		return c.json({ error: "Informe ou localise a posição no mapa." }, 400);
	}

	const existing = await getCommunity(c.env.DB, String(current.community_id), true);
	if (!existing) return c.json({ error: "Comunidade não encontrada." }, 404);

	const community = await updateCommunity(c.env.DB, existing.id, {
		...input,
		status: "approved",
		submitted_by_name: existing.submitted_by_name,
		submitted_by_email: existing.submitted_by_email,
		admin_notes: existing.admin_notes,
		coordinator_name: existing.coordinator_name,
		coordinator_phone: existing.coordinator_phone,
	}, coords);
	if (!community) return c.json({ error: "Comunidade não encontrada." }, 404);

	const correction = await setCorrectionStatus(c.env.DB, current.id, "approved");
	return c.json({ community, correction });
});

app.post("/api/admin/corrections/:id/reject", async (c) => {
	if (!(await requireAdmin(c))) return c.json({ error: "Não autorizado." }, 401);
	const current = await getCorrection(c.env.DB, Number(c.req.param("id")));
	if (!current) return c.json({ error: "Correção não encontrada." }, 404);
	if (current.status !== "pending") {
		return c.json({ error: "Essa correção já foi revisada." }, 400);
	}
	const correction = await setCorrectionStatus(c.env.DB, current.id, "rejected");
	return c.json({ correction });
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

	const correctMatch = url.pathname.match(/^\/comunidade\/([^/]+)\/corrigir\/?$/);
	if (correctMatch) {
		const community = await getCommunity(
			c.env.DB,
			decodeURIComponent(correctMatch[1]),
		);
		const rewritten = applyHtmlSeo(
			response,
			seoForPath(url.pathname, community),
		);
		return community ? rewritten : withStatus(rewritten, 404);
	}

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
