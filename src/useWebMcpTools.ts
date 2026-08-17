import type { InputSchema, ToolAnnotations } from "@mcp-b/webmcp-types";
import { useEffect, useRef } from "react";

export type WebMcpTool = {
	name: string;
	title?: string;
	description: string;
	inputSchema?: InputSchema;
	annotations?: ToolAnnotations;
	execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
};

export function useWebMcpTools(tools: WebMcpTool[]) {
	const toolsRef = useRef(tools);
	toolsRef.current = tools;
	const signature = tools.map((tool) => tool.name).join("\0");

	useEffect(() => {
		const context = document.modelContext;
		if (!context || !signature) return;

		const controller = new AbortController();
		for (const tool of toolsRef.current) {
			void context
				.registerTool(
					{
						name: tool.name,
						title: tool.title,
						description: tool.description,
						inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
						annotations: tool.annotations,
						execute: (args) => {
							const current = toolsRef.current.find(
								(item) => item.name === tool.name,
							);
							if (!current) {
								throw new Error(
									`A ferramenta ${tool.name} não está disponível.`,
								);
							}
							return current.execute(args ?? {});
						},
					},
					{ signal: controller.signal },
				)
				.catch((error: unknown) => {
					if (controller.signal.aborted) return;
					console.warn("[WebMCP] Falha ao registrar", tool.name, error);
				});
		}

		return () => controller.abort();
	}, [signature]);
}
