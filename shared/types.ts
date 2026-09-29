export type CommunityStatus = "pending" | "approved" | "rejected";
export type AdminUserStatus = "active" | "blocked";
export type MassLanguage = "pt" | "en" | "bilingual";

export type AdminUser = {
	id: number;
	username: string;
	display_name: string | null;
	status: AdminUserStatus;
	created_at: string;
	updated_at: string;
	last_login_at: string | null;
};

export type AdminUserInput = {
	username: string;
	display_name?: string | null;
	password?: string;
	status?: AdminUserStatus;
};

export type MassSchedule = {
	id?: number;
	day_of_week: number;
	time: string;
	language: MassLanguage;
	notes?: string | null;
};

export type CommunityService = {
	service_type: string;
	notes?: string | null;
};

export type Community = {
	id: number;
	slug: string;
	name: string;
	description: string | null;
	address_line: string;
	city: string;
	state: string;
	zip: string | null;
	lat: number;
	lng: number;
	website_url: string | null;
	whatsapp: string | null;
	whatsapp_group_url: string | null;
	instagram: string | null;
	facebook: string | null;
	email: string | null;
	phone: string | null;
	status: CommunityStatus;
	submitted_by_name: string | null;
	submitted_by_email: string | null;
	admin_notes: string | null;
	created_at: string;
	updated_at: string;
	approved_at: string | null;
	mass_schedules: MassSchedule[];
	services: CommunityService[];
};

export type CommunitySummary = Pick<
	Community,
	| "id"
	| "slug"
	| "name"
	| "city"
	| "state"
	| "lat"
	| "lng"
	| "address_line"
	| "approved_at"
> & {
	services: string[];
	sunday_masses: string[];
};

export type CommunityInput = {
	name: string;
	description?: string | null;
	address_line: string;
	city: string;
	state: string;
	zip?: string | null;
	lat?: number | null;
	lng?: number | null;
	website_url?: string | null;
	whatsapp?: string | null;
	whatsapp_group_url?: string | null;
	instagram?: string | null;
	facebook?: string | null;
	email?: string | null;
	phone?: string | null;
	submitted_by_name?: string | null;
	submitted_by_email?: string | null;
	admin_notes?: string | null;
	status?: CommunityStatus;
	mass_schedules: MassSchedule[];
	services: CommunityService[];
	turnstile_token?: string;
	correction_note?: string | null;
};

export type CommunityCorrection = {
	id: number;
	community_id: number;
	community_name: string;
	community_slug: string;
	proposed: CommunityInput;
	note: string | null;
	submitted_by_name: string;
	submitted_by_email: string;
	status: CommunityStatus;
	created_at: string;
	reviewed_at: string | null;
};
