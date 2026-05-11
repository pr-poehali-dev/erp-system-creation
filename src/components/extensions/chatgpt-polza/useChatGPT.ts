/**
 * ChatGPT Extension - Text Generation Hook
 *
 * Hook for generating text via ChatGPT (GPT models).
 * Provider: Polza.ai
 */

import { useState, useCallback } from "react";

// =============================================================================
// TYPES
// =============================================================================

interface UseChatGPTConfig {
  apiUrl: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface GenerateParams {
  messages: Message[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

interface GenerateResult {
  success: boolean;
  content?: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason?: string;
  error?: string;
}

interface GPTModel {
  id: string;
  name: string;
  description: string;
}

interface ModelsResult {
  success: boolean;
  models?: GPTModel[];
  provider?: string;
  error?: string;
}

interface TestResult {
  success: boolean;
  message?: string;
  response?: string;
  model?: string;
  error?: string;
}

interface UseChatGPTReturn {
  /** Generate text completion */
  generate: (params: GenerateParams) => Promise<GenerateResult>;
  /** List available GPT models */
  getModels: () => Promise<ModelsResult>;
  /** Test API connection */
  testConnection: (model?: string) => Promise<TestResult>;
  /** Loading state */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useChatGPT({ apiUrl }: UseChatGPTConfig): UseChatGPTReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (params: GenerateParams): Promise<GenerateResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}?action=generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Generation failed");
          return { success: false, error: data.error };
        }

        return {
          success: true,
          content: data.content,
          model: data.model,
          usage: data.usage,
          finish_reason: data.finish_reason,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  const getModels = useCallback(async (): Promise<ModelsResult> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}?action=models`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch models");
        return { success: false, error: data.error };
      }

      return { success: true, models: data.models, provider: data.provider };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Network error";
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  const testConnection = useCallback(
    async (model?: string): Promise<TestResult> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiUrl}?action=test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(model ? { model } : {}),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Test failed");
          return { success: false, error: data.error };
        }

        return {
          success: true,
          message: data.message,
          response: data.response,
          model: data.model,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Network error";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl]
  );

  return { generate, getModels, testConnection, isLoading, error };
}

export default useChatGPT;
