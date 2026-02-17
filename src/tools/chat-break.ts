import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_id: z
    .string()
    .min(1)
    .describe("The ID of the Kindroid AI."),
  greeting: z
    .string()
    .optional()
    .describe(
      "Optional custom greeting for the AI to use when starting the new conversation.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "chat_break",
    "Start a new conversation with a Kindroid AI, clearing the previous chat context. " +
      "Optionally provide a custom greeting for the AI to use when starting the new conversation.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      await client.chatBreak({
        ai_id: params.ai_id,
        greeting: params.greeting,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Chat break successful. A new conversation has been started${params.greeting ? ` with greeting: "${params.greeting}"` : ""}.`,
          },
        ],
      };
    }),
  );
}
