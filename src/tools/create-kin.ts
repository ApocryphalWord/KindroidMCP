import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_name: z.string().max(20).describe("The name for the new Kin. Max 20 characters."),
  ai_gender: z
    .enum(["Male", "Female"])
    .describe("The gender of the Kin."),
  ai_backstory: z
    .string()
    .describe("The backstory/personality description for the Kin."),
  custom_greeting: z
    .string()
    .optional()
    .describe(
      "Optional custom greeting the Kin will use when starting a conversation.",
    ),
  ai_directive: z
    .string()
    .optional()
    .describe(
      "Optional directive/system instruction for the Kin's behavior.",
    ),
  ai_avatar: z
    .number()
    .optional()
    .describe("Avatar preset index. Use -1 (default) for custom avatar."),
  custom_avatar_url: z
    .string()
    .url()
    .optional()
    .describe("URL for a custom avatar image."),
  custom_avatar_description: z
    .string()
    .optional()
    .describe("Text description of the custom avatar for generation."),
  custom_avatar_fidelity: z
    .number()
    .optional()
    .describe("Avatar fidelity setting (0-1)."),
  custom_avatar_face_detail: z
    .number()
    .optional()
    .describe(
      "Face detail level (0-1). Controls how heavily the face prompt is applied in the AIDetailer workflow for enhancing the avatar's face.",
    ),
  custom_avatar_face_prompt: z
    .string()
    .optional()
    .describe(
      "Prompt used in an AIDetailer workflow to enhance the face detail of the avatar.",
    ),
  avatar_is_anime: z
    .boolean()
    .optional()
    .describe(
      "Whether the avatar should use anime style. Defaults to false.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "create_kin",
    "Create a new Kindroid AI companion (Kin). " +
      "Returns the new Kin's ai_id which can be used with other tools. " +
      "Requires at minimum a name, gender, and backstory.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      const aiId = await client.createKin({
        ai_name: params.ai_name,
        ai_gender: params.ai_gender,
        ai_backstory: params.ai_backstory,
        custom_greeting: params.custom_greeting,
        ai_directive: params.ai_directive,
        ai_avatar: params.ai_avatar,
        custom_avatar_url: params.custom_avatar_url,
        custom_avatar_description: params.custom_avatar_description,
        custom_avatar_fidelity: params.custom_avatar_fidelity,
        custom_avatar_face_detail: params.custom_avatar_face_detail,
        custom_avatar_face_prompt: params.custom_avatar_face_prompt,
        avatar_is_anime: params.avatar_is_anime,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Kin "${params.ai_name}" created successfully. ai_id: ${aiId}`,
          },
        ],
      };
    }),
  );
}
