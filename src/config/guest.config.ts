/**
 * Guest chat configuration.
 * Single place for guest message cap and feature flags.
 */

/** Maximum number of messages (user + assistant pairs) allowed per guest. One full decision flow is ~25–30 exchanges. */
export const GUEST_MESSAGE_CAP = 30;

/** Default LLM for guest when not specified. Matches free-tier default. */
export const GUEST_DEFAULT_LLM = 'gpt-4o-mini';

/** Extra output tokens for guest so the model has room for both reasoning and response (avoids empty response + same fallback every time). */
export const GUEST_MAX_OUTPUT_TOKENS = 700;
