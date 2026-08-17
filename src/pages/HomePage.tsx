import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { SERVICE_TYPES, US_STATES } from "../../shared/constants";
import type { Community, CommunitySummary } from "../../shared/types";
import { fetchCommunities, fetchCommunity } from "../api";
import { CommunityPanel } from "../components/CommunityPanel";
import { Header } from "../components/Header";
import { MapView } from "../components/MapView";

export function HomePage() {
	const { slug } = useParams();
	const navigate = useNavigate();
	const [communities, setCommunities] = useState<CommunitySummary[]>([]);
	const [selected, setSelected] = useState<Community | null>(null);
	const [query, setQuery] = useState("");
	const [stateFilter, setStateFilter] = useState("");
	const [serviceFilter, setServiceFilter] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetchCommunities()
			.then(setCommunities)
			.catch((err: unknown) =>
				setError(err instanceof Error ? err.message : "Erro ao carregar o mapa."),
			);
	}, []);

	useEffect(() => {
		if (!slug) {
			setSelected(null);
			return;
		}
		fetchCommunity(slug)
			.then(setSelected)
			.catch(() => setSelected(null));
	}, [slug]);

	useEffect(() => {
		document.body.classList.toggle("panel-open", Boolean(selected));
		return () => document.body.classList.remove("panel-open");
	}, [selected]);

	const filtered = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return communities.filter((community) => {
			if (stateFilter && community.state !== stateFilter) return false;
			if (serviceFilter && !community.services.includes(serviceFilter)) {
				return false;
			}
			if (!needle) return true;
			return `${community.name} ${community.city} ${community.state}`
				.toLowerCase()
				.includes(needle);
		});
	}, [communities, query, serviceFilter, stateFilter]);

	function selectCommunity(community: CommunitySummary) {
		navigate(`/comunidade/${community.slug}`);
	}

	return (
		<div className="app-shell map-shell">
			<Header />
			<div className="map-layout">
				<aside className="map-sidebar">
					<h1>Encontre sua comunidade</h1>
					<p>
						Mapa das comunidades católicas brasileiras nos Estados Unidos.
					</p>
					<input
						placeholder="Buscar por nome ou cidade"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
					<select
						value={stateFilter}
						onChange={(event) => setStateFilter(event.target.value)}
					>
						<option value="">Todos os estados</option>
						{US_STATES.map((state) => (
							<option key={state.code} value={state.code}>
								{state.name}
							</option>
						))}
					</select>
					<select
						value={serviceFilter}
						onChange={(event) => setServiceFilter(event.target.value)}
					>
						<option value="">Todos os serviços</option>
						{SERVICE_TYPES.map((service) => (
							<option key={service.id} value={service.id}>
								{service.label}
							</option>
						))}
					</select>
					<p className="count">
						{filtered.length} comunidade{filtered.length === 1 ? "" : "s"}
					</p>
					{error ? <p className="form-error">{error}</p> : null}
					<ul className="community-list">
						{filtered.map((community) => (
							<li key={community.id}>
								<button
									type="button"
									className={community.slug === slug ? "is-active" : ""}
									onClick={() => selectCommunity(community)}
								>
									<strong>{community.name}</strong>
									<span>
										{community.city}, {community.state}
									</span>
								</button>
							</li>
						))}
					</ul>
				</aside>
				<div className="map-stage">
					<MapView
						communities={filtered}
						selectedSlug={slug}
						onSelect={selectCommunity}
					/>
					{selected ? (
						<>
							<button
								type="button"
								className="community-panel-backdrop"
								aria-label="Fechar detalhes da comunidade"
								onClick={() => navigate("/")}
							/>
							<CommunityPanel
								community={selected}
								onClose={() => navigate("/")}
							/>
						</>
					) : null}
				</div>
			</div>
		</div>
	);
}
