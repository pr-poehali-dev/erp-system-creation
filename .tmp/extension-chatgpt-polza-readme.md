# ChatGPT Extension

Генерация текста через ChatGPT (GPT-4o, GPT-4, GPT-3.5 и новее) с виджетом-песочницей.

> **Провайдер:** Polza.ai
> **Модели:** Все OpenAI модели (GPT-4o, GPT-5 и новее)
> Работает без VPN из России.

---

## Чеклист установки

### Шаг 1: Получить API ключ

**Сразу после установки расширения вызови тулу `put_secret`:**

```python
put_secret("POLZA_AI_API_KEY", "")
```

Это покажет пользователю поле для ввода API ключа.

**Скажи пользователю:**

> Введите API ключ от Polza.ai в поле выше.
>
> **Если ключа нет** — зарегистрируйтесь на [polza.ai](https://polza.ai), создайте ключ в [Ключи API](https://polza.ai/dashboard/api-keys) и пополните баланс (от 100₽).

### Шаг 2: Деплой функции

Задеплой функцию из `/backend/chatgpt/`:
- Точка входа: `index.handler`
- Runtime: Python 3.11+

### Шаг 3: Добавление виджета на фронтенд

**Создай страницу с ChatGPT:**

```tsx
// app/chatgpt/page.tsx
"use client";

import { ChatGPTPlaygroundPage } from "@/components/ChatGPTPlaygroundPage";

const API_URL = "https://functions.poehali.dev/xxx-chatgpt";

export default function Page() {
  return (
    <ChatGPTPlaygroundPage
      apiUrl={API_URL}
      defaultModel="openai/gpt-4o-mini"
    />
  );
}
```

### Шаг 4: Тестирование

**Скажи пользователю:**

> Готово! Давайте проверим:
>
> 1. Откройте `/chatgpt` на вашем сайте
> 2. Напишите любое сообщение
> 3. Должен прийти ответ от ChatGPT
>
> Всё работает?

---

## API

```
POST ?action=generate   — генерация текста
GET  ?action=models     — список моделей
POST ?action=test       — тест соединения
```

### action=generate

```json
{
  "messages": [
    {"role": "user", "content": "Привет!"}
  ],
  "model": "openai/gpt-4o-mini",
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Ответ:**

```json
{
  "success": true,
  "content": "Привет! Чем могу помочь?",
  "model": "openai/gpt-4o-mini",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 15,
    "total_tokens": 25
  }
}
```

### action=models

```json
{
  "success": true,
  "models": [
    {"id": "openai/gpt-4o", "name": "GPT-4o", "description": "Most capable model"},
    {"id": "openai/gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast and affordable"}
  ],
  "provider": "polza.ai"
}
```

### action=test

```json
{
  "model": "openai/gpt-4o-mini"
}
```

**Ответ:**

```json
{
  "success": true,
  "message": "ChatGPT connection successful",
  "response": "OK",
  "model": "openai/gpt-4o-mini"
}
```

---

## Frontend компоненты

| Файл | Описание |
|------|----------|
| `useChatGPT.ts` | Хук для работы с ChatGPT API |
| `ChatGPTPlayground.tsx` | Виджет-песочница с чатом |
| `ChatGPTPlaygroundPage.tsx` | Готовая страница для роутера |

### useChatGPT

```tsx
const { generate, getModels, testConnection, isLoading, error } = useChatGPT({
  apiUrl: "https://functions.poehali.dev/xxx-chatgpt"
});

// Генерация текста
const result = await generate({
  messages: [{ role: "user", content: "Привет!" }],
  model: "openai/gpt-4o-mini",
  temperature: 0.7,
});

if (result.success) {
  console.log(result.content);
}
```

### ChatGPTPlayground

```tsx
<ChatGPTPlayground
  apiUrl="https://functions.poehali.dev/xxx-chatgpt"
  defaultModel="openai/gpt-4o-mini"
  systemPrompt="Ты полезный ассистент."
  title="ChatGPT"
  placeholder="Напишите сообщение..."
/>
```

---

## Доступные модели

Список моделей загружается динамически из Polza.ai API.

Поддерживаются все модели с префиксом `openai/*`:
- GPT-5.2, GPT-5.2 Pro, GPT-5.2 Chat
- GPT-4o, GPT-4o Mini
- GPT-4 Turbo, GPT-4
- GPT-3.5 Turbo
- И другие новые модели

**Актуальный список:** [polza.ai/models](https://polza.ai/models)

---

## Секреты

```python
put_secret("POLZA_AI_API_KEY", "<API ключ от Polza.ai>")
```

---

## Кастомизация

### System Prompt

Добавь системный промпт для кастомизации поведения:

```tsx
<ChatGPTPlayground
  apiUrl={API_URL}
  systemPrompt="Ты — помощник интернет-магазина. Отвечай только на вопросы о товарах и заказах."
/>
```

### Встраивание в существующую страницу

```tsx
import { ChatGPTPlayground } from "@/components/ChatGPTPlayground";

export default function ProductPage() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ProductInfo />
      <div className="h-[600px]">
        <ChatGPTPlayground
          apiUrl={API_URL}
          systemPrompt="Помоги пользователю выбрать товар."
          title="Консультант"
        />
      </div>
    </div>
  );
}
```

---

## Стоимость

Polza.ai тарифицирует по токенам. Цены зависят от модели.

**Актуальные цены и список моделей:** [polza.ai/models](https://polza.ai/models)
