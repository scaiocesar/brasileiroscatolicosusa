import { useEffect } from "react";
import { MapContainer, Marker, useMap, useMapEvents } from "react-leaflet";
import { BasemapLayer } from "./BasemapLayer";
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
	if (
		lat == null ||
		lng == null ||
		!Number.isFinite(lat) ||
		!Number.isFinite(lng)
	) {
		return (
			<div className="pin-picker pin-picker-empty">
				<p className="hint">
					Preencha o endereço e clique em Localizar no mapa para posicionar o
					pin. Evite deixar o marcador no centro do país.
				</p>
			</div>
		);
	}

	const position: [number, number] = [lat, lng];

	return (
		<div className="pin-picker">
			<MapContainer
				center={position}
				zoom={13}
				maxZoom={19}
				className="pin-picker-map"
				scrollWheelZoom
			>
				<BasemapLayer />
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
