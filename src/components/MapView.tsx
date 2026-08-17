import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import { US_BOUNDS, US_CENTER } from "../../shared/constants";
import type { CommunitySummary } from "../../shared/types";
import { pinIcon } from "./pinIcon";
import "leaflet/dist/leaflet.css";

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

export function MapView({
	communities,
	selectedSlug,
	onSelect,
}: {
	communities: CommunitySummary[];
	selectedSlug?: string | null;
	onSelect: (community: CommunitySummary) => void;
}) {
	const selected =
		communities.find((item) => item.slug === selectedSlug) ?? null;

	return (
		<MapContainer
			center={US_CENTER}
			zoom={4}
			minZoom={3}
			maxBounds={US_BOUNDS}
			maxBoundsViscosity={0.8}
			className="map-canvas"
			scrollWheelZoom
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
				url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
			/>
			<FlyToSelected community={selected} />
			{communities.map((community) => (
				<Marker
					key={community.id}
					position={[community.lat, community.lng]}
					icon={pinIcon(community.slug === selectedSlug)}
					eventHandlers={{
						click: () => onSelect(community),
					}}
				/>
			))}
		</MapContainer>
	);
}
