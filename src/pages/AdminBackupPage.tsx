import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { adminBackupSeo } from "../../shared/seo";
import { parseCommunitiesBackup } from "../../shared/backup";
import {
	adminDownloadBackup,
	adminLogout,
	adminMe,
	adminRestoreBackup,
} from "../api";
import { AdminNav } from "../components/AdminNav";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { usePageSeo } from "../usePageSeo";

type RestoreMode = "merge" | "replace";

function downloadTextFile(fileName: string, text: string) {
	const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = fileName;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function AdminBackupPage() {
	usePageSeo(useMemo(() => adminBackupSeo(), []));

	const [authed, setAuthed] = useState<boolean | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [okMessage, setOkMessage] = useState<string | null>(null);
	const [exporting, setExporting] = useState(false);
	const [restoring, setRestoring] = useState(false);
	const [mode, setMode] = useState<RestoreMode>("merge");
	const [preview, setPreview] = useState<{
		fileName: string;
		count: number;
		exported_at: string | null;
		text: string;
	} | null>(null);

	useEffect(() => {
		adminMe()
			.then((me) => setAuthed(me.authenticated))
			.catch((err: unknown) => setError(String(err)));
	}, []);

	async function handleExport() {
		setExporting(true);
		setError(null);
		setOkMessage(null);
		try {
			const backup = await adminDownloadBackup();
			downloadTextFile(backup.fileName, backup.text);
			setOkMessage(
				`Backup exportado: ${backup.count} comunidade(s) em ${backup.fileName}.`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Falha ao exportar.");
		} finally {
			setExporting(false);
		}
	}

	async function handlePickFile(file: File) {
		setError(null);
		setOkMessage(null);
		try {
			const text = await file.text();
			const parsed = parseCommunitiesBackup(text);
			if (!parsed.ok) {
				setPreview(null);
				setError(parsed.error);
				return;
			}
			setPreview({
				fileName: file.name,
				count: parsed.backup.communities.length,
				exported_at: parsed.backup.exported_at,
				text,
			});
		} catch (err) {
			setPreview(null);
			setError(err instanceof Error ? err.message : "Arquivo inválido.");
		}
	}

	async function handleRestore() {
		if (!preview) return;
		if (
			mode === "replace" &&
			!confirm(
				"Isso apaga TODAS as comunidades atuais e restaura só o que está no backup. Continuar?",
			)
		) {
			return;
		}
		setRestoring(true);
		setError(null);
		setOkMessage(null);
		try {
			const result = await adminRestoreBackup(preview.text, mode);
			const extra = result.errors.length
				? ` Avisos: ${result.errors.slice(0, 5).join(" ")}`
				: "";
			setOkMessage(
				mode === "replace"
					? `Restauração completa: ${result.cleared} removida(s), ${result.created} criada(s).${extra}`
					: `Mesclagem: ${result.created} criada(s), ${result.updated} atualizada(s).${extra}`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Falha ao restaurar.");
		} finally {
			setRestoring(false);
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
					<h1>Backup</h1>
					<p>Faça login para acessar o backup.</p>
					<p>
						<Link to="/admin">Entrar no admin</Link>
					</p>
				</main>
				<Footer />
			</div>
		);
	}

	return (
		<div className="app-shell page-shell admin-shell">
			<Header />
			<main className="page-main admin-main">
				<div className="admin-head">
					<div>
						<p className="eyebrow">Painel</p>
						<h1>Backup</h1>
						<p className="admin-lead">
							Exportar e restaurar todas as comunidades em arquivo de texto
							(incluindo dados privados do admin).
						</p>
					</div>
					<div className="admin-actions">
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

				<section className="admin-backup-card">
					<h2>Exportar</h2>
					<p>
						Gera um arquivo <code>.txt</code> com todas as comunidades,
						horários, serviços, notas internas e contato do coordenador.
					</p>
					<button type="button" disabled={exporting} onClick={handleExport}>
						{exporting ? "Gerando..." : "Baixar backup em texto"}
					</button>
				</section>

				<section className="admin-backup-card">
					<h2>Restaurar</h2>
					<p>
						Selecione um backup gerado por este painel. A mesclagem atualiza pelo
						slug; a substituição apaga tudo antes de importar.
					</p>

					<label className="file-button">
						<input
							type="file"
							accept=".txt,.json,text/plain,application/json"
							disabled={restoring}
							onChange={async (event) => {
								const file = event.target.files?.[0];
								event.target.value = "";
								if (file) await handlePickFile(file);
							}}
						/>
						Escolher arquivo de backup
					</label>

					{preview ? (
						<div className="admin-backup-preview">
							<p>
								<strong>{preview.fileName}</strong>
								{" · "}
								{preview.count} comunidade(s)
								{preview.exported_at
									? ` · exportado em ${new Date(preview.exported_at).toLocaleString("pt-BR")}`
									: ""}
							</p>

							<div className="admin-backup-modes" role="radiogroup" aria-label="Modo de restauração">
								<label className="admin-pick">
									<input
										type="radio"
										name="restore-mode"
										checked={mode === "merge"}
										onChange={() => setMode("merge")}
									/>
									Mesclar (criar/atualizar pelo slug)
								</label>
								<label className="admin-pick">
									<input
										type="radio"
										name="restore-mode"
										checked={mode === "replace"}
										onChange={() => setMode("replace")}
									/>
									Substituir tudo (apaga o banco atual)
								</label>
							</div>

							<div className="row-actions">
								<button
									type="button"
									disabled={restoring}
									onClick={handleRestore}
								>
									{restoring ? "Restaurando..." : "Restaurar backup"}
								</button>
								<button
									type="button"
									className="ghost"
									disabled={restoring}
									onClick={() => setPreview(null)}
								>
									Cancelar
								</button>
							</div>
						</div>
					) : null}
				</section>
			</main>
			<Footer />
		</div>
	);
}
