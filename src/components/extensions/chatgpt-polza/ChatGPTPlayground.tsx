/**
 * ChatGPT Playground - Песочница для тестирования GPT моделей
 *
 * Провайдер: Polza.ai
 */

"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useChatGPT } from "./useChatGPT";

// =============================================================================
// TYPES
// =============================================================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface GPTModel {
  id: string;
  name: string;
}

interface ChatGPTPlaygroundProps {
  apiUrl: string;
  defaultModel?: string;
}

// =============================================================================
// MODEL DROPDOWN
// =============================================================================

function ModelDropdown({
  value,
  onChange,
  models,
  loading,
}: {
  value: string;
  onChange: (value: string) => void;
  models: GPTModel[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedModel = models.find((m) => m.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !loading && setOpen(!open)}
        disabled={loading}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#2d2d2d] border border-gray-600 rounded text-sm text-left hover:border-gray-500 focus:outline-none focus:border-green-500 disabled:opacity-50"
      >
        <span className="truncate">
          {loading ? "Загрузка..." : selectedModel?.name || value}
        </span>
        <svg
          className={`w-4 h-4 ml-2 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && models.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#2d2d2d] border border-gray-600 rounded shadow-lg max-h-60 overflow-y-auto">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                onChange(model.id);
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-[#3d3d3d] ${
                model.id === value ? "bg-green-600/20 text-green-400" : ""
              }`}
            >
              {model.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ChatGPTPlayground({
  apiUrl,
  defaultModel = "openai/gpt-4o-mini",
}: ChatGPTPlaygroundProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [models, setModels] = useState<GPTModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { generate, getModels, isLoading, error } = useChatGPT({ apiUrl });

  // Загрузка моделей
  useEffect(() => {
    const loadModels = async () => {
      setModelsLoading(true);
      const result = await getModels();
      if (result.success && result.models) {
        setModels(result.models);
      }
      setModelsLoading(false);
    };
    loadModels();
  }, [getModels]);

  // Автоскролл
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const apiMessages = [];
    if (systemPrompt.trim()) {
      apiMessages.push({ role: "system" as const, content: systemPrompt.trim() });
    }
    messages.forEach((msg) => {
      apiMessages.push({ role: msg.role, content: msg.content });
    });
    apiMessages.push({ role: "user" as const, content: text });

    const result = await generate({ messages: apiMessages, model: selectedModel });

    if (result.success && result.content) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: result.content! },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: `Ошибка: ${result.error}` },
      ]);
    }
  };

  const clearChat = () => setMessages([]);

  return (
    <div className="flex h-full bg-[#1e1e1e] text-white">
      {/* Левая панель - Настройки */}
      <div className="w-80 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-medium">Песочница</h1>
        </div>

        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          {/* Модель */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Модель</label>
            <ModelDropdown
              value={selectedModel}
              onChange={setSelectedModel}
              models={models}
              loading={modelsLoading}
            />
          </div>

          {/* Системное сообщение */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">Системное сообщение</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Опишите поведение модели..."
              rows={6}
              className="w-full px-3 py-2 bg-[#2d2d2d] border border-gray-600 rounded text-sm resize-none focus:outline-none focus:border-green-500 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Кнопка очистки */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={clearChat}
            className="w-full px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 rounded hover:border-gray-500 transition-colors"
          >
            Очистить чат
          </button>
        </div>
      </div>

      {/* Правая панель - Чат */}
      <div className="flex-1 flex flex-col">
        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>Ваш диалог появится здесь</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-lg ${
                      msg.role === "user" ? "bg-green-600" : "bg-[#2d2d2d]"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#2d2d2d] px-4 py-3 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Ошибка */}
        {error && (
          <div className="px-6 py-2 bg-red-900/30 border-t border-red-800">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Ввод */}
        <div className="p-4 border-t border-gray-700">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex items-end gap-3 bg-[#2d2d2d] rounded-lg px-4 py-3">
              <textarea
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 150) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Введите сообщение..."
                disabled={isLoading}
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder-gray-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ChatGPTPlayground;
