export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

/**
 * Wraps a tool handler function with standardized error formatting.
 */
export function wrapToolHandler<P>(
  handler: (params: P) => Promise<ToolResult>,
): (params: P) => Promise<ToolResult> {
  return async (params: P) => {
    try {
      return await handler(params);
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  };
}
