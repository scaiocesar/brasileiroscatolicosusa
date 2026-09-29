import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { SITE_EMAIL, correctionSeo, notFoundSeo } from "../../shared/seo";
import type { Community, CommunityInput } from "../../shared/types";
import { fetchCommunity, fetchConfig, submitCorrection } from "../api";
import { CommunityForm } from "../components/CommunityForm";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { usePageSeo } from "../usePageSeo";

export function CorrectPage() {
	const { slug } = useParams();
	const [community, setCommunity] = useState<Community | null | undefined>(
		undefined,
	);
	const [siteKey, setSiteKey] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);

	usePageSeo(
		useMemo(
			() => (community ? correctionSeo(community) : notFoundSeo()),
			[community],
		),
	);

	useEffect(() => {
		fetchConfig().then((config) => setSiteKey(config.turnstileSiteKey));
	}, []);

	useEffect(() => {
		if (!slug) {
			setCommunity(null);
			return;
		}
		fetchCommunity(slug)
			.then(setCommunity)
			.catch(() => setCommunity(null));
	}, [slug]);

	async function onSubmit(input: CommunityInput) {
		if (!community) return;
		setBusy(true);
		setError(null);
		try {
			await submitCorrection(community.slug, input);
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
				<p className="eyebrow">Correção</p>
				<h1>
					{community ? `Corrigir ${community.name}` : "Corrigir comunidade"}
				</h1>
				<p className="lead">
					Ajuste os dados e envie para a equipe revisar. A alteração só
					aparece no mapa depois da aprovação. Dúvidas:{" "}
					<a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>.
				</p>
				{community === undefined ? (
					<p>Carregando...</p>
				) : community === null ? (
					<p className="form-error">Comunidade não encontrada.</p>
				) : done ? (
					<div className="success-card">
						<h2>Correção enviada</h2>
						<p>
							Recebemos a sugestão. Assim que for autorizada, os dados da
							comunidade são atualizados no mapa.
						</p>
						<Link to={`/comunidade/${community.slug}`} className="button-link">
							Voltar para a comunidade
						</Link>
					</div>
				) : (
					<CommunityForm
						mode="correction"
						initial={community}
						turnstileSiteKey={siteKey}
						busy={busy}
						error={error}
						onSubmit={onSubmit}
					/>
				)}
			</main>
			<Footer />
		</div>
	);
}
