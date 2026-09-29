import { useEffect, useMemo, useState, type FormEvent } from "react";
import { adminSeo } from "../../shared/seo";
import type { Community, CommunityCorrection, CommunityInput, CommunityStatus } from "../../shared/types";
import { usePageSeo } from "../usePageSeo";
import {
	adminApproveCorrection,
	adminBatchCommunities,
	adminDelete,
	adminImportCsv,
	adminList,
	adminListCorrections,
	adminLogin,
	adminLogout,
	adminMe,
	adminRejectCorrection,
	adminSave,
	adminSetStatus,
	fetchConfig,
} from "../api";
import { CommunityForm } from "../components/CommunityForm";
import { AdminNav } from "../components/AdminNav";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { TurnstileWidget } from "../components/TurnstileWidget";
import {
	defaultCommunitiesExportFileName,
	downloadCommunitiesExcel,
} from "../../shared/exportExcel";

const FILTERS: Array<{ id: "" | CommunityStatus; label: string }> = [
	{ id: "", label: "Todas" },
	{ id: "pending", label: "Pendentes" },
	{ id: "approved", label: "Aprovadas" },
	{ id: "rejected", label: "Rejeitadas" },
];

function statusLabel(status: CommunityStatus): string {
	if (status === "pending") return "Pendente";
	if (status === "approved") return "Aprovada";
	return "Rejeitada";
}

function proposedCommunity(correction: CommunityCorrection): Community {
	const proposed = correction.proposed;
	return {
		id: correction.community_id,
		slug: correction.community_slug,
		name: proposed.name,
		description: proposed.description ?? null,
		address_line: proposed.address_line,
		city: proposed.city,
		state: proposed.state,
		zip: proposed.zip ?? null,
		lat: proposed.lat ?? 0,
		lng: proposed.lng ?? 0,
		website_url: proposed.website_url ?? null,
		whatsapp: proposed.whatsapp ?? null,
		whatsapp_group_url: proposed.whatsapp_group_url ?? null,
		instagram: proposed.instagram ?? null,
		facebook: proposed.facebook ?? null,
		email: proposed.email ?? null,
		phone: proposed.phone ?? null,
		status: "approved",
		submitted_by_name: correction.submitted_by_name,
		submitted_by_email: correction.submitted_by_email,
		admin_notes: correction.note,
		created_at: correction.created_at,
		updated_at: correction.created_at,
		approved_at: null,
		mass_schedules: proposed.mass_schedules,
		services: proposed.services,
	};
}

export function AdminPage() {
	usePageSeo(useMemo(() => adminSeo(), []));
	const [authed, setAuthed] = useState<boolean | null>(null);
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [turnstileToken, setTurnstileToken] = useState("");
	const [siteKey, setSiteKey] = useState("");
	const [loginError, setLoginError] = useState<string | null>(null);
	const [communities, setCommunities] = useState<Community[]>([]);
	const [filter, setFilter] = useState<"" | CommunityStatus>("pending");
	const [editing, setEditing] = useState<Community | "new" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [importing, setImporting] = useState(false);
	const [importResult, setImportResult] = useState<string | null>(null);
	const [corrections, setCorrections] = useState<CommunityCorrection[]>([]);
	const [reviewing, setReviewing] = useState<CommunityCorrection | null>(null);
	const [selected, setSelected] = useState<number[]>([]);
	const [batchBusy, setBatchBusy] = useState(false);
	const [exporting, setExporting] = useState(false);

	async function load(nextFilter = filter) {
		const [list, pendingCorrections] = await Promise.all([
			adminList(nextFilter || undefined),
			adminListCorrections("pending"),
		]);
		setCommunities(list);
		setCorrections(pendingCorrections);
	}

	useEffect(() => {
		fetchConfig().then((config) => setSiteKey(config.turnstileSiteKey));
		adminMe()
			.then(async (me) => {
				setAuthed(me.authenticated);
				if (me.authenticated) await load();
			})
			.catch((err: unknown) => setError(String(err)));
	}, []);

	async function handleLogin(event: FormEvent) {
		event.preventDefault();
		setLoginError(null);
		try {
			await adminLogin(username, password, turnstileToken);
			setPassword("");
			setAuthed(true);
			await load();
		} catch (err) {
			setLoginError(err instanceof Error ? err.message : "Falha no login.");
		}
	}

	async function handleSave(input: CommunityInput) {
		setBusy(true);
		setError(null);
		try {
			if (reviewing) {
				await adminApproveCorrection(reviewing.id, input);
				setReviewing(null);
			} else {
				await adminSave(
					input,
					editing && editing !== "new" ? editing.id : undefined,
				);
				setEditing(null);
			}
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Não foi possível salvar.");
		} finally {
			setBusy(false);
		}
	}

	async function handleImport(file: File) {
		setImporting(true);
		setError(null);
		setImportResult(null);
		try {
			const csv = await file.text();
			const result = await adminImportCsv(csv);
			setFilter("pending");
			await load("pending");
			const extra = result.errors.length
				? ` ${result.errors.slice(0, 8).join(" ")}`
				: "";
			setImportResult(
				`${result.imported} importada(s) como pendente. ${result.skipped} ignorada(s).${extra}`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Não foi possível importar.");
		} finally {
			setImporting(false);
		}
	}

	function toggleSelected(id: number) {
		setSelected((current) =>
			current.includes(id)
				? current.filter((item) => item !== id)
				: [...current, id],
		);
	}

	const allVisibleSelected =
		communities.length > 0 &&
		communities.every((community) => selected.includes(community.id));

	function toggleSelectAll() {
		if (allVisibleSelected) {
			const visible = new Set(communities.map((community) => community.id));
			setSelected((current) => current.filter((id) => !visible.has(id)));
			return;
		}
		setSelected((current) => [
			...new Set([...current, ...communities.map((community) => community.id)]),
		]);
	}

	async function runBatch(action: "approve" | "reject" | "delete") {
		if (selected.length === 0) return;
		if (
			action === "delete" &&
			!confirm(`Excluir ${selected.length} comunidade(s)? Isso não pode ser desfeito.`)
		) {
			return;
		}
		setBatchBusy(true);
		setError(null);
		setImportResult(null);
		try {
			const result = await adminBatchCommunities(action, selected);
			setSelected([]);
			await load();
			if (action === "delete") {
				setImportResult(`${result.deleted} comunidade(s) excluída(s).`);
			} else {
				setImportResult(
					`${result.updated} comunidade(s) ${action === "approve" ? "aprovada(s)" : "rejeitada(s)"}.`,
				);
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Não foi possível atualizar em lote.",
			);
		} finally {
			setBatchBusy(false);
		}
	}

	if (authed === null) {
		return (
			<div className="app-shell page-shell">
				<Header />
				<main className="page-main">
					<p>Carregando...</p>
				</main>
				<Footer />
			</div>
		);
	}

	if (!authed) {
		return (
			<div className="app-shell page-shell">
				<Header />
				<main className="page-main narrow">
					<p className="eyebrow">Painel</p>
					<h1>Entrar no admin</h1>
					<form className="community-form" onSubmit={handleLogin}>
						{loginError ? <p className="form-error">{loginError}</p> : null}
						<label>
							Usuário
							<input
								autoComplete="username"
								value={username}
								onChange={(event) => setUsername(event.target.value)}
								required
							/>
						</label>
						<label>
							Senha
							<input
								type="password"
								autoComplete="current-password"
								value={password}
								onChange={(event) => setPassword(event.target.value)}
								required
							/>
						</label>
						<TurnstileWidget siteKey={siteKey} onToken={setTurnstileToken} />
						<button type="submit">Entrar</button>
					</form>
				</main>
				<Footer />
			</div>
		);
	}

	return (
		<div className="app-shell page-shell">
			<Header />
			<main className="page-main wide">
				<div className="admin-head">
					<div>
						<p className="eyebrow">Painel</p>
						<h1>Gerenciar comunidades</h1>
					</div>
					<div className="admin-actions">
						<button
							type="button"
							className="secondary"
							disabled={exporting || communities.length === 0}
							onClick={async () => {
								setExporting(true);
								setError(null);
								try {
									await downloadCommunitiesExcel(communities, {
										fileName: defaultCommunitiesExportFileName(filter),
									});
								} catch (err) {
									setError(
										err instanceof Error
											? err.message
											: "Não foi possível exportar o Excel.",
									);
								} finally {
									setExporting(false);
								}
							}}
						>
							{exporting ? "Exportando..." : "Exportar Excel"}
						</button>
						<label className="file-button">
							<input
								type="file"
								accept=".csv,text/csv"
								disabled={importing}
								onChange={async (event) => {
									const file = event.target.files?.[0];
									event.target.value = "";
									if (file) await handleImport(file);
								}}
							/>
							{importing ? "Importando..." : "Importar CSV"}
						</label>
						<button type="button" className="secondary" onClick={() => {
							setReviewing(null);
							setEditing("new");
						}}>
							Nova comunidade
						</button>
						<button
							type="button"
							className="ghost"
							onClick={async () => {
								await adminLogout();
								setAuthed(false);
							}}
						>
							Sair
						</button>
					</div>
				</div>

				<AdminNav />

				<div className="filter-row">
					{FILTERS.map((item) => (
						<button
							key={item.label}
							type="button"
							className={filter === item.id ? "chip is-active" : "chip"}
							onClick={async () => {
								setFilter(item.id);
								setSelected([]);
								setError(null);
								try {
									await load(item.id);
								} catch (err) {
									setError(err instanceof Error ? err.message : "Erro ao filtrar.");
								}
							}}
						>
							{item.label}
						</button>
					))}
				</div>

				{error ? <p className="form-error">{error}</p> : null}
				{importResult ? <p className="form-ok">{importResult}</p> : null}

				{communities.length > 0 ? (
					<div className="batch-bar">
						<label className="admin-pick">
							<input
								type="checkbox"
								checked={allVisibleSelected}
								onChange={toggleSelectAll}
							/>
							Selecionar todas
						</label>
						{selected.length > 0 ? (
							<>
								<span>{selected.length} selecionada(s)</span>
								<button
									type="button"
									disabled={batchBusy}
									onClick={() => runBatch("approve")}
								>
									Aprovar
								</button>
								<button
									type="button"
									className="secondary"
									disabled={batchBusy}
									onClick={() => runBatch("reject")}
								>
									Rejeitar
								</button>
								<button
									type="button"
									className="ghost"
									disabled={batchBusy}
									onClick={() => runBatch("delete")}
								>
									Excluir
								</button>
							</>
						) : (
							<span>Selecione comunidades para atualizar ou excluir em lote.</span>
						)}
					</div>
				) : null}

				{corrections.length > 0 ? (
					<section className="editor-card">
						<h2>Correções pendentes ({corrections.length})</h2>
						<ul className="admin-list">
							{corrections.map((correction) => (
								<li key={correction.id}>
									<div>
										<strong>{correction.community_name}</strong>
										<span>
											Enviado por {correction.submitted_by_name} (
											{correction.submitted_by_email})
										</span>
										{correction.note ? (
											<small>{correction.note}</small>
										) : null}
									</div>
									<div className="row-actions">
										<button
											type="button"
											onClick={async () => {
												try {
													await adminApproveCorrection(correction.id);
													await load();
												} catch (err) {
													setError(
														err instanceof Error
															? err.message
															: "Não foi possível aplicar.",
													);
												}
											}}
										>
											Aplicar
										</button>
										<button
											type="button"
											className="secondary"
											onClick={() => {
												setEditing(null);
												setReviewing(correction);
											}}
										>
											Revisar
										</button>
										<button
											type="button"
											className="ghost"
											onClick={async () => {
												try {
													await adminRejectCorrection(correction.id);
													if (reviewing?.id === correction.id) {
														setReviewing(null);
													}
													await load();
												} catch (err) {
													setError(
														err instanceof Error
															? err.message
															: "Não foi possível rejeitar.",
													);
												}
											}}
										>
											Rejeitar
										</button>
									</div>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{reviewing ? (
					<section className="editor-card">
						<h2>Revisar correção: {reviewing.community_name}</h2>
						{reviewing.note ? (
							<p className="hint">{reviewing.note}</p>
						) : null}
						<CommunityForm
							key={`correction-${reviewing.id}`}
							mode="admin"
							initial={proposedCommunity(reviewing)}
							busy={busy}
							error={error}
							onSubmit={handleSave}
						/>
						<button
							type="button"
							className="ghost"
							onClick={() => setReviewing(null)}
						>
							Cancelar
						</button>
					</section>
				) : null}

				{editing ? (
					<section className="editor-card">
						<h2>
							{editing === "new" ? "Nova comunidade" : `Editar: ${editing.name}`}
						</h2>
						<CommunityForm
							key={editing === "new" ? "new" : editing.id}
							mode="admin"
							initial={editing === "new" ? undefined : editing}
							busy={busy}
							error={error}
							onSubmit={handleSave}
						/>
						<button type="button" className="ghost" onClick={() => setEditing(null)}>
							Cancelar
						</button>
					</section>
				) : null}

				<ul className="admin-list">
					{communities.map((community) => (
						<li key={community.id}>
							<label className="admin-pick">
								<input
									type="checkbox"
									checked={selected.includes(community.id)}
									onChange={() => toggleSelected(community.id)}
								/>
							</label>
							<div>
								<strong>{community.name}</strong>
								<span>
									{community.city}, {community.state} · {statusLabel(community.status)}
								</span>
								{community.submitted_by_email ? (
									<small>
										Enviado por {community.submitted_by_name} ({community.submitted_by_email})
									</small>
								) : null}
							</div>
							<div className="row-actions">
								{community.status !== "approved" ? (
									<button
										type="button"
										onClick={async () => {
											await adminSetStatus(community.id, "approve");
											await load();
										}}
									>
										Aprovar
									</button>
								) : null}
								{community.status !== "rejected" ? (
									<button
										type="button"
										className="secondary"
										onClick={async () => {
											await adminSetStatus(community.id, "reject");
											await load();
										}}
									>
										Rejeitar
									</button>
								) : null}
								<button
									type="button"
									className="secondary"
									onClick={() => {
										setReviewing(null);
										setEditing(community);
									}}
								>
									Editar
								</button>
								<button
									type="button"
									className="ghost"
									onClick={async () => {
										if (!confirm(`Excluir ${community.name}?`)) return;
										await adminDelete(community.id);
										await load();
									}}
								>
									Excluir
								</button>
							</div>
						</li>
					))}
				</ul>
			</main>
			<Footer />
		</div>
	);
}
