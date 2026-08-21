import { NavLink } from "react-router-dom";
import { SITE_EMAIL } from "../../shared/seo";

export function Header() {
	return (
		<header className="site-header">
			<NavLink to="/" className="brand">
				<span className="brand-mark" aria-hidden="true" />
				<span>
					<strong>Brasileiros Católicos</strong>
					<small>Comunidades nos EUA</small>
				</span>
			</NavLink>
			<nav aria-label="Navegação principal">
				<NavLink to="/" end>
					Mapa
				</NavLink>
				<NavLink to="/informe" className="nav-cta">
					Informe sua comunidade
				</NavLink>
				<a href={`mailto:${SITE_EMAIL}`}>Contato</a>
			</nav>
		</header>
	);
}
