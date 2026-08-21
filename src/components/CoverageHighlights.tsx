import { Link } from "react-router-dom";
import { formatMassTime } from "../../shared/constants";
import type { CommunitySummary } from "../../shared/types";
import {
	formatDistanceKm,
	haversineKm,
	sortByDistance,
	type LatLng,
} from "../geo";

export function CoverageHighlights({
	communities,
	origin,
	onNavigate,
}: {
	communities: CommunitySummary[];
	origin?: LatLng | null;
	onNavigate?: () => void;
}) {
	const sunday = (
		origin ? sortByDistance(communities, origin) : communities
	).filter((item) => item.sunday_masses?.length > 0);

	if (sunday.length === 0) {
		return (
			<div className="coverage-highlights">
				<p className="coverage-cta">
					Sua cidade não está no mapa?{" "}
					<Link to="/informe">Informe sua comunidade</Link>
				</p>
			</div>
		);
	}

	return (
		<div className="coverage-highlights">
			<section>
				<h2>{origin ? "Missas no domingo perto de você" : "Missas neste domingo"}</h2>
				<ul className="coverage-list">
					{sunday.slice(0, 8).map((community) => (
						<li key={community.id}>
							<Link to={`/comunidade/${community.slug}`} onClick={onNavigate}>
								<strong>{community.name}</strong>
								<span>
									{origin
										? `${formatDistanceKm(haversineKm(origin, community))} · `
										: ""}
									{community.city}, {community.state} ·{" "}
									{community.sunday_masses.map(formatMassTime).join(", ")}
								</span>
							</Link>
						</li>
					))}
				</ul>
				{sunday.length > 8 ? (
					<p className="coverage-more">
						+{sunday.length - 8} comunidade{sunday.length - 8 === 1 ? "" : "s"}{" "}
						com missa no domingo
					</p>
				) : null}
			</section>
			<p className="coverage-cta">
				Não encontrou a sua? <Link to="/informe">Cadastre no mapa</Link>
			</p>
		</div>
	);
}
