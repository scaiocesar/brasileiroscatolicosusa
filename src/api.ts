import type {
	Community,
	CommunityInput,
	CommunityStatus,
	CommunitySummary,
} from "../shared/types";

async function parseError(response: Response): Promise<string> {
	try {
		const data = (await response.json()) as { error?: string };
		return data.error || "Algo deu errado. Tente novamente.";
	} catch {
		return "Algo deu errado. Tente novamente.";
	}
}

export async function fetchConfig(): Promise<{ turnstileSiteKey: string }> {
	const response = await fetch("/api/config");
	if (!response.ok) return { turnstileSiteKey: "" };
	return response.json();
}

export async function fetchCommunities(): Promise<CommunitySummary[]> {
	const response = await fetch("/api/communities");
	if (!response.ok) throw new Error(await parseError(response));
	const data = (await response.json()) as { communities: CommunitySummary[] };
	return data.communities;
}

export async function fetchCommunity(slug: string): Promise<Community> {
	const response = await fetch(`/api/communities/${encodeURIComponent(slug)}`);
	if (!response.ok) throw new Error(await parseError(response));
	const data = (await response.json()) as { community: Community };
	return data.community;
}

export async function geocodeAddress(input: {
	address_line: string;
	city: string;
	state: string;
	zip?: string;
}): Promise<{ lat: number; lng: number; displayName: string }> {
	const response = await fetch("/api/geocode", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!response.ok) throw new Error(await parseError(response));
	return response.json();
}

export async function submitCommunity(
	input: CommunityInput,
): Promise<{ ok: boolean; slug: string }> {
	const response = await fetch("/api/submissions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!response.ok) throw new Error(await parseError(response));
	return response.json();
}

export async function adminLogin(
	username: string,
	password: string,
	turnstileToken?: string,
): Promise<void> {
	const response = await fetch("/api/admin/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({
			username,
			password,
			turnstile_token: turnstileToken,
		}),
	});
	if (!response.ok) throw new Error(await parseError(response));
}

export async function adminLogout(): Promise<void> {
	await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
}

export async function adminMe(): Promise<boolean> {
	const response = await fetch("/api/admin/me", { credentials: "include" });
	return response.ok;
}

export async function adminList(
	status?: CommunityStatus,
): Promise<Community[]> {
	const query = status ? `?status=${status}` : "";
	const response = await fetch(`/api/admin/communities${query}`, {
		credentials: "include",
	});
	if (!response.ok) throw new Error(await parseError(response));
	const data = (await response.json()) as { communities: Community[] };
	return data.communities;
}

export async function adminSave(
	input: CommunityInput,
	id?: number,
): Promise<Community> {
	const response = await fetch(
		id ? `/api/admin/communities/${id}` : "/api/admin/communities",
		{
			method: id ? "PUT" : "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify(input),
		},
	);
	if (!response.ok) throw new Error(await parseError(response));
	const data = (await response.json()) as { community: Community };
	return data.community;
}

export async function adminSetStatus(
	id: number,
	action: "approve" | "reject",
): Promise<Community> {
	const response = await fetch(`/api/admin/communities/${id}/${action}`, {
		method: "POST",
		credentials: "include",
	});
	if (!response.ok) throw new Error(await parseError(response));
	const data = (await response.json()) as { community: Community };
	return data.community;
}

export async function adminDelete(id: number): Promise<void> {
	const response = await fetch(`/api/admin/communities/${id}`, {
		method: "DELETE",
		credentials: "include",
	});
	if (!response.ok) throw new Error(await parseError(response));
}
