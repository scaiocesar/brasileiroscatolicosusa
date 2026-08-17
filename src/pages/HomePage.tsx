import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
	SERVICE_TYPE_IDS,
	SERVICE_TYPES,
	US_STATES,
} from "../../shared/constants";
import { communitySeo, homeSeo, SITE_EMAIL } from "../../shared/seo";
import type { Community, CommunitySummary } from "../../shared/types";
import { fetchCommunities, fetchCommunity } from "../api";
import { CommunityPanel } from "../components/CommunityPanel";
import { CoverageHighlights } from "../components/CoverageHighlights";
import { Header } from "../components/Header";
import { MapView } from "../components/MapView";
import { usePageSeo } from "../usePageSeo";
import { useWebMcpTools, type WebMcpTool } from "../useWebMcpTools";
import {
	ambiguousMatches,
	asTrimmedString,
	communityCard,
	communityDetails,
	filterMapCommunities,
	findCommunity,
	parseServiceId,
	parseStateCode,
	US_STATE_CODES,
} from "../webmcp";

export function HomePage() {
	const { slug } = useParams();
	const navigate = useNavigate();
	const [communities, setCommunities] = useState<CommunitySummary[]>([]);
	const [selected, setSelected] = useState<Community | null>(null);
	const [query, setQuery] = useState("");
	const [stateFilter, setStateFilter] = useState("");
	const [serviceFilter, setServiceFilter] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [sidebarOpen, setSidebarOpen] = useState(
		() =>
			typeof window === "undefined" ||
			!window.matchMedia("(max-width: 900px)").matches,
	);

	function isMobileMap() {
		return window.matchMedia("(max-width: 900px)").matches;
	}

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

	const filtered = useMemo(
		() =>
			filterMapCommunities(communities, {
				q: query,
				state: stateFilter,
				service: serviceFilter,
			}),
		[communities, query, serviceFilter, stateFilter],
	);

	const seo = useMemo(
		() => (selected ? communitySeo(selected) : homeSeo()),
		[selected],
	);
	usePageSeo(seo);

	function selectCommunity(community: CommunitySummary) {
		navigate(`/comunidade/${community.slug}`);
		if (isMobileMap()) setSidebarOpen(false);
	}

	const mapTools = useMemo((): WebMcpTool[] => {
		const tools: WebMcpTool[] = [
			{
				name: "search_communities",
				title: "Buscar comunidades",
				description:
					"Filtra o mapa por nome/cidade, estado (sigla dos EUA) e serviço. Campos omitidos permanecem; envie string vazia para limpar. Devolve as comunidades visíveis.",
				inputSchema: {
					type: "object",
					properties: {
						q: {
							type: "string",
							description:
								"Busca por nome, cidade ou estado. String vazia limpa a busca.",
						},
						state: {
							type: "string",
							enum: [...US_STATE_CODES, ""],
							description:
								"Sigla do estado dos EUA (ex.: FL, MA, TX). String vazia mostra todos.",
						},
						service: {
							type: "string",
							enum: [...SERVICE_TYPE_IDS, ""],
							description:
								"Tipo de serviço. String vazia mostra todos. Valores: missa, catequese, batismo, crisma, primeira_eucaristia, casamento, confissao, adoracao, grupo_oracao, jovens, outros.",
						},
					},
				},
				annotations: { readOnlyHint: false, idempotentHint: true },
				execute: (args) => {
					const parsedQuery = asTrimmedString(args.q);
					const parsedState = parseStateCode(args.state);
					const parsedService = parseServiceId(args.service);
					const nextQuery = parsedQuery === undefined ? query : parsedQuery;
					const nextState = parsedState === undefined ? stateFilter : parsedState;
					const nextService =
						parsedService === undefined ? serviceFilter : parsedService;
					setQuery(nextQuery);
					setStateFilter(nextState);
					setServiceFilter(nextService);
					const matches = filterMapCommunities(communities, {
						q: nextQuery,
						state: nextState,
						service: nextService,
					});
					return {
						count: matches.length,
						query: nextQuery,
						state: nextState || null,
						service: nextService || null,
						communities: matches.map(communityCard),
					};
				},
			},
			{
				name: "open_community",
				title: "Abrir comunidade",
				description:
					"Abre o painel de uma comunidade no mapa. Informe o slug (preferível) ou o nome.",
				inputSchema: {
					type: "object",
					properties: {
						slug: {
							type: "string",
							description: "Identificador na URL, ex.: comunidade-sao-paulo-miami",
						},
						name: {
							type: "string",
							description: "Nome da comunidade, se o slug for desconhecido",
						},
					},
				},
				annotations: { readOnlyHint: false, idempotentHint: true },
				execute: (args) => {
					const slug = asTrimmedString(args.slug);
					const name = asTrimmedString(args.name);
					if (!slug && !name) {
						throw new Error("Informe slug ou name da comunidade.");
					}
					const found = findCommunity(communities, {
						slug: slug || undefined,
						name: name || undefined,
					});
					if (!found) {
						const suggestions = name
							? ambiguousMatches(communities, name).map(communityCard)
							: [];
						return {
							error: "Comunidade não encontrada.",
							suggestions,
							hint: "Use search_communities para listar slugs.",
						};
					}
					navigate(`/comunidade/${found.slug}`);
					return communityCard(found);
				},
			},
			{
				name: "get_community",
				title: "Detalhes da comunidade",
				description:
					"Devolve endereço, horários de missa, serviços e contato. Sem slug, usa a comunidade aberta no mapa.",
				inputSchema: {
					type: "object",
					properties: {
						slug: {
							type: "string",
							description: "Slug da comunidade. Omita para usar a que está aberta.",
						},
					},
				},
				annotations: { readOnlyHint: true, idempotentHint: true },
				execute: async (args) => {
					const slug = asTrimmedString(args.slug) || selected?.slug;
					if (!slug) {
						throw new Error(
							"Nenhuma comunidade aberta. Passe slug ou use open_community antes.",
						);
					}
					if (selected && selected.slug === slug) {
						return communityDetails(selected);
					}
					try {
						return communityDetails(await fetchCommunity(slug));
					} catch {
						throw new Error(`Comunidade não encontrada: ${slug}`);
					}
				},
			},
		];

		if (selected) {
			tools.push(
				{
					name: "close_community",
					title: "Fechar comunidade",
					description: "Fecha o painel da comunidade e volta ao mapa geral.",
					inputSchema: { type: "object", properties: {} },
					annotations: { readOnlyHint: false, idempotentHint: true },
					execute: () => {
						navigate("/");
						return { ok: true, path: "/" };
					},
				},
				{
					name: "suggest_correction",
					title: "Sugerir correção",
					description:
						"Abre o formulário para corrigir os dados da comunidade aberta. O envio exige confirmação humana (anti-spam).",
					inputSchema: { type: "object", properties: {} },
					annotations: { readOnlyHint: false, idempotentHint: true },
					execute: () => {
						const path = `/comunidade/${selected.slug}/corrigir`;
						navigate(path);
						return { ok: true, path, name: selected.name };
					},
				},
			);
		}

		return tools;
	}, [communities, navigate, query, selected, serviceFilter, stateFilter]);

	useWebMcpTools(mapTools);

	return (
		<div className="app-shell map-shell">
			<Header
				menuOpen={sidebarOpen}
				onToggleMenu={() => setSidebarOpen((open) => !open)}
			/>
			<div
				className={`map-layout${sidebarOpen ? " sidebar-open" : " sidebar-collapsed"}`}
			>
				<aside className="map-sidebar" aria-hidden={!sidebarOpen}>
					<div className="map-sidebar-head">
						{selected ? (
							<p className="map-sidebar-title">Encontre sua comunidade</p>
						) : (
							<h1 className="map-sidebar-title">Encontre sua comunidade</h1>
						)}
						<button
							type="button"
							className="ghost sidebar-hide"
							onClick={() => setSidebarOpen(false)}
						>
							Ocultar menu
						</button>
					</div>
					<p>
						Mapa das comunidades católicas brasileiras nos Estados Unidos.
						Encontre missas em português, catequese e sacramentos perto de
						você.
					</p>
					<p className="contact-line">
						Contato:{" "}
						<a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>
					</p>
					<input
						type="search"
						placeholder="Buscar por nome ou cidade"
						aria-label="Buscar comunidade por nome ou cidade"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
					<select
						aria-label="Filtrar por estado"
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
						aria-label="Filtrar por serviço"
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
								<Link
									to={`/comunidade/${community.slug}`}
									className={community.slug === slug ? "is-active" : ""}
									onClick={() => {
										if (isMobileMap()) setSidebarOpen(false);
									}}
								>
									<strong>{community.name}</strong>
									<span>
										{community.city}, {community.state}
									</span>
								</Link>
							</li>
						))}
					</ul>
					<CoverageHighlights
						communities={communities}
						onNavigate={() => {
							if (isMobileMap()) setSidebarOpen(false);
						}}
					/>
				</aside>
				<div className="map-stage">
					{!sidebarOpen ? (
						<button
							type="button"
							className="map-list-toggle"
							onClick={() => setSidebarOpen(true)}
						>
							Mostrar menu
						</button>
					) : null}
					<MapView
						communities={filtered}
						selectedSlug={slug}
						onSelect={selectCommunity}
						layoutToken={sidebarOpen}
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
