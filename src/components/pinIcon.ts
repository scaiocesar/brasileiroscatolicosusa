import L from "leaflet";

export function pinIcon(active = false) {
	return L.divIcon({
		className: `map-pin${active ? " is-active" : ""}`,
		html: "<i></i>",
		iconSize: [28, 36],
		iconAnchor: [14, 36],
		popupAnchor: [0, -32],
	});
}
