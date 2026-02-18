import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { KindroidClient } from "../kindroid-client.js";
import { wrapToolHandler } from "./tool-utils.js";

const shape = {
  ai_id: z
    .string()
    .min(1)
    .describe("The ID of the Kindroid AI to update."),
  ai_name: z
    .string()
    .max(20)
    .optional()
    .describe("The Kin's display name. Max 20 characters."),
  ai_gender: z
    .enum(["Male", "Female"])
    .optional()
    .describe("The Kin's gender."),
  ai_backstory: z
    .string()
    .optional()
    .describe(
      "The Kin's backstory — their personality, history, and character description.",
    ),
  ai_memory: z
    .string()
    .optional()
    .describe(
      "Key Memories — important facts the Kin should remember across conversations.",
    ),
  ai_example_message: z
    .string()
    .optional()
    .describe(
      "Example Message — a sample message showing how the Kin should write/respond.",
    ),
  ai_directive: z
    .string()
    .optional()
    .describe(
      "Response Directive — instructions that guide how the Kin formats and styles its responses.",
    ),
  ai_additional_context: z
    .string()
    .optional()
    .describe(
      "Additional Context — extra background information or context for the Kin to reference.",
    ),
  ai_avatar: z
    .number()
    .optional()
    .describe("Avatar preset index. Use -1 for custom avatar."),
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
  unset_custom_avatar_animation: z
    .boolean()
    .optional()
    .describe("Whether to unset any custom avatar animation."),
  user_set_temperature: z
    .number()
    .min(0.6)
    .max(1.8)
    .optional()
    .describe(
      "Dynamism setting (0.6–1.8, default 0.95). Controls how creative/unpredictable the Kin's responses are.",
    ),
  reasoning_effort: z
    .enum(["none", "low", "med", "high", "xhigh"])
    .optional()
    .describe("Reasoning effort level for the Kin's responses."),
  llm_flair: z
    .enum(["companion", "roleplay", "narrative", "classic", "minimal"])
    .optional()
    .describe("LLM flair/style preset for the Kin's responses."),
  proactive_mode: z
    .boolean()
    .optional()
    .describe(
      "Enable proactive mode for this Kin. Note: only 10 Kins per account can have proactive mode enabled.",
    ),
  proactive_action_directive: z
    .string()
    .max(300)
    .optional()
    .describe(
      "Instructions for how the Kin should proactively message, call, or send selfies. Max 300 characters.",
    ),
  time_awareness: z
    .boolean()
    .optional()
    .describe(
      "Enable time awareness so the Kin knows the current time during conversations.",
    ),
  show_auto_selfies_in_chat: z
    .boolean()
    .optional()
    .describe(
      "Whether auto-generated selfies are shown in the chat.",
    ),
} as const;

type Params = z.infer<z.ZodObject<typeof shape>>;

export function register(
  server: McpServer,
  client: KindroidClient,
): void {
  server.tool(
    "update_kin",
    "Update a Kindroid AI companion's profile fields. " +
      "You can update any combination of backstory, key memories, example message, " +
      "response directive, additional context, and avatar settings. Only provided fields are changed.",
    shape,
    wrapToolHandler<Params>(async (params) => {
      await client.updateKin({
        ai_id: params.ai_id,
        ai_name: params.ai_name,
        ai_gender: params.ai_gender,
        ai_backstory: params.ai_backstory,
        ai_memory: params.ai_memory,
        ai_example_message: params.ai_example_message,
        ai_directive: params.ai_directive,
        ai_additional_context: params.ai_additional_context,
        ai_avatar: params.ai_avatar,
        custom_avatar_url: params.custom_avatar_url,
        custom_avatar_description: params.custom_avatar_description,
        custom_avatar_fidelity: params.custom_avatar_fidelity,
        custom_avatar_face_detail: params.custom_avatar_face_detail,
        custom_avatar_face_prompt: params.custom_avatar_face_prompt,
        avatar_is_anime: params.avatar_is_anime,
        unset_custom_avatar_animation: params.unset_custom_avatar_animation,
        user_set_temperature: params.user_set_temperature,
        reasoning_effort: params.reasoning_effort,
        llm_flair: params.llm_flair,
        proactive_mode: params.proactive_mode,
        proactive_action_directive: params.proactive_action_directive,
        time_awareness: params.time_awareness,
        show_auto_selfies_in_chat: params.show_auto_selfies_in_chat,
      });

      const updated = [
        params.ai_name !== undefined && "name",
        params.ai_gender !== undefined && "gender",
        params.ai_backstory !== undefined && "backstory",
        params.ai_memory !== undefined && "key memories",
        params.ai_example_message !== undefined && "example message",
        params.ai_directive !== undefined && "response directive",
        params.ai_additional_context !== undefined && "additional context",
        params.ai_avatar !== undefined && "avatar preset",
        params.custom_avatar_url !== undefined && "custom avatar URL",
        params.custom_avatar_description !== undefined &&
          "custom avatar description",
        params.custom_avatar_fidelity !== undefined && "avatar fidelity",
        params.custom_avatar_face_detail !== undefined &&
          "avatar face detail",
        params.custom_avatar_face_prompt !== undefined &&
          "avatar face prompt",
        params.avatar_is_anime !== undefined && "anime style",
        params.unset_custom_avatar_animation !== undefined &&
          "avatar animation",
        params.user_set_temperature !== undefined && "dynamism",
        params.reasoning_effort !== undefined && "reasoning effort",
        params.llm_flair !== undefined && "LLM flair",
        params.proactive_mode !== undefined && "proactive mode",
        params.proactive_action_directive !== undefined &&
          "proactive action directive",
        params.time_awareness !== undefined && "time awareness",
        params.show_auto_selfies_in_chat !== undefined &&
          "show auto selfies in chat",
      ].filter(Boolean);

      return {
        content: [
          {
            type: "text" as const,
            text: `Kin updated successfully. Changed: ${updated.join(", ") || "no fields specified"}.`,
          },
        ],
      };
    }),
  );
}
