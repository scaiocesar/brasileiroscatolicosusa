import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import { US_CENTER } from "../../shared/constants";
import type { CommunitySummary } from "../../shared/types";
import type { LatLng } from "../geo";
import { pinIcon } from "./pinIcon";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

function InvalidateSize({ token }: { token: boolean }) {
	const map = useMap();
	useEffect(() => {
		const id = window.requestAnimationFrame(() => map.invalidateSize());
		return () => window.cancelAnimationFrame(id);
	}, [map, token]);
	return null;
}

function FlyToSelected({
	community,
}: {
	community: CommunitySummary | null;
}) {
	const map = useMap();
	useEffect(() => {
		if (!community) return;
		const isMobile = window.matchMedia("(max-width: 900px)").matches;
		map.flyTo([community.lat, community.lng], isMobile ? 12 : 11, {
			duration: 0.8,
		});
		if (!isMobile) return;

		const onMoveEnd = () => {
			map.panBy([0, Math.round(map.getSize().y * 0.22)], {
				animate: true,
				duration: 0.35,
			});
			map.off("moveend", onMoveEnd);
		};
		map.on("moveend", onMoveEnd);
		return () => {
			map.off("moveend", onMoveEnd);
		};
	}, [community, map]);
	return null;
}

function FlyToOrigin({
	origin,
	token,
}: {
	origin: LatLng | null;
	token: number;
}) {
	const map = useMap();
	useEffect(() => {
		if (!origin || !token) return;
		map.flyTo([origin.lat, origin.lng], 10, { duration: 0.8 });
	}, [map, origin, token]);
	return null;
}

function ClusteredMarkers({
	communities,
	selectedSlug,
	onSelect,
}: {
	communities: CommunitySummary[];
	selectedSlug?: string | null;
	onSelect: (community: CommunitySummary) => void;
}) {
	const map = useMap();
	const onSelectRef = useRef(onSelect);
	onSelectRef.current = onSelect;

	useEffect(() => {
		const clusterOptions = {
			showCoverageOnHover: false,
			maxClusterRadius: 46,
			spiderfyOnMaxZoom: true,
			disableClusteringAtZoom: 12,
			iconCreateFunction(cluster: L.MarkerCluster) {
				const count = cluster.getChildCount();
				return L.divIcon({
					html: `<span>${count}</span>`,
					className: "map-cluster",
					iconSize: L.point(40, 40),
				});
			},
		};
		const group =
			typeof L.markerClusterGroup === "function"
				? L.markerClusterGroup(clusterOptions)
				: L.layerGroup();

		for (const community of communities) {
			const marker = L.marker([community.lat, community.lng], {
				icon: pinIcon(community.slug === selectedSlug),
				title: `${community.name} — ${community.city}, ${community.state}`,
				alt: community.name,
			});
			marker.on("click", () => onSelectRef.current(community));
			group.addLayer(marker);
		}

		map.addLayer(group);
		return () => {
			map.removeLayer(group);
		};
	}, [communities, map, selectedSlug]);

	return null;
}

function UserMarker({ origin }: { origin: LatLng | null }) {
	const map = useMap();
	useEffect(() => {
		if (!origin) return;
		const marker = L.circleMarker([origin.lat, origin.lng], {
			radius: 8,
			color: "#c4a35a",
			weight: 2,
			fillColor: "#1b2a4a",
			fillOpacity: 0.9,
		});
		marker.bindTooltip("Você está aqui", { direction: "top" });
		map.addLayer(marker);
		return () => {
			map.removeLayer(marker);
		};
	}, [map, origin]);
	return null;
}

export function MapView({
	communities,
	selectedSlug,
	onSelect,
	layoutToken,
	origin,
	originToken,
}: {
	communities: CommunitySummary[];
	selectedSlug?: string | null;
	onSelect: (community: CommunitySummary) => void;
	layoutToken?: boolean;
	origin?: LatLng | null;
	originToken?: number;
}) {
	const selected =
		communities.find((item) => item.slug === selectedSlug) ?? null;

	return (
		<MapContainer
			center={US_CENTER}
			zoom={4}
			minZoom={3}
			className="map-canvas"
			scrollWheelZoom
			zoomControl={false}
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
				url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
			/>
			<ZoomControl position="bottomright" />
			<InvalidateSize token={Boolean(layoutToken)} />
			<FlyToOrigin origin={origin ?? null} token={originToken ?? 0} />
			<FlyToSelected community={selected} />
			<UserMarker origin={origin ?? null} />
			<ClusteredMarkers
				communities={communities}
				selectedSlug={selectedSlug}
				onSelect={onSelect}
			/>
		</MapContainer>
	);
}
