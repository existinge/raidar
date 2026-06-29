import { SignalItem } from "./types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that a SignalItem complies with rAIdar's data contracts.
 * A valid signal item must:
 * 1. Have a non-empty ID, name, and description.
 * 2. Explicitly cite a source name (e.g. GitHub, HackerNews, X/Twitter).
 * 3. Have a valid HTTP/HTTPS source URL to ensure traceability for accuracy and access routes.
 */
export function validateSignalItem(item: SignalItem): ValidationResult {
  const errors: string[] = [];

  if (!item.id || item.id.trim() === "") {
    errors.push("Missing item ID.");
  }
  if (!item.name || item.name.trim() === "") {
    errors.push("Missing item name.");
  }
  if (!item.description || item.description.trim() === "") {
    errors.push("Missing item description.");
  }
  if (!item.source || item.source.trim() === "") {
    errors.push("Missing source citation (source name must be specified).");
  }

  if (!item.url || item.url.trim() === "") {
    errors.push("Missing source URL citation.");
  } else {
    try {
      const parsedUrl = new URL(item.url);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        errors.push(`Invalid source URL protocol: ${parsedUrl.protocol}. Must be http or https.`);
      }
    } catch (e) {
      errors.push(`Invalid source URL format: "${item.url}".`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
