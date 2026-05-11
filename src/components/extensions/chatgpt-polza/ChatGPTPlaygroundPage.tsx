/**
 * ChatGPT Playground Page
 *
 * Страница-песочница для тестирования GPT моделей.
 * Пример: /chatgpt или /playground
 */

"use client";

import { ChatGPTPlayground } from "./ChatGPTPlayground";

interface ChatGPTPlaygroundPageProps {
  apiUrl: string;
  defaultModel?: string;
}

export function ChatGPTPlaygroundPage({
  apiUrl,
  defaultModel = "openai/gpt-4o-mini",
}: ChatGPTPlaygroundPageProps) {
  return (
    <div className="h-screen">
      <ChatGPTPlayground apiUrl={apiUrl} defaultModel={defaultModel} />
    </div>
  );
}

export default ChatGPTPlaygroundPage;
