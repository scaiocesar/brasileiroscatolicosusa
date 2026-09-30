import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
	MASS_LANGUAGES,
	SERVICE_TYPES,
	formatMassTime,
} from "../../shared/constants";
import type { Community, CommunityCorrection } from "../../shared/types";
import { formatPhoneDisplay, groupSchedulesByDay } from "../geo";
import { whatsappUrl } from "../links";
import { WhatsAppIcon } from "./WhatsAppIcon";

function statusLabel(status: Community["status"]): string {
	if (status === "pending") return "Pendente";
	if (status === "approved") return "Aprovada";
	return "Rejeitada";
}

function serviceLabel(id: string): string {
	return SERVICE_TYPES.find((item) => item.id === id)?.label ?? id;
}

function languageLabel(id: string): string {
	return MASS_LANGUAGES.find((item) => item.id === id)?.label ?? id;
}

function formatDate(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value.includes("T") ? value : `${value}Z`);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("pt-BR");
}

function Field({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	if (children == null || children === "") return null;
	return (
		<div className="admin-field">
			<span className="admin-field-label">{label}</span>
			<div className="admin-field-value">{children}</div>
		</div>
	);
}

export function AdminCommunityDetail({
	community,
	correction,
	busy,
	onApprove,
	onReject,
	onEdit,
	onDelete,
	onApplyCorrection,
	onReviewCorrection,
	onRejectCorrection,
}: {
	community: Community;
	correction?: CommunityCorrection | null;
	busy?: boolean;
	onApprove: () => void;
	onReject: () => void;
	onEdit: () => void;
	onDelete: () => void;
	onApplyCorrection?: () => void;
	onReviewCorrection?: () => void;
	onRejectCorrection?: () => void;
}) {
	const schedules = groupSchedulesByDay(community.mass_schedules);
	const phone = formatPhoneDisplay(community.phone);
	const coordinatorPhone = formatPhoneDisplay(community.coordinator_phone);
	const coordinatorWhatsapp = whatsappUrl(community.coordinator_phone);
	const address = [
		community.address_line,
		[community.city, community.state].filter(Boolean).join(", "),
		community.zip,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<article className="admin-detail">
			<header className="admin-detail-head">
				<div>
					<p className="eyebrow">
						{community.city}, {community.state}
					</p>
					<h2>{community.name}</h2>
					<p className="admin-detail-meta">
						<span
							className={`admin-status is-${community.status === "approved" ? "active" : community.status === "rejected" ? "blocked" : "pending"}`}
						>
							{statusLabel(community.status)}
						</span>
						<span className="admin-slug">/{community.slug}</span>
					</p>
				</div>
				<div className="admin-detail-actions">
					{community.status !== "approved" ? (
						<button type="button" disabled={busy} onClick={onApprove}>
							Aprovar
						</button>
					) : null}
					{community.status !== "rejected" ? (
						<button
							type="button"
							className="secondary"
							disabled={busy}
							onClick={onReject}
						>
							Rejeitar
						</button>
					) : null}
					<button
						type="button"
						className="secondary"
						disabled={busy}
						onClick={onEdit}
					>
						Editar
					</button>
					<button
						type="button"
						className="ghost"
						disabled={busy}
						onClick={onDelete}
					>
						Excluir
					</button>
					<Link
						className="ghost-link"
						to={`/comunidade/${community.slug}`}
						target="_blank"
						rel="noreferrer"
					>
						Ver no mapa
					</Link>
				</div>
			</header>

			{correction ? (
				<section className="admin-correction-banner">
					<div>
						<strong>Correção pendente</strong>
						<p>
							Enviado por {correction.submitted_by_name} (
							{correction.submitted_by_email})
						</p>
						{correction.note ? <p className="hint">{correction.note}</p> : null}
					</div>
					<div className="row-actions">
						<button
							type="button"
							disabled={busy}
							onClick={onApplyCorrection}
						>
							Aplicar
						</button>
						<button
							type="button"
							className="secondary"
							disabled={busy}
							onClick={onReviewCorrection}
						>
							Revisar proposta
						</button>
						<button
							type="button"
							className="ghost"
							disabled={busy}
							onClick={onRejectCorrection}
						>
							Rejeitar
						</button>
					</div>
				</section>
			) : null}

			<div className="admin-detail-grid">
				<section>
					<h3>Local</h3>
					<Field label="Endereço">{address}</Field>
					<Field label="Coordenadas">
						{community.lat && community.lng
							? `${community.lat.toFixed(5)}, ${community.lng.toFixed(5)}`
							: null}
					</Field>
					{community.description ? (
						<Field label="Descrição">{community.description}</Field>
					) : null}
				</section>

				<section>
					<h3>Contato</h3>
					<Field label="E-mail">
						{community.email ? (
							<a href={`mailto:${community.email}`}>{community.email}</a>
						) : null}
					</Field>
					<Field label="Telefone">{phone || null}</Field>
					<Field label="WhatsApp">{community.whatsapp}</Field>
					<Field label="Grupo WhatsApp">
						{community.whatsapp_group_url ? (
							<a
								href={community.whatsapp_group_url}
								target="_blank"
								rel="noreferrer"
							>
								Abrir grupo
							</a>
						) : null}
					</Field>
					<Field label="Site">
						{community.website_url ? (
							<a
								href={community.website_url}
								target="_blank"
								rel="noreferrer"
							>
								{community.website_url}
							</a>
						) : null}
					</Field>
					<Field label="Instagram">{community.instagram}</Field>
					<Field label="Facebook">{community.facebook}</Field>
				</section>

				<section>
					<h3>Missas</h3>
					{schedules.length === 0 ? (
						<p className="admin-empty-block">Nenhuma missa cadastrada.</p>
					) : (
						<ul className="admin-schedule-list">
							{schedules.map(({ day, items }) => (
								<li key={day.id}>
									<strong>{day.label}</strong>
									<ul>
										{items.map((item, index) => (
											<li key={`${day.id}-${item.time}-${index}`}>
												{formatMassTime(item.time)} ·{" "}
												{languageLabel(item.language)}
												{item.notes ? ` — ${item.notes}` : ""}
											</li>
										))}
									</ul>
								</li>
							))}
						</ul>
					)}
				</section>

				<section>
					<h3>Serviços</h3>
					{community.services.length === 0 ? (
						<p className="admin-empty-block">Nenhum serviço cadastrado.</p>
					) : (
						<ul className="admin-chip-list">
							{community.services.map((item) => (
								<li key={item.service_type}>
									{serviceLabel(item.service_type)}
									{item.notes ? ` — ${item.notes}` : ""}
								</li>
							))}
						</ul>
					)}
				</section>

				<section className="admin-detail-span">
					<h3>Coordenador (privado)</h3>
					{community.coordinator_name || community.coordinator_phone ? (
						<div className="admin-coordinator">
							<div>
								{community.coordinator_name ? (
									<strong>{community.coordinator_name}</strong>
								) : (
									<span className="admin-empty-block">Sem nome</span>
								)}
								{coordinatorPhone ? (
									<p className="admin-coordinator-phone">{coordinatorPhone}</p>
								) : null}
							</div>
							{coordinatorWhatsapp ? (
								<a
									className="admin-whatsapp-btn is-solid"
									href={coordinatorWhatsapp}
									target="_blank"
									rel="noreferrer"
									title={`WhatsApp${community.coordinator_name ? ` — ${community.coordinator_name}` : ""}`}
									aria-label="Enviar mensagem no WhatsApp para o coordenador"
								>
									<WhatsAppIcon />
									<span>WhatsApp</span>
								</a>
							) : (
								<p className="admin-empty-block">
									Salve um telefone para habilitar o atalho do WhatsApp.
								</p>
							)}
						</div>
					) : (
						<p className="admin-empty-block">
							Nenhum contato de coordenador cadastrado. Edite para adicionar.
						</p>
					)}
				</section>

				<section className="admin-detail-span">
					<h3>Envio e moderação</h3>
					<div className="admin-detail-grid tight">
						<Field label="Enviado por">
							{community.submitted_by_name || community.submitted_by_email
								? `${community.submitted_by_name ?? "—"}${
										community.submitted_by_email
											? ` (${community.submitted_by_email})`
											: ""
									}`
								: "—"}
						</Field>
						<Field label="Criado em">{formatDate(community.created_at)}</Field>
						<Field label="Atualizado em">
							{formatDate(community.updated_at)}
						</Field>
						<Field label="Aprovado em">
							{formatDate(community.approved_at)}
						</Field>
						{community.admin_notes ? (
							<Field label="Notas do admin">{community.admin_notes}</Field>
						) : null}
					</div>
				</section>
			</div>
		</article>
	);
}
