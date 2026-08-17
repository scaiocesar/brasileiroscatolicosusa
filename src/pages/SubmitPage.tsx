import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { submitSeo } from "../../shared/seo";
import type { CommunityInput } from "../../shared/types";
import { fetchConfig, submitCommunity } from "../api";
import { CommunityForm } from "../components/CommunityForm";
import { Header } from "../components/Header";
import { usePageSeo } from "../usePageSeo";

export function SubmitPage() {
	const [siteKey, setSiteKey] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	usePageSeo(useMemo(() => submitSeo(), []));

	useEffect(() => {
		fetchConfig().then((config) => setSiteKey(config.turnstileSiteKey));
	}, []);

	async function onSubmit(input: CommunityInput) {
		setBusy(true);
		setError(null);
		try {
			await submitCommunity(input);
			setDone(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Não foi possível enviar.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="app-shell page-shell">
			<Header />
			<main className="page-main">
				<p className="eyebrow">Pré-cadastro</p>
				<h1>Informe sua comunidade</h1>
				<p className="lead">
					Envie os dados da sua comunidade católica brasileira. A equipe
					revisa o cadastro e, depois da aprovação, o pin aparece no mapa.
				</p>
				{done ? (
					<div className="success-card">
						<h2>Pedido enviado</h2>
						<p>
							Recebemos o pré-cadastro. Assim que for autorizado, a comunidade
							passa a aparecer no mapa público.
						</p>
						<Link to="/" className="button-link">
							Voltar ao mapa
						</Link>
					</div>
				) : (
					<CommunityForm
						mode="public"
						turnstileSiteKey={siteKey}
						busy={busy}
						error={error}
						onSubmit={onSubmit}
					/>
				)}
			</main>
		</div>
	);
}
