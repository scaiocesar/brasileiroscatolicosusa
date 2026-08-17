import { Link } from "react-router-dom";
import { US_STATES, formatMassTime } from "../../shared/constants";
import type { CommunitySummary } from "../../shared/types";

export function CoverageHighlights({
	communities,
	onNavigate,
}: {
	communities: CommunitySummary[];
	onNavigate?: () => void;
}) {
	const present = new Set(communities.map((item) => item.state));
	const emptyStates = US_STATES.filter((state) => !present.has(state.code));
	const sunday = communities
		.filter((item) => item.sunday_masses?.length > 0)
		.slice()
		.sort((a, b) => a.name.localeCompare(b.name, "pt"));
	const recent = communities
		.filter((item) => item.approved_at)
		.slice()
		.sort((a, b) => (b.approved_at ?? "").localeCompare(a.approved_at ?? ""))
		.slice(0, 5);

	return (
		<div className="coverage-highlights">
			{sunday.length > 0 ? (
				<section>
					<h2>Missas neste domingo</h2>
					<ul className="coverage-list">
						{sunday.slice(0, 8).map((community) => (
							<li key={community.id}>
								<Link to={`/comunidade/${community.slug}`} onClick={onNavigate}>
									<strong>{community.name}</strong>
									<span>
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
			) : null}

			{recent.length > 0 ? (
				<section>
					<h2>Recém-aprovadas</h2>
					<ul className="coverage-list">
						{recent.map((community) => (
							<li key={community.id}>
								<Link to={`/comunidade/${community.slug}`} onClick={onNavigate}>
									<strong>{community.name}</strong>
									<span>
										{community.city}, {community.state}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			) : null}

			<details className="coverage-states">
				<summary>
					Estados sem comunidade ({emptyStates.length})
				</summary>
				<p>
					Há comunidades em {present.size} estado{present.size === 1 ? "" : "s"}.
					Ainda faltam:
				</p>
				<ul className="chip-list">
					{emptyStates.map((state) => (
						<li key={state.code} title={state.name}>
							{state.code}
						</li>
					))}
				</ul>
			</details>
		</div>
	);
}
