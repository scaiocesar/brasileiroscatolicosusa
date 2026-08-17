import { useEffect, useState } from "react";
import {
	getCookieConsent,
	loadGoogleAnalytics,
	setCookieConsent,
	trackPageView,
} from "../analytics";

export function CookieConsentBanner() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const consent = getCookieConsent();
		if (consent === "accepted") {
			loadGoogleAnalytics();
			return;
		}
		if (!consent) setVisible(true);
	}, []);

	function accept() {
		setCookieConsent("accepted");
		loadGoogleAnalytics();
		trackPageView(
			window.location.pathname + window.location.search,
			document.title,
		);
		setVisible(false);
	}

	function deny() {
		setCookieConsent("denied");
		setVisible(false);
	}

	if (!visible) return null;

	return (
		<div className="cookie-banner" role="dialog" aria-label="Consentimento de cookies">
			<p>
				Usamos cookies do Google Analytics para entender como o mapa é usado.
				Você pode aceitar ou recusar.
			</p>
			<div className="cookie-banner-actions">
				<button type="button" className="secondary" onClick={deny}>
					Recusar
				</button>
				<button type="button" onClick={accept}>
					Aceitar
				</button>
			</div>
		</div>
	);
}
