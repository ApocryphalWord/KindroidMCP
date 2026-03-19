import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  active_persona_id: z
    .string()
    .optional()
    .describe(
      "The ID of the user persona to set as active for the account.",
    ),
  user_name: z
    .string()
    .optional()
    .describe("User profile display name."),
  user_gender: z
    .string()
    .optional()
    .describe("User profile gender."),
  user_backstory: z
    .string()
    .optional()
    .describe("User profile backstory/description."),
  user_custom_avatar: z
    .object({
      custom_avatar_url: z
        .string()
        .url()
        .describe("URL for the custom avatar image."),
      custom_avatar_description: z
        .string()
        .optional()
        .describe("Text description of the custom avatar for generation."),
      custom_avatar_fidelity: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Avatar fidelity setting (0-1)."),
      custom_avatar_face_prompt: z
        .string()
        .optional()
        .describe(
          "Prompt used in an AIDetailer workflow to enhance the face detail of the avatar.",
        ),
      custom_avatar_face_detail: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Face detail level (0-1)."),
      avatar_is_anime: z
        .boolean()
        .optional()
        .describe("Whether the avatar should use anime style. Defaults to false."),
    })
    .optional()
    .describe(
      "Custom avatar settings for the user profile. Requires at minimum a custom_avatar_url.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "update_user_profile",
    "Update the authenticated user's profile fields or set the active persona. " +
      "Only provided fields are changed.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      await client.updateUserProfile({
        active_persona_id: params.active_persona_id,
        user_name: params.user_name,
        user_gender: params.user_gender,
        user_backstory: params.user_backstory,
        user_custom_avatar: params.user_custom_avatar,
      });

      const updated = [
        params.active_persona_id !== undefined && "active persona",
        params.user_name !== undefined && "user name",
        params.user_gender !== undefined && "user gender",
        params.user_backstory !== undefined && "user backstory",
        params.user_custom_avatar !== undefined && "user avatar",
      ].filter(Boolean);

      return {
        content: [
          {
            type: "text" as const,
            text: `User profile updated successfully. Changed: ${updated.join(", ") || "no fields specified"}.`,
          },
        ],
      };
    }),
  );
}
