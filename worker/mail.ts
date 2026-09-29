import type { Context } from "hono";
import {
	canonicalUrl,
	SITE_EMAIL,
	SITE_NAME,
	SITE_ORIGIN,
} from "../shared/seo";
import type { Community } from "../shared/types";

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function recipientOf(community: Community): string | null {
	const submitted = community.submitted_by_email?.trim();
	if (submitted) return submitted;
	const contact = community.email?.trim();
	return contact || null;
}

export async function sendCommunityApprovedEmail(
	env: Env,
	community: Community,
): Promise<void> {
	const to = recipientOf(community);
	if (!to) return;

	const page = canonicalUrl(`/comunidade/${community.slug}`);
	const greeting = community.submitted_by_name?.trim()
		? `Olá, ${community.submitted_by_name.trim()}`
		: "Olá";
	const place = `${community.city}, ${community.state}`;
	const text = `${greeting},

A comunidade ${community.name} (${place}) foi aprovada e já aparece no mapa de brasileiros católicos nos EUA.

Veja a página: ${page}

Se algo estiver desatualizado, use o link “Corrigir informações” na própria página.

${SITE_NAME}
${SITE_ORIGIN}
`;
	const html = `<p>${escapeHtml(greeting)},</p>
<p>A comunidade <strong>${escapeHtml(community.name)}</strong> (${escapeHtml(place)}) foi aprovada e já aparece no mapa de brasileiros católicos nos EUA.</p>
<p><a href="${escapeHtml(page)}">Ver a comunidade no mapa</a></p>
<p>Se algo estiver desatualizado, use o link “Corrigir informações” na própria página.</p>
<p>${escapeHtml(SITE_NAME)}<br>${escapeHtml(SITE_ORIGIN)}</p>`;

	try {
		await env.EMAIL.send({
			to,
			from: { email: SITE_EMAIL, name: SITE_NAME },
			replyTo: SITE_EMAIL,
			subject: `${community.name} foi aprovada no mapa`,
			text,
			html,
		});
	} catch (error) {
		console.error("Falha ao enviar e-mail de aprovação", {
			slug: community.slug,
			to,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export function queueApprovalEmail(
	c: Context<{ Bindings: Env }>,
	community: Community | null | undefined,
): void {
	if (!community) return;
	c.executionCtx.waitUntil(sendCommunityApprovedEmail(c.env, community));
}

export function queueApprovalEmails(
	c: Context<{ Bindings: Env }>,
	communities: Community[],
): void {
	if (communities.length === 0) return;
	c.executionCtx.waitUntil(
		Promise.all(communities.map((community) => sendCommunityApprovedEmail(c.env, community))),
	);
}
