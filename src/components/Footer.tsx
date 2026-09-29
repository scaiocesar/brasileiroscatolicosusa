import { APOSTOLADO_NAME, APOSTOLADO_URL } from "../../shared/seo";

export function Footer() {
	return (
		<footer className="site-footer">
			<p>
				Em parceria com o{" "}
				<a href={APOSTOLADO_URL} target="_blank" rel="noopener noreferrer">
					{APOSTOLADO_NAME}
				</a>
			</p>
		</footer>
	);
}
