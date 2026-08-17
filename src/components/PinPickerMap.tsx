import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { US_BOUNDS, US_CENTER } from "../../shared/constants";
import { pinIcon } from "./pinIcon";
import "leaflet/dist/leaflet.css";

function ClickToPlace({
	onChange,
}: {
	onChange: (lat: number, lng: number) => void;
}) {
	useMapEvents({
		click(event) {
			onChange(event.latlng.lat, event.latlng.lng);
		},
	});
	return null;
}

function Recenter({
	lat,
	lng,
	token,
}: {
	lat: number;
	lng: number;
	token: number;
}) {
	const map = useMap();
	useEffect(() => {
		if (!token) return;
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
		map.setView([lat, lng], Math.max(map.getZoom(), 12));
	}, [lat, lng, map, token]);
	return null;
}

export function PinPickerMap({
	lat,
	lng,
	onChange,
	focusToken = 0,
}: {
	lat?: number | null;
	lng?: number | null;
	onChange: (lat: number, lng: number) => void;
	focusToken?: number;
}) {
	const position: [number, number] = [
		lat ?? US_CENTER[0],
		lng ?? US_CENTER[1],
	];

	return (
		<div className="pin-picker">
			<MapContainer
				center={position}
				zoom={lat && lng ? 13 : 4}
				className="pin-picker-map"
				scrollWheelZoom
				maxBounds={US_BOUNDS}
			>
				<TileLayer
					attribution="&copy; OpenStreetMap &copy; CARTO"
					url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
				/>
				<ClickToPlace onChange={onChange} />
				<Recenter lat={position[0]} lng={position[1]} token={focusToken} />
				<Marker
					draggable
					position={position}
					icon={pinIcon(true)}
					eventHandlers={{
						dragend: (event) => {
							const next = event.target.getLatLng();
							onChange(next.lat, next.lng);
						},
					}}
				/>
			</MapContainer>
			<p className="hint">
				Clique no mapa ou arraste o pin para ajustar a localização.
			</p>
		</div>
	);
}
