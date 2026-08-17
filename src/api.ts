import type {
	Community,
	CommunityCorrection,
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

export async function submitCorrection(
	slug: string,
	input: CommunityInput,
): Promise<{ ok: boolean; id: number }> {
	const response = await fetch(
		`/api/communities/${encodeURIComponent(slug)}/corrections`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		},
	);
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

export async function adminImportCsv(csv: string): Promise<{
	imported: number;
	skipped: number;
	errors: string[];
}> {
	const response = await fetch("/api/admin/communities/import", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ csv }),
	});
	const data = (await response.json().catch(() => null)) as {
		error?: string;
		imported?: number;
		skipped?: number;
		errors?: string[];
	} | null;
	if (!response.ok) {
		throw new Error(data?.error || "Não foi possível importar o CSV.");
	}
	return {
		imported: data?.imported ?? 0,
		skipped: data?.skipped ?? 0,
		errors: data?.errors ?? [],
	};
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

export async function adminListCorrections(
	status?: CommunityStatus,
): Promise<CommunityCorrection[]> {
	const query = status ? `?status=${status}` : "";
	const response = await fetch(`/api/admin/corrections${query}`, {
		credentials: "include",
	});
	if (!response.ok) throw new Error(await parseError(response));
	const data = (await response.json()) as {
		corrections: CommunityCorrection[];
	};
	return data.corrections;
}

export async function adminApproveCorrection(
	id: number,
	input?: CommunityInput,
): Promise<void> {
	const response = await fetch(`/api/admin/corrections/${id}/approve`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(input ?? null),
	});
	if (!response.ok) throw new Error(await parseError(response));
}

export async function adminRejectCorrection(id: number): Promise<void> {
	const response = await fetch(`/api/admin/corrections/${id}/reject`, {
		method: "POST",
		credentials: "include",
	});
	if (!response.ok) throw new Error(await parseError(response));
}
