import type {
	CommunityCorrection,
	CommunityInput,
	CommunityStatus,
} from "../shared/types";

type CorrectionRow = {
	id: number;
	community_id: number;
	community_name: string;
	community_slug: string;
	payload: string;
	note: string | null;
	submitted_by_name: string;
	submitted_by_email: string;
	status: CommunityStatus;
	created_at: string;
	reviewed_at: string | null;
};

export function sanitizeProposed(input: CommunityInput): CommunityInput {
	return {
		name: input.name,
		description: input.description ?? null,
		address_line: input.address_line,
		city: input.city,
		state: input.state,
		zip: input.zip ?? null,
		lat: input.lat ?? null,
		lng: input.lng ?? null,
		website_url: input.website_url ?? null,
		whatsapp: input.whatsapp ?? null,
		whatsapp_group_url: input.whatsapp_group_url ?? null,
		instagram: input.instagram ?? null,
		facebook: input.facebook ?? null,
		email: input.email ?? null,
		phone: input.phone ?? null,
		mass_schedules: input.mass_schedules ?? [],
		services: input.services ?? [],
	};
}

function parseRow(row: CorrectionRow): CommunityCorrection | null {
	try {
		const proposed = JSON.parse(row.payload) as CommunityInput;
		return {
			id: row.id,
			community_id: row.community_id,
			community_name: row.community_name,
			community_slug: row.community_slug,
			proposed,
			note: row.note,
			submitted_by_name: row.submitted_by_name,
			submitted_by_email: row.submitted_by_email,
			status: row.status,
			created_at: row.created_at,
			reviewed_at: row.reviewed_at,
		};
	} catch {
		return null;
	}
}

export async function createCorrection(
	db: D1Database,
	communityId: number,
	input: CommunityInput,
): Promise<CommunityCorrection> {
	const proposed = sanitizeProposed(input);
	const result = await db
		.prepare(
			`INSERT INTO community_corrections (
        community_id, payload, note, submitted_by_name, submitted_by_email, status
      ) VALUES (?, ?, ?, ?, ?, 'pending')`,
		)
		.bind(
			communityId,
			JSON.stringify(proposed),
			input.correction_note?.trim() || null,
			input.submitted_by_name?.trim() ?? "",
			input.submitted_by_email?.trim() ?? "",
		)
		.run();

	const created = await getCorrection(db, Number(result.meta.last_row_id));
	if (!created) throw new Error("Falha ao registrar a correção.");
	return created;
}

export async function getCorrection(
	db: D1Database,
	id: number,
): Promise<CommunityCorrection | null> {
	const row = await db
		.prepare(
			`SELECT c.id, c.community_id, comm.name AS community_name, comm.slug AS community_slug,
        c.payload, c.note, c.submitted_by_name, c.submitted_by_email, c.status,
        c.created_at, c.reviewed_at
       FROM community_corrections c
       JOIN communities comm ON comm.id = c.community_id
       WHERE c.id = ?`,
		)
		.bind(id)
		.first<CorrectionRow>();
	return row ? parseRow(row) : null;
}

export async function listCorrections(
	db: D1Database,
	status?: CommunityStatus,
): Promise<CommunityCorrection[]> {
	const query = status
		? db
				.prepare(
					`SELECT c.id, c.community_id, comm.name AS community_name, comm.slug AS community_slug,
            c.payload, c.note, c.submitted_by_name, c.submitted_by_email, c.status,
            c.created_at, c.reviewed_at
           FROM community_corrections c
           JOIN communities comm ON comm.id = c.community_id
           WHERE c.status = ?
           ORDER BY datetime(c.created_at) DESC`,
				)
				.bind(status)
		: db.prepare(
				`SELECT c.id, c.community_id, comm.name AS community_name, comm.slug AS community_slug,
          c.payload, c.note, c.submitted_by_name, c.submitted_by_email, c.status,
          c.created_at, c.reviewed_at
         FROM community_corrections c
         JOIN communities comm ON comm.id = c.community_id
         ORDER BY CASE c.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
           datetime(c.created_at) DESC`,
			);

	const rows = await query.all<CorrectionRow>();
	return (rows.results ?? [])
		.map(parseRow)
		.filter((item): item is CommunityCorrection => item != null);
}

export async function setCorrectionStatus(
	db: D1Database,
	id: number,
	status: Exclude<CommunityStatus, "pending">,
): Promise<CommunityCorrection | null> {
	const result = await db
		.prepare(
			`UPDATE community_corrections
       SET status = ?, reviewed_at = datetime('now')
       WHERE id = ?`,
		)
		.bind(status, id)
		.run();
	if (!result.meta.changes) return null;
	return getCorrection(db, id);
}
