import { Link } from "react-router-dom";
import {
	MASS_LANGUAGES,
	SERVICE_TYPES,
	WEEKDAYS,
	formatMassTime,
} from "../../shared/constants";
import type { Community } from "../../shared/types";
import {
	externalUrl,
	facebookUrl,
	instagramUrl,
	mapsUrl,
	whatsappUrl,
} from "../links";

function serviceLabel(id: string): string {
	return SERVICE_TYPES.find((item) => item.id === id)?.label ?? id;
}

function weekdayLabel(id: number): string {
	return WEEKDAYS.find((item) => item.id === id)?.label ?? String(id);
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
	const site = externalUrl(community.website_url);
	const whatsapp = whatsappUrl(community.whatsapp);
	const instagram = instagramUrl(community.instagram);
	const facebook = facebookUrl(community.facebook);
	const maps = mapsUrl(
		community.address_line,
		community.city,
		community.state,
	);

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

			{community.mass_schedules.length > 0 ? (
				<section>
					<h3>Horários de missa</h3>
					<ul className="schedule-list">
						{community.mass_schedules.map((item) => (
							<li key={`${item.day_of_week}-${item.time}-${item.language}`}>
								<strong>
									{weekdayLabel(item.day_of_week)} · {formatMassTime(item.time)}
								</strong>
								<span>{languageLabel(item.language)}</span>
								{item.notes ? <em>{item.notes}</em> : null}
							</li>
						))}
					</ul>
				</section>
			) : null}

			{community.services.length > 0 ? (
				<section>
					<h3>Serviços</h3>
					<ul className="chip-list">
						{community.services.map((item) => (
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
					<a href={`tel:${community.phone}`}>{community.phone}</a>
				) : null}
			</section>
			<p className="panel-correct">
				<Link to={`/comunidade/${community.slug}/corrigir`}>
					Corrigir informações
				</Link>
			</p>
		</aside>
	);
}
