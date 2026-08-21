import { WEEKDAYS, formatMassTime } from "../shared/constants";
import type { MassSchedule } from "../shared/types";

export type LatLng = { lat: number; lng: number };

const WEEK_MINUTES = 7 * 24 * 60;

export function haversineKm(from: LatLng, to: LatLng): number {
	const toRad = (value: number) => (value * Math.PI) / 180;
	const dLat = toRad(to.lat - from.lat);
	const dLng = toRad(to.lng - from.lng);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
	return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number): string {
	if (km < 1) return `${Math.round(km * 1000)} m`;
	if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
	return `${Math.round(km)} km`;
}

export function sortByDistance<T extends LatLng>(items: T[], origin: LatLng): T[] {
	return items
		.slice()
		.sort((a, b) => haversineKm(origin, a) - haversineKm(origin, b));
}

export function formatPhoneDisplay(value: string | null | undefined): string {
	if (!value) return "";
	const digits = value.replace(/\D/g, "");
	if (digits.length === 11 && digits.startsWith("1")) {
		return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
	}
	if (digits.length === 10) {
		return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
	}
	return value.trim();
}

function scheduleMinutes(dayOfWeek: number, time: string): number {
	const match = /^(\d{2}):(\d{2})$/.exec(time);
	const hours = match ? Number(match[1]) : 0;
	const minutes = match ? Number(match[2]) : 0;
	return dayOfWeek * 24 * 60 + hours * 60 + minutes;
}

export function nextMass(
	schedules: MassSchedule[],
	now = new Date(),
): MassSchedule | null {
	if (schedules.length === 0) return null;
	const nowMinutes =
		now.getDay() * 24 * 60 + now.getHours() * 60 + now.getMinutes();

	function delta(schedule: MassSchedule): number {
		const start = scheduleMinutes(schedule.day_of_week, schedule.time);
		return (start - nowMinutes + WEEK_MINUTES) % WEEK_MINUTES;
	}

	const ranked = schedules.slice().sort((a, b) => delta(a) - delta(b));
	return ranked[0];
}

export function groupSchedulesByDay(schedules: MassSchedule[]) {
	return WEEKDAYS.flatMap((day) => {
		const items = schedules
			.filter((item) => item.day_of_week === day.id)
			.sort((a, b) => a.time.localeCompare(b.time));
		return items.length > 0 ? [{ day, items }] : [];
	});
}

export function massLine(schedule: MassSchedule): string {
	const day =
		WEEKDAYS.find((item) => item.id === schedule.day_of_week)?.label ?? "";
	return `${day} · ${formatMassTime(schedule.time)}`;
}
