import { useEffect, useState } from "react";
import { TileLayer } from "react-leaflet";
import { fetchConfig } from "../api";

const CARTO_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const OSM_ATTRIBUTION =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function cartoUrl(key: string) {
	return `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(key)}`;
}

export function BasemapLayer() {
	const [tiles, setTiles] = useState<{
		url: string;
		attribution: string;
	} | null>(null);

	useEffect(() => {
		let cancelled = false;
		fetchConfig()
			.then((config) => {
				if (cancelled) return;
				if (config.cartoApiKey) {
					setTiles({
						url: cartoUrl(config.cartoApiKey),
						attribution: CARTO_ATTRIBUTION,
					});
					return;
				}
				setTiles({ url: OSM_URL, attribution: OSM_ATTRIBUTION });
			})
			.catch(() => {
				if (!cancelled) {
					setTiles({ url: OSM_URL, attribution: OSM_ATTRIBUTION });
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	if (!tiles) return null;
	return <TileLayer attribution={tiles.attribution} url={tiles.url} />;
}
