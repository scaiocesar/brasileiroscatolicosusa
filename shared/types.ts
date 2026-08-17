export type CommunityStatus = "pending" | "approved" | "rejected";
export type MassLanguage = "pt" | "en" | "bilingual";

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
	"id" | "slug" | "name" | "city" | "state" | "lat" | "lng" | "address_line"
> & {
	services: string[];
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
};
