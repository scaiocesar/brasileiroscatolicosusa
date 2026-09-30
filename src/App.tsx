import { useEffect } from "react";
import {
	BrowserRouter,
	Route,
	Routes,
	useLocation,
	useNavigate,
} from "react-router-dom";
import { initGoogleAnalytics, trackPageView } from "./analytics";
import { CookieConsentBanner } from "./components/CookieConsent";
import { AdminBackupPage } from "./pages/AdminBackupPage";
import { AdminPage } from "./pages/AdminPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import { CorrectPage } from "./pages/CorrectPage";
import { HomePage } from "./pages/HomePage";
import { SubmitPage } from "./pages/SubmitPage";
import { useWebMcpTools, type WebMcpTool } from "./useWebMcpTools";

function Analytics() {
	const location = useLocation();
	useEffect(() => {
		initGoogleAnalytics();
	}, []);
	useEffect(() => {
		trackPageView(location.pathname + location.search, document.title);
	}, [location]);
	return null;
}

function WebMcpNavigation() {
	const navigate = useNavigate();
	const location = useLocation();
	const path = location.pathname.replace(/\/+$/, "") || "/";
	const onMap = path === "/" || /^\/comunidade\/[^/]+$/.test(path);
	const onSubmit = path === "/informe";

	const tools: WebMcpTool[] = [
		...(onMap
			? []
			: [
					{
						name: "go_to_map",
						title: "Abrir o mapa",
						description:
							"Abre o mapa de comunidades católicas brasileiras nos Estados Unidos.",
						inputSchema: { type: "object", properties: {} },
						annotations: { readOnlyHint: false, idempotentHint: true },
						execute: () => {
							navigate("/");
							return { ok: true, path: "/" };
						},
					} satisfies WebMcpTool,
				]),
		...(onSubmit
			? []
			: [
					{
						name: "go_to_submit_form",
						title: "Informar comunidade",
						description:
							"Abre o formulário público para cadastrar uma comunidade católica brasileira. O envio exige confirmação humana (anti-spam).",
						inputSchema: { type: "object", properties: {} },
						annotations: { readOnlyHint: false, idempotentHint: true },
						execute: () => {
							navigate("/informe");
							return { ok: true, path: "/informe" };
						},
					} satisfies WebMcpTool,
				]),
	];
	useWebMcpTools(tools);
	return null;
}

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/comunidade/:slug" element={<HomePage />} />
				<Route path="/comunidade/:slug/corrigir" element={<CorrectPage />} />
				<Route path="/informe" element={<SubmitPage />} />
				<Route path="/admin" element={<AdminPage />} />
				<Route path="/admin/backup" element={<AdminBackupPage />} />
				<Route path="/admin/usuarios" element={<AdminUsersPage />} />
			</Routes>
			<Analytics />
			<CookieConsentBanner />
			<WebMcpNavigation />
		</BrowserRouter>
	);
}
