import { useEffect, useRef } from "react";

declare global {
	interface Window {
		turnstile?: {
			render: (
				element: HTMLElement,
				options: {
					sitekey: string;
					callback: (token: string) => void;
					"expired-callback"?: () => void;
				},
			) => string;
			remove: (id: string) => void;
			reset: (id: string) => void;
		};
	}
}

export function TurnstileWidget({
	siteKey,
	onToken,
}: {
	siteKey: string;
	onToken: (token: string) => void;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const widgetId = useRef<string | null>(null);
	const onTokenRef = useRef(onToken);
	onTokenRef.current = onToken;

	useEffect(() => {
		if (!siteKey || !hostRef.current) return;

		const render = () => {
			if (!hostRef.current || !window.turnstile || widgetId.current) return;
			widgetId.current = window.turnstile.render(hostRef.current, {
				sitekey: siteKey,
				callback: (token) => onTokenRef.current(token),
				"expired-callback": () => onTokenRef.current(""),
			});
		};

		if (window.turnstile) {
			render();
		} else {
			const script = document.createElement("script");
			script.src =
				"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
			script.async = true;
			script.onload = render;
			document.head.appendChild(script);
		}

		return () => {
			if (widgetId.current && window.turnstile) {
				window.turnstile.remove(widgetId.current);
				widgetId.current = null;
			}
		};
	}, [siteKey]);

	if (!siteKey) return null;
	return <div className="turnstile" ref={hostRef} />;
}
