import { NavLink } from "react-router-dom";

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
			<nav>
				<NavLink to="/" end>
					Mapa
				</NavLink>
				<NavLink to="/informe">Informe sua comunidade</NavLink>
			</nav>
		</header>
	);
}
