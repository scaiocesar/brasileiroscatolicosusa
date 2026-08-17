import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import { US_BOUNDS } from "../../shared/constants";
import usa from "../data/usa.geo.json" with { type: "json" };

const WORLD_RING: [number, number][] = [
	[-180, -90],
	[180, -90],
	[180, 90],
	[-180, 90],
	[-180, -90],
];

function usHoles(collection: FeatureCollection): [number, number][][] {
	const holes: [number, number][][] = [];
	for (const feature of collection.features) {
		const geometry = feature.geometry as Polygon | MultiPolygon;
		if (geometry.type === "Polygon") {
			holes.push([...geometry.coordinates[0]].reverse() as [number, number][]);
			continue;
		}
		for (const polygon of geometry.coordinates) {
			holes.push([...polygon[0]].reverse() as [number, number][]);
		}
	}
	return holes;
}

function usMask(collection: FeatureCollection): Feature<Polygon> {
	return {
		type: "Feature",
		properties: {},
		geometry: {
			type: "Polygon",
			coordinates: [WORLD_RING, ...usHoles(collection)],
		},
	};
}

export function RestrictToUnitedStates({
	fitOnLoad = true,
}: {
	fitOnLoad?: boolean;
}) {
	const map = useMap();
	const mask = useMemo(() => usMask(usa as FeatureCollection), []);

	useEffect(() => {
		const bounds = L.latLngBounds(US_BOUNDS);
		const applyMinZoom = () => {
			const minZoom = map.getBoundsZoom(bounds, false, L.point(18, 18));
			map.setMinZoom(minZoom);
			if (map.getZoom() < minZoom) map.setZoom(minZoom);
		};

		if (fitOnLoad) {
			map.fitBounds(bounds, { padding: [18, 18], animate: false, maxZoom: 6 });
			map.setMinZoom(map.getZoom());
		} else {
			applyMinZoom();
		}

		map.on("resize", applyMinZoom);
		return () => {
			map.off("resize", applyMinZoom);
		};
	}, [fitOnLoad, map]);

	return (
		<GeoJSON
			data={mask}
			interactive={false}
			style={{
				fillColor: "#10182c",
				fillOpacity: 0.94,
				color: "#c4a35a",
				weight: 1.2,
				opacity: 0.65,
			}}
		/>
	);
}
