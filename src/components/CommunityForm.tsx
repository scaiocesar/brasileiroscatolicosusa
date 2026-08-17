import { useState, type FormEvent } from "react";
import {
	MASS_LANGUAGES,
	SERVICE_TYPES,
	US_CENTER,
	US_STATES,
	WEEKDAYS,
} from "../../shared/constants";
import type {
	Community,
	CommunityInput,
	CommunityStatus,
	MassLanguage,
} from "../../shared/types";
import { geocodeAddress } from "../api";
import { PinPickerMap } from "./PinPickerMap";
import { TurnstileWidget } from "./TurnstileWidget";

function communityToInput(community?: Community): CommunityInput {
	if (!community) {
		return {
			name: "",
			description: "",
			address_line: "",
			city: "",
			state: "",
			zip: "",
			lat: US_CENTER[0],
			lng: US_CENTER[1],
			website_url: "",
			whatsapp: "",
			whatsapp_group_url: "",
			instagram: "",
			facebook: "",
			email: "",
			phone: "",
			submitted_by_name: "",
			submitted_by_email: "",
			admin_notes: "",
			status: "pending",
			mass_schedules: [],
			services: [{ service_type: "missa" }],
		};
	}

	return {
		name: community.name,
		description: community.description ?? "",
		address_line: community.address_line,
		city: community.city,
		state: community.state,
		zip: community.zip ?? "",
		lat: community.lat,
		lng: community.lng,
		website_url: community.website_url ?? "",
		whatsapp: community.whatsapp ?? "",
		whatsapp_group_url: community.whatsapp_group_url ?? "",
		instagram: community.instagram ?? "",
		facebook: community.facebook ?? "",
		email: community.email ?? "",
		phone: community.phone ?? "",
		submitted_by_name: community.submitted_by_name ?? "",
		submitted_by_email: community.submitted_by_email ?? "",
		admin_notes: community.admin_notes ?? "",
		status: community.status,
		mass_schedules: community.mass_schedules,
		services:
			community.services.length > 0
				? community.services
				: [{ service_type: "missa" }],
	};
}

export function CommunityForm({
	initial,
	mode,
	turnstileSiteKey,
	busy,
	error,
	onSubmit,
}: {
	initial?: Community;
	mode: "public" | "admin" | "correction";
	turnstileSiteKey?: string;
	busy?: boolean;
	error?: string | null;
	onSubmit: (input: CommunityInput) => Promise<void> | void;
}) {
	const [form, setForm] = useState<CommunityInput>(() => {
		const initialForm = communityToInput(initial);
		if (mode === "correction") {
			return {
				...initialForm,
				submitted_by_name: "",
				submitted_by_email: "",
				admin_notes: "",
				correction_note: "",
			};
		}
		return initialForm;
	});
	const [token, setToken] = useState("");
	const [locateError, setLocateError] = useState<string | null>(null);
	const [locating, setLocating] = useState(false);
	const [focusToken, setFocusToken] = useState(0);

	function update<K extends keyof CommunityInput>(
		key: K,
		value: CommunityInput[K],
	) {
		setForm((current) => ({ ...current, [key]: value }));
	}

	async function locate() {
		setLocateError(null);
		setLocating(true);
		try {
			const found = await geocodeAddress({
				address_line: form.address_line,
				city: form.city,
				state: form.state,
				zip: form.zip ?? undefined,
			});
			update("lat", found.lat);
			update("lng", found.lng);
			setFocusToken((value) => value + 1);
		} catch (err) {
			setLocateError(
				err instanceof Error
					? err.message
					: "Não foi possível localizar. Ajuste o pin.",
			);
		} finally {
			setLocating(false);
		}
	}

	function setService(id: string, checked: boolean) {
		setForm((current) => {
			const exists = current.services.some((item) => item.service_type === id);
			if (checked === exists) return current;
			return {
				...current,
				services: checked
					? [...current.services, { service_type: id, notes: "" }]
					: current.services.filter((item) => item.service_type !== id),
			};
		});
	}

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		await onSubmit({
			...form,
			turnstile_token: token,
		});
	}

	return (
		<form
			className="community-form"
			onSubmit={handleSubmit}
			toolname={
				mode === "public"
					? "submit_community"
					: mode === "correction"
						? "submit_correction"
						: undefined
			}
			tooltitle={
				mode === "public"
					? "Informar comunidade"
					: mode === "correction"
						? "Corrigir comunidade"
						: undefined
			}
			tooldescription={
				mode === "public"
					? "Preenche o pré-cadastro de uma comunidade católica brasileira nos EUA. O envio exige clique humano por causa da verificação anti-spam."
					: mode === "correction"
						? "Preenche a sugestão de correção desta comunidade. O envio exige clique humano por causa da verificação anti-spam."
						: undefined
			}
		>
			{error ? <p className="form-error">{error}</p> : null}

			<label>
				Nome da comunidade
				<input
					required
					name="name"
					toolparamdescription="Nome oficial da comunidade, paróquia ou apostolado"
					value={form.name}
					onChange={(event) => update("name", event.target.value)}
				/>
			</label>

			<label>
				Descrição
				<textarea
					name="description"
					rows={3}
					toolparamdescription="Resumo da comunidade, missas ou público atendido"
					value={form.description ?? ""}
					onChange={(event) => update("description", event.target.value)}
				/>
			</label>

			<div className="grid-2">
				<label>
					Endereço
					<input
						required
						name="address_line"
						toolparamdescription="Rua e número nos Estados Unidos"
						value={form.address_line}
						onChange={(event) => update("address_line", event.target.value)}
					/>
				</label>
				<label>
					Cidade
					<input
						required
						name="city"
						value={form.city}
						onChange={(event) => update("city", event.target.value)}
					/>
				</label>
			</div>

			<div className="grid-2">
				<label>
					Estado
					<select
						required
						name="state"
						toolparamdescription="Sigla do estado dos EUA, por exemplo FL, MA ou TX"
						value={form.state}
						onChange={(event) => update("state", event.target.value)}
					>
						<option value="">Selecione</option>
						{US_STATES.map((state) => (
							<option key={state.code} value={state.code}>
								{state.name}
							</option>
						))}
					</select>
				</label>
				<label>
					CEP
					<input
						name="zip"
						toolparamdescription="CEP americano (ZIP code)"
						value={form.zip ?? ""}
						onChange={(event) => update("zip", event.target.value)}
					/>
				</label>
			</div>

			<div className="locate-row">
				<button type="button" className="secondary" onClick={locate} disabled={locating}>
					{locating ? "Localizando..." : "Localizar no mapa"}
				</button>
				{locateError ? <span className="form-error">{locateError}</span> : null}
			</div>

			<PinPickerMap
				lat={form.lat}
				lng={form.lng}
				focusToken={focusToken}
				onChange={(lat, lng) => {
					update("lat", lat);
					update("lng", lng);
				}}
			/>

			<div className="grid-2">
				<label>
					Site
					<input
						name="website_url"
						value={form.website_url ?? ""}
						onChange={(event) => update("website_url", event.target.value)}
						placeholder="https://"
					/>
				</label>
				<label>
					WhatsApp
					<input
						name="whatsapp"
						toolparamdescription="Número de WhatsApp com código do país, só dígitos"
						value={form.whatsapp ?? ""}
						onChange={(event) => update("whatsapp", event.target.value)}
						placeholder="15551234567"
					/>
				</label>
			</div>

			<label>
				Grupo de WhatsApp
				<input
					name="whatsapp_group_url"
					toolparamdescription="Link do grupo de WhatsApp da comunidade, se houver"
					value={form.whatsapp_group_url ?? ""}
					onChange={(event) => update("whatsapp_group_url", event.target.value)}
					placeholder="https://chat.whatsapp.com/..."
				/>
			</label>

			<div className="grid-2">
				<label>
					Instagram
					<input
						name="instagram"
						value={form.instagram ?? ""}
						onChange={(event) => update("instagram", event.target.value)}
					/>
				</label>
				<label>
					Facebook
					<input
						name="facebook"
						value={form.facebook ?? ""}
						onChange={(event) => update("facebook", event.target.value)}
					/>
				</label>
			</div>

			<div className="grid-2">
				<label>
					E-mail da comunidade
					<input
						type="email"
						name="email"
						value={form.email ?? ""}
						onChange={(event) => update("email", event.target.value)}
					/>
				</label>
				<label>
					Telefone
					<input
						name="phone"
						value={form.phone ?? ""}
						onChange={(event) => update("phone", event.target.value)}
					/>
				</label>
			</div>

			<fieldset>
				<legend>Horários de missa</legend>
				{form.mass_schedules.map((schedule, index) => (
					<div className="schedule-row" key={`${schedule.day_of_week}-${index}`}>
						<select
							name={`mass_day_${index}`}
							toolparamdescription={`Dia da semana do horário ${index + 1} (0=domingo, 6=sábado)`}
							value={schedule.day_of_week}
							onChange={(event) => {
								const next = [...form.mass_schedules];
								next[index] = {
									...schedule,
									day_of_week: Number(event.target.value),
								};
								update("mass_schedules", next);
							}}
						>
							{WEEKDAYS.map((day) => (
								<option key={day.id} value={day.id}>
									{day.label}
								</option>
							))}
						</select>
						<input
							type="time"
							name={`mass_time_${index}`}
							toolparamdescription={`Horário ${index + 1} no formato HH:MM`}
							value={schedule.time}
							onChange={(event) => {
								const next = [...form.mass_schedules];
								next[index] = { ...schedule, time: event.target.value };
								update("mass_schedules", next);
							}}
						/>
						<select
							name={`mass_language_${index}`}
							toolparamdescription={`Idioma do horário ${index + 1}: pt, en ou bilingual`}
							value={schedule.language}
							onChange={(event) => {
								const next = [...form.mass_schedules];
								next[index] = {
									...schedule,
									language: event.target.value as MassLanguage,
								};
								update("mass_schedules", next);
							}}
						>
							{MASS_LANGUAGES.map((language) => (
								<option key={language.id} value={language.id}>
									{language.label}
								</option>
							))}
						</select>
						<input
							name={`mass_notes_${index}`}
							placeholder="Observação"
							value={schedule.notes ?? ""}
							onChange={(event) => {
								const next = [...form.mass_schedules];
								next[index] = { ...schedule, notes: event.target.value };
								update("mass_schedules", next);
							}}
						/>
						<button
							type="button"
							className="ghost"
							onClick={() =>
								update(
									"mass_schedules",
									form.mass_schedules.filter((_, i) => i !== index),
								)
							}
						>
							Remover
						</button>
					</div>
				))}
				<button
					type="button"
					className="secondary"
					onClick={() =>
						update("mass_schedules", [
							...form.mass_schedules,
							{ day_of_week: 0, time: "11:00", language: "pt", notes: "" },
						])
					}
				>
					Adicionar horário
				</button>
			</fieldset>

			<fieldset>
				<legend>Serviços</legend>
				<div className="checkbox-grid">
					{SERVICE_TYPES.map((service) => (
						<label key={service.id} className="check">
							<input
								type="checkbox"
								name={`service_${service.id}`}
								checked={form.services.some(
									(item) => item.service_type === service.id,
								)}
								onChange={(event) =>
									setService(service.id, event.target.checked)
								}
							/>
							{service.label}
						</label>
					))}
				</div>
			</fieldset>

			{mode === "public" || mode === "correction" ? (
				<div className="grid-2">
					<label>
						Seu nome
						<input
							required
							name="submitted_by_name"
							toolparamdescription="Nome de quem está enviando o formulário"
							value={form.submitted_by_name ?? ""}
							onChange={(event) =>
								update("submitted_by_name", event.target.value)
							}
						/>
					</label>
					<label>
						Seu e-mail
						<input
							required
							type="email"
							name="submitted_by_email"
							toolparamdescription="E-mail de quem está enviando o formulário"
							value={form.submitted_by_email ?? ""}
							onChange={(event) =>
								update("submitted_by_email", event.target.value)
							}
						/>
					</label>
				</div>
			) : (
				<>
					<label>
						Status
						<select
							value={form.status ?? "pending"}
							onChange={(event) =>
								update("status", event.target.value as CommunityStatus)
							}
						>
							<option value="pending">Pendente</option>
							<option value="approved">Aprovada</option>
							<option value="rejected">Rejeitada</option>
						</select>
					</label>
					<label>
						Notas internas
						<textarea
							rows={2}
							value={form.admin_notes ?? ""}
							onChange={(event) => update("admin_notes", event.target.value)}
						/>
					</label>
				</>
			)}

			{mode === "correction" ? (
				<label>
					O que precisa ser corrigido?
					<textarea
						name="correction_note"
						rows={3}
						toolparamdescription="O que está errado e qual deve ser o dado correto"
						placeholder="Ex.: o horário da missa mudou, o endereço está incompleto..."
						value={form.correction_note ?? ""}
						onChange={(event) =>
							update("correction_note", event.target.value)
						}
					/>
				</label>
			) : null}

			{mode === "public" || mode === "correction" ? (
				<TurnstileWidget
					siteKey={turnstileSiteKey ?? ""}
					onToken={setToken}
				/>
			) : null}

			<button type="submit" disabled={busy}>
				{busy
					? "Enviando..."
					: mode === "correction"
						? "Enviar correção"
						: mode === "public"
							? "Enviar para aprovação"
							: "Salvar comunidade"}
			</button>
		</form>
	);
}
