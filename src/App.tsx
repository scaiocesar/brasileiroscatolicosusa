import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminPage } from "./pages/AdminPage";
import { HomePage } from "./pages/HomePage";
import { SubmitPage } from "./pages/SubmitPage";

export default function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<HomePage />} />
				<Route path="/comunidade/:slug" element={<HomePage />} />
				<Route path="/informe" element={<SubmitPage />} />
				<Route path="/admin" element={<AdminPage />} />
			</Routes>
		</BrowserRouter>
	);
}
