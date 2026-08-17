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
		map.flyTo([community.lat, community.lng], 11, { duration: 0.8 });
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
