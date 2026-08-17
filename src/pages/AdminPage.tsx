import { useEffect, useState, type FormEvent } from "react";
import type { Community, CommunityInput, CommunityStatus } from "../../shared/types";
import {
	adminDelete,
	adminImportCsv,
	adminList,
	adminLogin,
	adminLogout,
	adminMe,
	adminSave,
	adminSetStatus,
	fetchConfig,
} from "../api";
import { CommunityForm } from "../components/CommunityForm";
import { Header } from "../components/Header";
import { TurnstileWidget } from "../components/TurnstileWidget";

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

export function AdminPage() {
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

	async function load(nextFilter = filter) {
		const list = await adminList(nextFilter || undefined);
		setCommunities(list);
	}

	useEffect(() => {
		fetchConfig().then((config) => setSiteKey(config.turnstileSiteKey));
		adminMe()
			.then(async (ok) => {
				setAuthed(ok);
				if (ok) await load();
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
			await adminSave(input, editing && editing !== "new" ? editing.id : undefined);
			setEditing(null);
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

	if (authed === null) {
		return (
			<div className="app-shell page-shell">
				<Header />
				<main className="page-main">
					<p>Carregando...</p>
				</main>
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
						<button type="button" className="secondary" onClick={() => setEditing("new")}>
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

				<div className="filter-row">
					{FILTERS.map((item) => (
						<button
							key={item.label}
							type="button"
							className={filter === item.id ? "chip is-active" : "chip"}
							onClick={async () => {
								setFilter(item.id);
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
									onClick={() => setEditing(community)}
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
		</div>
	);
}
