import type { Community, CommunityStatus } from "./types";

export type SheetCell = string | number | null;

export const COMMUNITY_EXCEL_HEADERS = [
	"Nome",
	"Estado",
	"Cidade",
	"Endereço",
	"Telefone",
	"Email",
	"Whats",
] as const;

/** Converte uma comunidade em uma linha tabular (sem cabeçalho). */
export function communityToExcelRow(community: Community): SheetCell[] {
	return [
		community.name,
		community.state,
		community.city,
		community.address_line,
		community.phone ?? "",
		community.email ?? "",
		community.whatsapp ?? "",
	];
}

/** Monta os dados da planilha: primeira linha = cabeçalhos. */
export function communitiesToSheetData(
	communities: Community[],
): SheetCell[][] {
	return [
		[...COMMUNITY_EXCEL_HEADERS],
		...communities.map((community) => communityToExcelRow(community)),
	];
}

export function defaultCommunitiesExportFileName(
	filter: "" | CommunityStatus = "",
): string {
	const stamp = new Date().toISOString().slice(0, 10);
	if (!filter) return `comunidades-${stamp}.xlsx`;
	return `comunidades-${filter}-${stamp}.xlsx`;
}

/** Gera o arquivo `.xlsx` e dispara o download no navegador. */
export async function downloadCommunitiesExcel(
	communities: Community[],
	options?: { fileName?: string },
): Promise<void> {
	const { default: writeExcelFile } = await import("write-excel-file/browser");
	const sheetData = communitiesToSheetData(communities);
	const fileName =
		options?.fileName ?? defaultCommunitiesExportFileName();
	await writeExcelFile(sheetData).toFile(fileName);
}
