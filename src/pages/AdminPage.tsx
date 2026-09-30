import { useEffect, useMemo, useState, type FormEvent } from "react";
import { adminSeo } from "../../shared/seo";
import type {
	Community,
	CommunityCorrection,
	CommunityInput,
	CommunityStatus,
} from "../../shared/types";
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
import { AdminCommunityDetail } from "../components/AdminCommunityDetail";
import { AdminNav } from "../components/AdminNav";
import { CommunityForm } from "../components/CommunityForm";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { TurnstileWidget } from "../components/TurnstileWidget";
import {
	defaultCommunitiesExportFileName,
	downloadCommunitiesExcel,
} from "../../shared/exportExcel";

type StatusFilter = "" | CommunityStatus;
type SortBy = "name" | "state";

const FILTERS: Array<{ id: StatusFilter; label: string }> = [
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

function statusClass(status: CommunityStatus): string {
	if (status === "approved") return "is-active";
	if (status === "rejected") return "is-blocked";
	return "is-pending";
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
		coordinator_name: null,
		coordinator_phone: null,
		created_at: correction.created_at,
		updated_at: correction.created_at,
		approved_at: null,
		mass_schedules: proposed.mass_schedules,
		services: proposed.services,
	};
}

function matchesQuery(community: Community, query: string): boolean {
	if (!query) return true;
	const haystack = [
		community.name,
		community.city,
		community.state,
		community.zip,
		community.address_line,
		community.slug,
		community.email,
		community.submitted_by_name,
		community.submitted_by_email,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((token) => haystack.includes(token));
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
	const [filter, setFilter] = useState<StatusFilter>("pending");
	const [query, setQuery] = useState("");
	const [sortBy, setSortBy] = useState<SortBy>("name");
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [editing, setEditing] = useState<Community | "new" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [importing, setImporting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [corrections, setCorrections] = useState<CommunityCorrection[]>([]);
	const [reviewing, setReviewing] = useState<CommunityCorrection | null>(null);
	const [selected, setSelected] = useState<number[]>([]);
	const [batchBusy, setBatchBusy] = useState(false);
	const [exporting, setExporting] = useState(false);

	const correctionsByCommunity = useMemo(() => {
		const map = new Map<number, CommunityCorrection>();
		for (const correction of corrections) {
			map.set(correction.community_id, correction);
		}
		return map;
	}, [corrections]);

	const counts = useMemo(() => {
		const next = { all: communities.length, pending: 0, approved: 0, rejected: 0 };
		for (const community of communities) {
			next[community.status] += 1;
		}
		return next;
	}, [communities]);

	const visible = useMemo(() => {
		const filtered = communities.filter((community) => {
			if (filter && community.status !== filter) return false;
			return matchesQuery(community, query);
		});
		return filtered.slice().sort((a, b) => {
			if (sortBy === "state") {
				const byState = a.state.localeCompare(b.state, "en");
				if (byState !== 0) return byState;
				const byCity = a.city.localeCompare(b.city, "pt-BR");
				if (byCity !== 0) return byCity;
				return a.name.localeCompare(b.name, "pt-BR");
			}
			return a.name.localeCompare(b.name, "pt-BR");
		});
	}, [communities, filter, query, sortBy]);

	const selectedCommunity =
		communities.find((community) => community.id === selectedId) ??
		visible[0] ??
		null;

	const selectedCorrection = selectedCommunity
		? (correctionsByCommunity.get(selectedCommunity.id) ?? null)
		: null;

	async function load() {
		const [list, pendingCorrections] = await Promise.all([
			adminList(),
			adminListCorrections("pending"),
		]);
		setCommunities(list);
		setCorrections(pendingCorrections);
		setSelectedId((current) => {
			if (current && list.some((item) => item.id === current)) return current;
			const preferred =
				list.find((item) => item.status === "pending") ?? list[0] ?? null;
			return preferred?.id ?? null;
		});
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

	useEffect(() => {
		if (!selectedId && visible[0]) {
			setSelectedId(visible[0].id);
			return;
		}
		if (
			selectedId &&
			visible.length > 0 &&
			!visible.some((item) => item.id === selectedId)
		) {
			setSelectedId(visible[0].id);
		}
	}, [visible, selectedId]);

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
				setMessage("Correção aplicada.");
			} else {
				const saved = await adminSave(
					input,
					editing && editing !== "new" ? editing.id : undefined,
				);
				setEditing(null);
				setSelectedId(saved.id);
				setMessage(
					editing === "new" ? "Comunidade criada." : "Comunidade atualizada.",
				);
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
		setMessage(null);
		try {
			const csv = await file.text();
			const result = await adminImportCsv(csv);
			setFilter("pending");
			await load();
			const extra = result.errors.length
				? ` ${result.errors.slice(0, 8).join(" ")}`
				: "";
			setMessage(
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
		visible.length > 0 &&
		visible.every((community) => selected.includes(community.id));

	function toggleSelectAll() {
		if (allVisibleSelected) {
			const visibleIds = new Set(visible.map((community) => community.id));
			setSelected((current) => current.filter((id) => !visibleIds.has(id)));
			return;
		}
		setSelected((current) => [
			...new Set([...current, ...visible.map((community) => community.id)]),
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
		setMessage(null);
		try {
			const result = await adminBatchCommunities(action, selected);
			setSelected([]);
			await load();
			if (action === "delete") {
				setMessage(`${result.deleted} comunidade(s) excluída(s).`);
			} else {
				setMessage(
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

	async function changeStatus(id: number, action: "approve" | "reject") {
		setBusy(true);
		setError(null);
		try {
			await adminSetStatus(id, action);
			setMessage(action === "approve" ? "Comunidade aprovada." : "Comunidade rejeitada.");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
		} finally {
			setBusy(false);
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

	const filterCount = (id: StatusFilter): number => {
		if (id === "") return counts.all;
		return counts[id];
	};

	return (
		<div className="app-shell page-shell admin-shell">
			<Header />
			<main className="page-main admin-main">
				<div className="admin-head">
					<div>
						<p className="eyebrow">Painel</p>
						<h1>Comunidades</h1>
						<p className="admin-lead">
							{counts.pending} pendente{counts.pending === 1 ? "" : "s"}
							{corrections.length > 0
								? ` · ${corrections.length} correção${corrections.length === 1 ? "" : "ões"}`
								: ""}
							{" · "}
							{counts.all} no total
						</p>
					</div>
					<div className="admin-actions">
						<button
							type="button"
							className="secondary"
							disabled={exporting || visible.length === 0}
							onClick={async () => {
								setExporting(true);
								setError(null);
								try {
									await downloadCommunitiesExcel(visible, {
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
							{exporting ? "Exportando..." : "Exportar"}
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
						<button
							type="button"
							onClick={() => {
								setReviewing(null);
								setEditing("new");
							}}
						>
							Nova
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

				<div className="admin-toolbar">
					<div className="admin-toolbar-row">
						<label className="admin-search">
							<span className="sr-only">Buscar comunidades</span>
							<input
								type="search"
								placeholder="Buscar por nome, cidade, ZIP, e-mail…"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
							/>
						</label>
						<label className="admin-sort">
							<span>Ordenar</span>
							<select
								value={sortBy}
								onChange={(event) =>
									setSortBy(event.target.value as SortBy)
								}
							>
								<option value="name">Por nome</option>
								<option value="state">Por estado</option>
							</select>
						</label>
					</div>
					<div className="filter-row" role="tablist" aria-label="Filtrar por status">
						{FILTERS.map((item) => (
							<button
								key={item.label}
								type="button"
								role="tab"
								aria-selected={filter === item.id}
								className={filter === item.id ? "chip is-active" : "chip"}
								onClick={() => {
									setFilter(item.id);
									setSelected([]);
									setEditing(null);
									setReviewing(null);
								}}
							>
								{item.label}
								<span className="chip-count">{filterCount(item.id)}</span>
							</button>
						))}
					</div>
				</div>

				{error ? <p className="form-error">{error}</p> : null}
				{message ? <p className="form-ok">{message}</p> : null}

				{visible.length > 0 ? (
					<div className="batch-bar">
						<label className="admin-pick">
							<input
								type="checkbox"
								checked={allVisibleSelected}
								onChange={toggleSelectAll}
							/>
							Selecionar visíveis
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
							<span className="batch-hint">
								Marque várias para aprovar ou excluir de uma vez.
							</span>
						)}
					</div>
				) : null}

				<div className="admin-workspace">
					<section className="admin-list-pane" aria-label="Lista de comunidades">
						{visible.length === 0 ? (
							<p className="admin-empty-block">
								Nenhuma comunidade neste filtro
								{query ? " com essa busca" : ""}.
							</p>
						) : (
							<ul className="admin-community-list">
								{visible.map((community) => {
									const hasCorrection = correctionsByCommunity.has(community.id);
									const isActive =
										selectedCommunity?.id === community.id &&
										!editing &&
										!reviewing;
									return (
										<li key={community.id}>
											<label
												className="admin-pick"
												onClick={(event) => event.stopPropagation()}
											>
												<input
													type="checkbox"
													checked={selected.includes(community.id)}
													onChange={() => toggleSelected(community.id)}
												/>
											</label>
											<button
												type="button"
												className={
													isActive
														? "admin-community-row is-active"
														: "admin-community-row"
												}
												onClick={() => {
													setSelectedId(community.id);
													setEditing(null);
													setReviewing(null);
													if (window.matchMedia("(max-width: 900px)").matches) {
														window.requestAnimationFrame(() => {
															document
																.getElementById("admin-detail-pane")
																?.scrollIntoView({
																	behavior: "smooth",
																	block: "start",
																});
														});
													}
												}}
											>
												<span className="admin-community-row-main">
													<strong>{community.name}</strong>
													<span>
														{community.city}, {community.state}
													</span>
												</span>
												<span className="admin-community-row-meta">
													{hasCorrection ? (
														<span className="admin-badge">Correção</span>
													) : null}
													<span
														className={`admin-status ${statusClass(community.status)}`}
													>
														{statusLabel(community.status)}
													</span>
												</span>
											</button>
										</li>
									);
								})}
							</ul>
						)}
					</section>

					<section
						id="admin-detail-pane"
						className="admin-detail-pane"
						aria-label="Resumo da comunidade"
					>
						{editing ? (
							<div className="admin-editor">
								<div className="admin-editor-head">
									<h2>
										{editing === "new"
											? "Nova comunidade"
											: `Editar: ${editing.name}`}
									</h2>
									<button
										type="button"
										className="ghost"
										onClick={() => setEditing(null)}
									>
										Cancelar
									</button>
								</div>
								<CommunityForm
									key={editing === "new" ? "new" : editing.id}
									mode="admin"
									initial={editing === "new" ? undefined : editing}
									busy={busy}
									error={error}
									onSubmit={handleSave}
								/>
							</div>
						) : reviewing ? (
							<div className="admin-editor">
								<div className="admin-editor-head">
									<h2>Revisar correção: {reviewing.community_name}</h2>
									<button
										type="button"
										className="ghost"
										onClick={() => setReviewing(null)}
									>
										Cancelar
									</button>
								</div>
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
							</div>
						) : selectedCommunity ? (
							<AdminCommunityDetail
								community={selectedCommunity}
								correction={selectedCorrection}
								busy={busy || batchBusy}
								onApprove={() => changeStatus(selectedCommunity.id, "approve")}
								onReject={() => changeStatus(selectedCommunity.id, "reject")}
								onEdit={() => {
									setReviewing(null);
									setEditing(selectedCommunity);
								}}
								onDelete={async () => {
									if (!confirm(`Excluir ${selectedCommunity.name}?`)) return;
									setBusy(true);
									try {
										await adminDelete(selectedCommunity.id);
										setSelectedId(null);
										setMessage("Comunidade excluída.");
										await load();
									} catch (err) {
										setError(
											err instanceof Error
												? err.message
												: "Não foi possível excluir.",
										);
									} finally {
										setBusy(false);
									}
								}}
								onApplyCorrection={
									selectedCorrection
										? async () => {
												setBusy(true);
												try {
													await adminApproveCorrection(selectedCorrection.id);
													setMessage("Correção aplicada.");
													await load();
												} catch (err) {
													setError(
														err instanceof Error
															? err.message
															: "Não foi possível aplicar.",
													);
												} finally {
													setBusy(false);
												}
											}
										: undefined
								}
								onReviewCorrection={
									selectedCorrection
										? () => {
												setEditing(null);
												setReviewing(selectedCorrection);
											}
										: undefined
								}
								onRejectCorrection={
									selectedCorrection
										? async () => {
												setBusy(true);
												try {
													await adminRejectCorrection(selectedCorrection.id);
													setMessage("Correção rejeitada.");
													await load();
												} catch (err) {
													setError(
														err instanceof Error
															? err.message
															: "Não foi possível rejeitar.",
													);
												} finally {
													setBusy(false);
												}
											}
										: undefined
								}
							/>
						) : (
							<div className="admin-detail-empty">
								<p>Selecione uma comunidade na lista para ver o resumo completo.</p>
								<button
									type="button"
									onClick={() => {
										setReviewing(null);
										setEditing("new");
									}}
								>
									Criar comunidade
								</button>
							</div>
						)}
					</section>
				</div>
			</main>
			<Footer />
		</div>
	);
}
