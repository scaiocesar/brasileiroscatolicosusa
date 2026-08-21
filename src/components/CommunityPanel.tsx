import { useState } from "react";
import { Link } from "react-router-dom";
import { MASS_LANGUAGES, SERVICE_TYPES, formatMassTime } from "../../shared/constants";
import type { Community } from "../../shared/types";
import {
	formatPhoneDisplay,
	groupSchedulesByDay,
	massLine,
	nextMass,
} from "../geo";
import {
	communityShareUrl,
	externalUrl,
	facebookUrl,
	instagramUrl,
	mapsDirectionsUrl,
	mapsUrl,
	whatsappGroupUrl,
	whatsappShareUrl,
	whatsappUrl,
} from "../links";

function serviceLabel(id: string): string {
	return SERVICE_TYPES.find((item) => item.id === id)?.label ?? id;
}

function languageLabel(id: string): string {
	return MASS_LANGUAGES.find((item) => item.id === id)?.label ?? id;
}

export function CommunityPanel({
	community,
	onClose,
}: {
	community: Community;
	onClose: () => void;
}) {
	const [copied, setCopied] = useState(false);
	const site = externalUrl(community.website_url);
	const whatsapp = whatsappUrl(community.whatsapp);
	const group = whatsappGroupUrl(community.whatsapp_group_url);
	const instagram = instagramUrl(community.instagram);
	const facebook = facebookUrl(community.facebook);
	const maps = mapsUrl(
		community.address_line,
		community.city,
		community.state,
		community.zip,
	);
	const directions = mapsDirectionsUrl(community.lat, community.lng);
	const shareUrl = communityShareUrl(community.slug);
	const shareText = `${community.name} — missa em português em ${community.city}, ${community.state}\n${shareUrl}`;
	const upcoming = nextMass(community.mass_schedules);
	const grouped = groupSchedulesByDay(community.mass_schedules);
	const services = community.services.filter((item) => {
		if (item.service_type === "outros") return false;
		if (item.service_type === "missa" && community.mass_schedules.length > 0) {
			return false;
		}
		return true;
	});
	const phoneLabel = formatPhoneDisplay(community.phone);

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}

	return (
		<aside className="community-panel" aria-label="Detalhes da comunidade">
			<div className="panel-handle" aria-hidden="true" />
			<div className="panel-head">
				<div>
					<p className="eyebrow">
						{community.city}, {community.state}
					</p>
					<h1>{community.name}</h1>
				</div>
				<button type="button" className="panel-close" onClick={onClose}>
					Fechar
				</button>
			</div>
			{community.description ? <p>{community.description}</p> : null}

			{upcoming ? (
				<div className="next-mass">
					<p className="eyebrow">
						{upcoming.language === "pt"
							? "Próxima missa em português"
							: "Próxima missa"}
					</p>
					<strong>{massLine(upcoming)}</strong>
					<span>{languageLabel(upcoming.language)}</span>
					{upcoming.notes ? <em>{upcoming.notes}</em> : null}
				</div>
			) : null}

			<a
				className="button-link maps-cta"
				href={directions}
				target="_blank"
				rel="noreferrer"
			>
				Como chegar
			</a>

			<section>
				<h3>Endereço</h3>
				<p>
					{community.address_line}
					<br />
					{community.city}, {community.state} {community.zip ?? ""}
				</p>
				<a href={maps} target="_blank" rel="noreferrer">
					Abrir no Google Maps
				</a>
			</section>

			{grouped.length > 0 ? (
				<section>
					<h3>Horários de missa</h3>
					<ul className="schedule-list">
						{grouped.map(({ day, items }) =>
							items.map((item) => (
								<li key={`${day.id}-${item.time}-${item.language}-${item.notes ?? ""}`}>
									<strong>
										{day.label} · {formatMassTime(item.time)}
									</strong>
									<span>{languageLabel(item.language)}</span>
									{item.notes ? <em>{item.notes}</em> : null}
								</li>
							)),
						)}
					</ul>
				</section>
			) : null}

			{services.length > 0 ? (
				<section>
					<h3>Serviços</h3>
					<ul className="chip-list">
						{services.map((item) => (
							<li key={item.service_type}>
								{serviceLabel(item.service_type)}
								{item.notes ? ` — ${item.notes}` : ""}
							</li>
						))}
					</ul>
				</section>
			) : null}

			<section className="contact-links">
				<h3>Contato</h3>
				{site ? (
					<a href={site} target="_blank" rel="noreferrer">
						Site da comunidade
					</a>
				) : null}
				{whatsapp ? (
					<a href={whatsapp} target="_blank" rel="noreferrer">
						WhatsApp
					</a>
				) : null}
				{group ? (
					<a href={group} target="_blank" rel="noreferrer">
						Entrar no grupo
					</a>
				) : null}
				{instagram ? (
					<a href={instagram} target="_blank" rel="noreferrer">
						Instagram
					</a>
				) : null}
				{facebook ? (
					<a href={facebook} target="_blank" rel="noreferrer">
						Facebook
					</a>
				) : null}
				{community.email ? (
					<a href={`mailto:${community.email}`}>{community.email}</a>
				) : null}
				{community.phone ? (
					<a href={`tel:${community.phone}`}>{phoneLabel || community.phone}</a>
				) : null}
			</section>

			<section className="share-actions">
				<h3>Compartilhar</h3>
				<div className="share-row">
					<a
						className="button-link"
						href={whatsappShareUrl(shareText)}
						target="_blank"
						rel="noreferrer"
					>
						Enviar no WhatsApp
					</a>
					<button type="button" className="secondary" onClick={copyLink}>
						{copied ? "Link copiado" : "Copiar link"}
					</button>
				</div>
			</section>

			<p className="panel-correct">
				<Link to={`/comunidade/${community.slug}/corrigir`}>
					Corrigir informações
				</Link>
			</p>
		</aside>
	);
}
