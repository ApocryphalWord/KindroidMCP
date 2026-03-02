import { z } from "zod";

const BASE_URL = "https://api.kindroid.ai/v1";

// --- Error class for API responses ---

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);

class KindroidApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "KindroidApiError";
  }

  get isRetryable(): boolean {
    return RETRYABLE_STATUS_CODES.has(this.statusCode);
  }
}

// --- Response helpers ---

type ResponseFormat = "json" | "text" | "void";
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type RequestBody = {};
const DEFAULT_TIMEOUT_MS = 30_000;
const SEND_MESSAGE_TIMEOUT_MS = 300_000;
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

/**
 * Parse a plain-text API response that may be a JSON-encoded string
 * (e.g., `"hello"` with surrounding quotes) or raw text.
 */
function parseTextResponse(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string") return parsed;
    } catch {
      /* fall through */
    }
  }
  return trimmed;
}

// --- Option interfaces (public) ---

export interface SendMessageOptions {
  ai_id: string;
  message: string;
  image_urls?: string[];
  image_description?: string;
  video_url?: string;
  video_description?: string;
  link_url?: string;
  link_description?: string;
}

export interface CreateKinOptions {
  ai_name: string;
  ai_gender: string;
  ai_backstory: string;
  custom_greeting?: string;
  ai_directive?: string;
  ai_avatar?: number;
  custom_avatar_url?: string;
  custom_avatar_description?: string;
  custom_avatar_fidelity?: number;
  custom_avatar_face_detail?: number;
  custom_avatar_face_prompt?: string;
  avatar_is_anime?: boolean;
}

export interface UpdateKinOptions {
  ai_id: string;
  ai_name?: string;
  ai_gender?: string;
  ai_backstory?: string;
  ai_memory?: string;
  ai_example_message?: string;
  ai_directive?: string;
  ai_additional_context?: string;
  ai_avatar?: number;
  custom_avatar_url?: string;
  custom_avatar_description?: string;
  custom_avatar_fidelity?: number;
  custom_avatar_face_detail?: number;
  custom_avatar_face_prompt?: string;
  avatar_is_anime?: boolean;
  unset_custom_avatar_animation?: boolean;
  user_set_temperature?: number;
  reasoning_effort?: string;
  llm_flair?: string;
  proactive_mode?: boolean;
  proactive_action_directive?: string;
  time_awareness?: boolean;
  show_auto_selfies_in_chat?: boolean;
  current_scene?: string;
}

export interface SelfieRequestOptions {
  ai_id: string;
  prompt: string;
  aspect?: "square" | "portrait" | "landscape";
  uses_nsfw?: boolean;
  seed?: number | null;
}

export interface GroupSelfieRequestOptions {
  version: string;
  ai_ids: string[];
  full_photo_prompt: string;
  regional_prompts?: string[];
  aspect?: "square" | "portrait" | "landscape";
  uses_nsfw?: boolean;
  seed?: number | null;
}

export interface ChatBreakOptions {
  ai_id: string;
  greeting?: string;
  wipe_cascaded?: boolean;
}

export interface SuggestUserMessageOptions {
  ai_id: string;
  existing_message?: string;
}

export interface SuggestUserGroupMessageOptions {
  group_id: string;
  existing_message?: string;
}

export interface CreateJournalEntryOptions {
  ai_id: string;
  entry: string;
  keyphrases: string[];
}

export interface CreateGroupChatOptions {
  ai_list: string[];
  group_name: string;
  group_context?: string;
  group_directive?: string;
  use_manual_turntaking?: boolean;
  share_short_term_memory?: boolean;
  disable_ltm_recall?: boolean;
  disable_ltm_consolidate?: boolean;
  user_persona_id?: string;
}

export interface UpdateGroupChatOptions {
  group_id: string;
  ai_list?: string[];
  group_name?: string;
  group_context?: string;
  group_directive?: string;
  use_manual_turntaking?: boolean;
  share_short_term_memory?: boolean;
  disable_ltm_recall?: boolean;
  disable_ltm_consolidate?: boolean;
  user_persona_id?: string;
}

export interface SendGroupChatMessageOptions {
  group_id: string;
  message: string;
  image_urls?: string[];
  image_description?: string;
  video_url?: string;
  video_description?: string;
  link_url?: string;
  link_description?: string;
}

export interface GroupChatGetTurnOptions {
  group_id: string;
  allow_user?: boolean;
}

export interface GroupChatAiResponseOptions {
  ai_id: string;
  group_id: string;
  request_id?: string;
}

export interface SubscriptionInfo {
  uid: string;
  status: string;
  isSubscribedBase: boolean;
  subscriptionPlatformBase: string | null;
  gracePeriodBase: number | null;
  isSubscribedAddon1: boolean;
  subscriptionPlatformAddon1: string | null;
  gracePeriodAddon1: number | null;
  isSubscribedAddon2: boolean;
  subscriptionPlatformAddon2: string | null;
  gracePeriodAddon2: number | null;
}

// --- Request body interfaces (internal) ---

interface SendMessageBody {
  ai_id: string;
  message: string;
  stream: boolean;
  image_urls?: string[];
  image_description?: string;
  video_url?: string;
  video_description?: string;
  link_url?: string;
  link_description?: string;
}

interface SelfieRequestBody {
  ai_id: string;
  prompt: string;
  aspect: string;
  uses_nsfw: boolean;
  custom_pose_url: string;
  custom_style_url: string;
  custom_style_weight: null;
  seed: number | null;
}

interface GroupSelfieRequestBody {
  version: string;
  ai_ids: string[];
  full_photo_prompt: string;
  regional_prompts: string[];
  aspect: string;
  uses_nsfw: boolean;
  pose_strictness: number;
  seed: number | null;
}

// --- Runtime response validation schemas ---

const subscriptionInfoSchema = z.object({
  uid: z.string(),
  status: z.string(),
  isSubscribedBase: z.boolean(),
  subscriptionPlatformBase: z.string().nullable(),
  gracePeriodBase: z.number().nullable(),
  isSubscribedAddon1: z.boolean(),
  subscriptionPlatformAddon1: z.string().nullable(),
  gracePeriodAddon1: z.number().nullable(),
  isSubscribedAddon2: z.boolean(),
  subscriptionPlatformAddon2: z.string().nullable(),
  gracePeriodAddon2: z.number().nullable(),
});

// --- Client class ---

export class KindroidClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // --- Core request infrastructure ---

  private async request<T>(
    endpoint: string,
    body: RequestBody,
    format: "json",
    timeoutMs?: number,
  ): Promise<T>;
  private async request(
    endpoint: string,
    body: RequestBody,
    format: "text",
    timeoutMs?: number,
  ): Promise<string>;
  private async request(
    endpoint: string,
    body: RequestBody,
    format: "void",
    timeoutMs?: number,
  ): Promise<void>;
  private async request<T>(
    endpoint: string,
    body: RequestBody,
    format: ResponseFormat,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<T | string | void> {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new KindroidApiError(
        response.status,
        `Kindroid API error (${response.status}): ${text || response.statusText}`,
      );
    }

    switch (format) {
      case "void":
        return;
      case "text":
        return parseTextResponse(await response.text());
      case "json":
        return response.json() as Promise<T>;
    }
  }

  private async requestWithRetry<T>(
    endpoint: string,
    body: RequestBody,
    format: "json",
    timeoutMs?: number,
  ): Promise<T>;
  private async requestWithRetry(
    endpoint: string,
    body: RequestBody,
    format: "text",
    timeoutMs?: number,
  ): Promise<string>;
  private async requestWithRetry(
    endpoint: string,
    body: RequestBody,
    format: "void",
    timeoutMs?: number,
  ): Promise<void>;
  private async requestWithRetry<T>(
    endpoint: string,
    body: RequestBody,
    format: ResponseFormat,
    timeoutMs?: number,
  ): Promise<T | string | void> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.request<T>(endpoint, body, format as "json", timeoutMs);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry timeouts — already waited long enough
        if (lastError.name === "TimeoutError") throw lastError;

        const isRetryable =
          error instanceof KindroidApiError
            ? error.isRetryable
            : true; // network errors are retryable

        if (!isRetryable || attempt === MAX_RETRIES) throw lastError;

        const delay =
          BASE_DELAY_MS * 2 ** attempt * (0.5 + Math.random() * 0.5);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError!;
  }

  // --- Public API methods ---

  async sendMessage(options: SendMessageOptions): Promise<string> {
    const body: SendMessageBody = {
      ai_id: options.ai_id,
      message: options.message,
      stream: false,
      ...(options.image_urls?.length && { image_urls: options.image_urls }),
      ...(options.image_description && {
        image_description: options.image_description,
      }),
      ...(options.video_url && { video_url: options.video_url }),
      ...(options.video_description && {
        video_description: options.video_description,
      }),
      ...(options.link_url && { link_url: options.link_url }),
      ...(options.link_description && {
        link_description: options.link_description,
      }),
    };

    return this.requestWithRetry("/send-message", body, "text", SEND_MESSAGE_TIMEOUT_MS);
  }

  async createKin(options: CreateKinOptions): Promise<string> {
    const body: Record<string, unknown> = {
      ai_name: options.ai_name,
      ai_gender: options.ai_gender,
      ai_backstory: options.ai_backstory,
      ai_avatar: options.ai_avatar ?? -1,
      avatar_is_anime: options.avatar_is_anime ?? false,
      ai_directive: options.ai_directive ?? "",
    };

    if (options.custom_greeting) body.custom_greeting = options.custom_greeting;
    if (options.custom_avatar_url)
      body.custom_avatar_url = options.custom_avatar_url;
    if (options.custom_avatar_description)
      body.custom_avatar_description = options.custom_avatar_description;
    if (options.custom_avatar_fidelity !== undefined)
      body.custom_avatar_fidelity = options.custom_avatar_fidelity;
    if (options.custom_avatar_face_detail !== undefined)
      body.custom_avatar_face_detail = options.custom_avatar_face_detail;
    if (options.custom_avatar_face_prompt)
      body.custom_avatar_face_prompt = options.custom_avatar_face_prompt;

    return this.requestWithRetry("/create-new-ai", body, "text");
  }

  async updateKin(options: UpdateKinOptions): Promise<void> {
    const body: Record<string, unknown> = {
      ai_id: options.ai_id,
    };

    if (options.ai_name !== undefined) body.ai_name = options.ai_name;
    if (options.ai_gender !== undefined) body.ai_gender = options.ai_gender;
    if (options.ai_backstory !== undefined)
      body.ai_backstory = options.ai_backstory;
    if (options.ai_memory !== undefined) body.ai_memory = options.ai_memory;
    if (options.ai_example_message !== undefined)
      body.ai_example_message = options.ai_example_message;
    if (options.ai_directive !== undefined)
      body.ai_directive = options.ai_directive;
    if (options.ai_additional_context !== undefined)
      body.ai_additional_context = options.ai_additional_context;
    if (options.ai_avatar !== undefined) body.ai_avatar = options.ai_avatar;
    if (options.custom_avatar_url !== undefined)
      body.custom_avatar_url = options.custom_avatar_url;
    if (options.custom_avatar_description !== undefined)
      body.custom_avatar_description = options.custom_avatar_description;
    if (options.custom_avatar_fidelity !== undefined)
      body.custom_avatar_fidelity = options.custom_avatar_fidelity;
    if (options.custom_avatar_face_detail !== undefined)
      body.custom_avatar_face_detail = options.custom_avatar_face_detail;
    if (options.custom_avatar_face_prompt !== undefined)
      body.custom_avatar_face_prompt = options.custom_avatar_face_prompt;
    if (options.avatar_is_anime !== undefined)
      body.avatar_is_anime = options.avatar_is_anime;
    if (options.unset_custom_avatar_animation !== undefined)
      body.unset_custom_avatar_animation =
        options.unset_custom_avatar_animation;
    if (options.user_set_temperature !== undefined)
      body.user_set_temperature = options.user_set_temperature;
    if (options.reasoning_effort !== undefined)
      body.reasoning_effort = options.reasoning_effort;
    if (options.llm_flair !== undefined) body.llm_flair = options.llm_flair;
    if (options.proactive_mode !== undefined)
      body.proactive_mode = options.proactive_mode;
    if (options.proactive_action_directive !== undefined)
      body.proactive_action_directive = options.proactive_action_directive;
    if (options.time_awareness !== undefined)
      body.time_awareness = options.time_awareness;
    if (options.show_auto_selfies_in_chat !== undefined)
      body.show_auto_selfies_in_chat = options.show_auto_selfies_in_chat;
    if (options.current_scene !== undefined)
      body.current_scene = options.current_scene;

    return this.requestWithRetry("/update-info", body, "void");
  }

  async chatBreak(options: ChatBreakOptions): Promise<void> {
    const body: Record<string, unknown> = {
      ai_id: options.ai_id,
      wipe_cascaded: options.wipe_cascaded ?? false,
    };
    if (options.greeting) body.greeting = options.greeting;

    await this.requestWithRetry("/chat-break", body, "void");
  }

  async requestSelfie(options: SelfieRequestOptions): Promise<void> {
    const body: SelfieRequestBody = {
      ai_id: options.ai_id,
      prompt: options.prompt,
      aspect: options.aspect ?? "square",
      uses_nsfw: options.uses_nsfw ?? false,
      custom_pose_url: "",
      custom_style_url: "",
      custom_style_weight: null,
      seed: options.seed ?? null,
    };

    return this.requestWithRetry("/selfie-request", body, "void");
  }

  async requestGroupSelfie(
    options: GroupSelfieRequestOptions,
  ): Promise<void> {
    const body: GroupSelfieRequestBody = {
      version: options.version,
      ai_ids: options.ai_ids,
      full_photo_prompt: options.full_photo_prompt,
      regional_prompts:
        options.regional_prompts ?? options.ai_ids.map(() => ""),
      aspect: options.aspect ?? "square",
      uses_nsfw: options.uses_nsfw ?? false,
      pose_strictness: 0.65,
      seed: options.seed ?? null,
    };

    return this.requestWithRetry("/group-selfie-request", body, "void");
  }

  async createJournalEntry(
    options: CreateJournalEntryOptions,
  ): Promise<void> {
    await this.requestWithRetry(
      "/journal-create",
      {
        ai_id: options.ai_id,
        entry: options.entry,
        keyphrases: options.keyphrases,
      },
      "void",
    );
  }

  async checkSubscription(): Promise<SubscriptionInfo> {
    const data = await this.requestWithRetry<unknown>(
      "/check-user-subscription",
      {},
      "json",
    );
    const result = subscriptionInfoSchema.safeParse(data);
    if (!result.success) {
      throw new Error(
        `Unexpected subscription response format: ${result.error.message}`,
      );
    }
    return result.data;
  }

  async createGroupChat(options: CreateGroupChatOptions): Promise<string> {
    const body: Record<string, unknown> = {
      ai_list: options.ai_list,
      group_name: options.group_name,
      group_context: options.group_context ?? "",
      group_directive: options.group_directive ?? "",
      use_manual_turntaking: options.use_manual_turntaking ?? false,
      share_short_term_memory: options.share_short_term_memory ?? false,
      disable_ltm_recall: options.disable_ltm_recall ?? false,
      disable_ltm_consolidate: options.disable_ltm_consolidate ?? false,
    };

    if (options.user_persona_id)
      body.user_persona_id = options.user_persona_id;

    return this.requestWithRetry("/groupchats-create", body, "text");
  }

  async updateGroupChat(options: UpdateGroupChatOptions): Promise<void> {
    const body: Record<string, unknown> = {
      group_id: options.group_id,
    };

    if (options.ai_list !== undefined) body.ai_list = options.ai_list;
    if (options.group_name !== undefined)
      body.group_name = options.group_name;
    if (options.group_context !== undefined)
      body.group_context = options.group_context;
    if (options.group_directive !== undefined)
      body.group_directive = options.group_directive;
    if (options.use_manual_turntaking !== undefined)
      body.use_manual_turntaking = options.use_manual_turntaking;
    if (options.share_short_term_memory !== undefined)
      body.share_short_term_memory = options.share_short_term_memory;
    if (options.disable_ltm_recall !== undefined)
      body.disable_ltm_recall = options.disable_ltm_recall;
    if (options.disable_ltm_consolidate !== undefined)
      body.disable_ltm_consolidate = options.disable_ltm_consolidate;
    if (options.user_persona_id !== undefined)
      body.user_persona_id = options.user_persona_id;

    return this.requestWithRetry("/groupchats-update", body, "void");
  }

  async sendGroupChatMessage(
    options: SendGroupChatMessageOptions,
  ): Promise<string> {
    const body: Record<string, unknown> = {
      group_id: options.group_id,
      message: options.message,
      ...(options.image_urls?.length && { image_urls: options.image_urls }),
      ...(options.image_description && {
        image_description: options.image_description,
      }),
      ...(options.video_url && { video_url: options.video_url }),
      ...(options.video_description && {
        video_description: options.video_description,
      }),
      ...(options.link_url && { link_url: options.link_url }),
      ...(options.link_description && {
        link_description: options.link_description,
      }),
    };

    return this.requestWithRetry(
      "/groupchats-user-message",
      body,
      "text",
      SEND_MESSAGE_TIMEOUT_MS,
    );
  }

  async groupChatGetTurn(
    options: GroupChatGetTurnOptions,
  ): Promise<string> {
    return this.requestWithRetry(
      "/groupchats-get-turn",
      {
        group_id: options.group_id,
        allow_user: options.allow_user ?? true,
      },
      "text",
    );
  }

  async groupChatAiResponse(
    options: GroupChatAiResponseOptions,
  ): Promise<string> {
    const requestId =
      options.request_id ??
      `group-ai-${options.group_id}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    return this.requestWithRetry(
      "/groupchats-ai-response",
      {
        ai_id: options.ai_id,
        group_id: options.group_id,
        stream: false,
        request_id: requestId,
      },
      "text",
      SEND_MESSAGE_TIMEOUT_MS,
    );
  }

  async suggestUserMessage(
    options: SuggestUserMessageOptions,
  ): Promise<string> {
    return this.requestWithRetry(
      "/suggest-user-message",
      {
        ai_id: options.ai_id,
        existing_message: options.existing_message ?? "",
        stream: false,
      },
      "text",
      SEND_MESSAGE_TIMEOUT_MS,
    );
  }

  async suggestUserGroupMessage(
    options: SuggestUserGroupMessageOptions,
  ): Promise<string> {
    return this.requestWithRetry(
      "/suggest-user-group-message",
      {
        group_id: options.group_id,
        existing_message: options.existing_message ?? "",
        stream: false,
      },
      "text",
      SEND_MESSAGE_TIMEOUT_MS,
    );
  }
}
