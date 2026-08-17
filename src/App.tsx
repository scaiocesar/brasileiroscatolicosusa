import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { GA_MEASUREMENT_ID } from "../shared/seo";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { SubmitPage } from "./pages/SubmitPage";

declare global {
	interface Window {
		dataLayer: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

function Analytics() {
	const location = useLocation();
	useEffect(() => {
		window.gtag?.("event", "page_view", {
			page_title: document.title,
			page_location: window.location.href,
			page_path: location.pathname + location.search,
			send_to: GA_MEASUREMENT_ID,
		});
	}, [location]);
	return null;
}

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/comunidade/:slug" element={<HomePage />} />
				<Route path="/informe" element={<SubmitPage />} />
				<Route path="/admin" element={<AdminPage />} />
			</Routes>
			<Analytics />
		</BrowserRouter>
	);
}
