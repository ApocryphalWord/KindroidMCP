import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_id: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The ID of the Kin whose solo chat history to fetch. Provide exactly one of ai_id or group_id.",
    ),
  group_id: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The ID of the group chat whose history to fetch. Provide exactly one of ai_id or group_id.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Page size (1-100). Defaults to 50."),
  start_after_timestamp: z
    .number()
    .optional()
    .describe(
      "Pagination cursor. Pass the previous page's pagination.lastTimestamp to fetch the next page.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "get_chat_messages",
    "Retrieve chat history for a Kin (solo chat) or a group chat, oldest first, " +
      "with cursor pagination. Returns messages and a pagination object; pass " +
      "pagination.lastTimestamp back as start_after_timestamp to page until hasMore is false.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      const hasAi = !!params.ai_id;
      const hasGroup = !!params.group_id;
      if (hasAi === hasGroup) {
        throw new Error("Provide exactly one of ai_id or group_id.");
      }

      const result = await client.getChatMessages({
        ai_id: params.ai_id,
        group_id: params.group_id,
        limit: params.limit,
        start_after_timestamp: params.start_after_timestamp,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }),
  );
}
