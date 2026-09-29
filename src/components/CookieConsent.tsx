import { useEffect, useState } from "react";
import {
	denyAnalyticsConsent,
	getCookieConsent,
	grantAnalyticsConsent,
	initGoogleAnalytics,
	trackPageView,
} from "../analytics";

export function CookieConsentBanner() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		initGoogleAnalytics();
		const consent = getCookieConsent();
		if (!consent) setVisible(true);
	}, []);

	function accept() {
		grantAnalyticsConsent();
		trackPageView(
			window.location.pathname + window.location.search,
			document.title,
		);
		setVisible(false);
	}

	function deny() {
		denyAnalyticsConsent();
		setVisible(false);
	}

	if (!visible) return null;

	return (
		<div className="cookie-banner" role="dialog" aria-label="Consentimento de cookies">
			<p>
				Usamos cookies do Google Analytics para entender o uso do mapa.
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
