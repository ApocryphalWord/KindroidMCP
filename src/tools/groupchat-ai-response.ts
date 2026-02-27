import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_id: z
    .string()
    .min(1)
    .describe("The ID of the Kin to respond."),
  group_id: z
    .string()
    .min(1)
    .describe("The ID of the group chat."),
  request_id: z
    .string()
    .optional()
    .describe(
      "Optional request ID for deduplication. Auto-generated if not provided.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "groupchat_ai_response",
    "Request a specific Kin to respond in a group chat. " +
      "Returns the Kin's response text. " +
      "Can be called after groupchat_get_turn (auto mode) or directly (manual mode).",
    shape,
    wrapToolHandler<Params>(async (params) => {
      const reply = await client.groupChatAiResponse({
        ai_id: params.ai_id,
        group_id: params.group_id,
        request_id: params.request_id,
      });

      return { content: [{ type: "text" as const, text: reply }] };
    }),
  );
}
