import { NavLink } from "react-router-dom";
import { SITE_EMAIL } from "../../shared/seo";

export function Header({
	menuOpen,
	onToggleMenu,
}: {
	menuOpen?: boolean;
	onToggleMenu?: () => void;
}) {
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
				{onToggleMenu ? (
					<button
						type="button"
						className="header-menu-toggle"
						onClick={onToggleMenu}
						aria-expanded={menuOpen}
					>
						{menuOpen ? "Fechar busca" : "Buscar comunidades"}
					</button>
				) : null}
				<NavLink to="/" end>
					Mapa
				</NavLink>
				<NavLink to="/informe">Informe sua comunidade</NavLink>
				<a href={`mailto:${SITE_EMAIL}`}>Contato</a>
			</nav>
		</header>
	);
}
