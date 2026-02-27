import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  group_id: z
    .string()
    .min(1)
    .describe("The ID of the group chat."),
  allow_user: z
    .boolean()
    .optional()
    .describe(
      "Whether the user can be selected as the next speaker. Defaults to true.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "groupchat_get_turn",
    "Determine which Kin should respond next in a group chat. " +
      "Returns the ai_id of the next speaker. " +
      "Used in automatic turn-taking mode.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      const aiId = await client.groupChatGetTurn({
        group_id: params.group_id,
        allow_user: params.allow_user,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Next speaker ai_id: ${aiId}`,
          },
        ],
      };
    }),
  );
}
