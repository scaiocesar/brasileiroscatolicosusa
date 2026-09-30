import { NavLink } from "react-router-dom";

export function AdminNav() {
	return (
		<nav className="admin-nav" aria-label="Menu do painel">
			<NavLink to="/admin" end>
				Comunidades
			</NavLink>
			<NavLink to="/admin/backup">Backup</NavLink>
			<NavLink to="/admin/usuarios">Usuários admin</NavLink>
		</nav>
	);
}
