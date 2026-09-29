import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { adminUsersSeo } from "../../shared/seo";
import type { AdminUser } from "../../shared/types";
import {
	adminBlockUser,
	adminCreateUser,
	adminListUsers,
	adminLogout,
	adminMe,
	adminResetUserPassword,
	adminUnblockUser,
	adminUpdateUser,
} from "../api";
import { AdminNav } from "../components/AdminNav";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { usePageSeo } from "../usePageSeo";

function formatDate(value: string | null): string {
	if (!value) return "—";
	const date = new Date(value.includes("T") ? value : `${value}Z`);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("pt-BR");
}

export function AdminUsersPage() {
	usePageSeo(useMemo(() => adminUsersSeo(), []));

	const [authed, setAuthed] = useState<boolean | null>(null);
	const [currentId, setCurrentId] = useState<number | null>(null);
	const [users, setUsers] = useState<AdminUser[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [okMessage, setOkMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
	const [resetting, setResetting] = useState<AdminUser | null>(null);

	const [username, setUsername] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");

	async function load() {
		const list = await adminListUsers();
		setUsers(list);
	}

	useEffect(() => {
		adminMe()
			.then(async (me) => {
				setAuthed(me.authenticated);
				setCurrentId(me.id ?? null);
				if (me.authenticated) await load();
			})
			.catch((err: unknown) => setError(String(err)));
	}, []);

	function openCreate() {
		setError(null);
		setOkMessage(null);
		setEditing("new");
		setResetting(null);
		setUsername("");
		setDisplayName("");
		setPassword("");
		setPasswordConfirm("");
	}

	function openEdit(user: AdminUser) {
		setError(null);
		setOkMessage(null);
		setEditing(user);
		setResetting(null);
		setUsername(user.username);
		setDisplayName(user.display_name ?? "");
		setPassword("");
		setPasswordConfirm("");
	}

	function openReset(user: AdminUser) {
		setError(null);
		setOkMessage(null);
		setEditing(null);
		setResetting(user);
		setPassword("");
		setPasswordConfirm("");
	}

	async function handleSave(event: FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		setOkMessage(null);
		try {
			if (editing === "new") {
				if (password !== passwordConfirm) {
					throw new Error("As senhas não coincidem.");
				}
				await adminCreateUser({
					username,
					display_name: displayName.trim() || null,
					password,
				});
				setOkMessage("Usuário cadastrado.");
			} else if (editing) {
				await adminUpdateUser(editing.id, {
					username,
					display_name: displayName.trim() || null,
				});
				setOkMessage("Usuário atualizado.");
			}
			setEditing(null);
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Falha ao salvar.");
		} finally {
			setBusy(false);
		}
	}

	async function handleReset(event: FormEvent) {
		event.preventDefault();
		if (!resetting) return;
		setBusy(true);
		setError(null);
		setOkMessage(null);
		try {
			if (password !== passwordConfirm) {
				throw new Error("As senhas não coincidem.");
			}
			await adminResetUserPassword(resetting.id, password);
			setOkMessage(`Senha de ${resetting.username} redefinida.`);
			setResetting(null);
			setPassword("");
			setPasswordConfirm("");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Falha ao resetar senha.");
		} finally {
			setBusy(false);
		}
	}

	async function toggleBlock(user: AdminUser) {
		setBusy(true);
		setError(null);
		setOkMessage(null);
		try {
			if (user.status === "blocked") {
				await adminUnblockUser(user.id);
				setOkMessage(`${user.username} desbloqueado.`);
			} else {
				await adminBlockUser(user.id);
				setOkMessage(`${user.username} bloqueado.`);
			}
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Falha ao atualizar status.");
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
				<main className="page-main">
					<p className="eyebrow">Painel</p>
					<h1>Usuários admin</h1>
					<p>
						Faça login no{" "}
						<Link to="/admin">painel de comunidades</Link> para gerenciar
						usuários.
					</p>
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
						<h1>Usuários admin</h1>
					</div>
					<div className="admin-actions">
						<button type="button" className="secondary" onClick={openCreate}>
							Novo usuário
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

				{error ? <p className="form-error">{error}</p> : null}
				{okMessage ? <p className="form-ok">{okMessage}</p> : null}

				{editing ? (
					<section className="editor-card panel-card">
						<h2>{editing === "new" ? "Cadastrar usuário" : "Editar usuário"}</h2>
						<form className="stack-form" onSubmit={handleSave}>
							<label>
								Usuário
								<input
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									required
									minLength={3}
									maxLength={40}
									autoComplete="off"
								/>
							</label>
							<label>
								Nome de exibição
								<input
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									maxLength={80}
								/>
							</label>
							{editing === "new" ? (
								<>
									<label>
										Senha
										<input
											type="password"
											value={password}
											onChange={(e) => setPassword(e.target.value)}
											required
											minLength={8}
											autoComplete="new-password"
										/>
									</label>
									<label>
										Confirmar senha
										<input
											type="password"
											value={passwordConfirm}
											onChange={(e) => setPasswordConfirm(e.target.value)}
											required
											minLength={8}
											autoComplete="new-password"
										/>
									</label>
								</>
							) : null}
							<div className="row-actions">
								<button type="submit" disabled={busy}>
									{busy ? "Salvando..." : "Salvar"}
								</button>
								<button
									type="button"
									className="ghost"
									onClick={() => setEditing(null)}
								>
									Cancelar
								</button>
							</div>
						</form>
					</section>
				) : null}

				{resetting ? (
					<section className="editor-card panel-card">
						<h2>Resetar senha — {resetting.username}</h2>
						<form className="stack-form" onSubmit={handleReset}>
							<label>
								Nova senha
								<input
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									minLength={8}
									autoComplete="new-password"
								/>
							</label>
							<label>
								Confirmar nova senha
								<input
									type="password"
									value={passwordConfirm}
									onChange={(e) => setPasswordConfirm(e.target.value)}
									required
									minLength={8}
									autoComplete="new-password"
								/>
							</label>
							<div className="row-actions">
								<button type="submit" disabled={busy}>
									{busy ? "Salvando..." : "Redefinir senha"}
								</button>
								<button
									type="button"
									className="ghost"
									onClick={() => setResetting(null)}
								>
									Cancelar
								</button>
							</div>
						</form>
					</section>
				) : null}

				<ul className="admin-list">
					{users.map((user) => (
						<li key={user.id}>
							<div>
								<strong>{user.username}</strong>
								<span>
									{user.display_name || "Sem nome de exibição"} ·{" "}
									{user.status === "blocked" ? "Bloqueado" : "Ativo"}
									{currentId === user.id ? " · você" : ""}
								</span>
								<small>
									Criado: {formatDate(user.created_at)} · Último login:{" "}
									{formatDate(user.last_login_at)}
								</small>
							</div>
							<div className="row-actions">
								<button
									type="button"
									className="secondary"
									disabled={busy}
									onClick={() => openEdit(user)}
								>
									Editar
								</button>
								<button
									type="button"
									className="secondary"
									disabled={busy}
									onClick={() => openReset(user)}
								>
									Resetar senha
								</button>
								<button
									type="button"
									className="ghost"
									disabled={busy || currentId === user.id}
									onClick={() => toggleBlock(user)}
								>
									{user.status === "blocked" ? "Desbloquear" : "Bloquear"}
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
