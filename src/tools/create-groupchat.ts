import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_list: z
    .array(z.string().min(1))
    .min(1)
    .describe("Array of Kin AI IDs to include in the group chat."),
  group_name: z
    .string()
    .min(1)
    .describe("The name for the group chat."),
  group_context: z
    .string()
    .max(3000)
    .optional()
    .describe(
      "Backstory and context for how the Kindroids should relate to each other. " +
        "Character limits vary by subscription: Base 1000, Ultra 1500, MAX 3000.",
    ),
  group_directive: z
    .string()
    .optional()
    .describe(
      "A strong suggestion for all Kindroids in the group, e.g. \"be concise\", \"speak in 3rd person\". " +
        "Added on top of individual Kin directives if both exist.",
    ),
  use_manual_turntaking: z
    .boolean()
    .optional()
    .describe(
      "If true, the user manually triggers each Kin's turn. " +
        "If false (default), Kins speak automatically.",
    ),
  share_short_term_memory: z
    .boolean()
    .optional()
    .describe(
      "Whether short-term memory from this group chat is shared with each participant's solo chats. Defaults to false.",
    ),
  disable_ltm_recall: z
    .boolean()
    .optional()
    .describe(
      "If true, long-term memories will not be recalled in this group chat. Defaults to false.",
    ),
  disable_ltm_consolidate: z
    .boolean()
    .optional()
    .describe(
      "If true, long-term memories will not be created from this group chat. Defaults to false.",
    ),
  user_persona_id: z
    .string()
    .optional()
    .describe("Optional user persona ID to use in this group chat."),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "create_groupchat",
    "Create a new group chat with multiple Kindroid AI companions. " +
      "Returns the new group chat's ID. " +
      "Requires at minimum a list of Kin IDs and a group name.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      const groupId = await client.createGroupChat({
        ai_list: params.ai_list,
        group_name: params.group_name,
        group_context: params.group_context,
        group_directive: params.group_directive,
        use_manual_turntaking: params.use_manual_turntaking,
        share_short_term_memory: params.share_short_term_memory,
        disable_ltm_recall: params.disable_ltm_recall,
        disable_ltm_consolidate: params.disable_ltm_consolidate,
        user_persona_id: params.user_persona_id,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Group chat "${params.group_name}" created successfully. group_id: ${groupId}`,
          },
        ],
      };
    }),
  );
}
