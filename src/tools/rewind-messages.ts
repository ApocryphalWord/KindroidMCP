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
      "The ID of the Kin (solo chat) to rewind. Provide exactly one of ai_id or group_id.",
    ),
  group_id: z
    .string()
    .min(1)
    .optional()
    .describe(
      "The ID of the group chat to rewind. Provide exactly one of ai_id or group_id.",
    ),
  count: z
    .number()
    .int()
    .min(1)
    .describe(
      "Number of most-recent messages to remove. For a solo chat (ai_id) this MUST be even " +
        "(it removes whole user/AI exchanges). Group chats (group_id) accept any count.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "rewind_messages",
    "Remove the most recent messages from a Kin's solo chat or a group chat (an \"undo\"). " +
      "Useful for discarding the last exchange before continuing.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      const hasAi = !!params.ai_id;
      const hasGroup = !!params.group_id;
      if (hasAi === hasGroup) {
        throw new Error("Provide exactly one of ai_id or group_id.");
      }
      if (hasAi && params.count % 2 !== 0) {
        throw new Error(
          "For solo (ai_id) rewinds, count must be even (whole user/AI exchanges).",
        );
      }

      await client.rewindMessages({
        ai_id: params.ai_id,
        group_id: params.group_id,
        count: params.count,
      });

      const target = hasAi ? `Kin "${params.ai_id}"` : `group chat "${params.group_id}"`;
      return {
        content: [
          {
            type: "text" as const,
            text: `Rewound ${params.count} message(s) from ${target}.`,
          },
        ],
      };
    }),
  );
}
