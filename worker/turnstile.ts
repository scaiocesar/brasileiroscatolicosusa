export async function verifyTurnstile(
	secret: string | undefined,
	token: string | undefined,
	ip: string | null,
): Promise<boolean> {
	if (!secret) return true;
	if (!token) return false;

	const body = new URLSearchParams({
		secret,
		response: token,
	});
	if (ip) body.set("remoteip", ip);

	const response = await fetch(
		"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
		},
	);
	if (!response.ok) return false;
	const result = (await response.json()) as { success?: boolean };
	return Boolean(result.success);
}
