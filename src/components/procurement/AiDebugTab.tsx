import Icon from "@/components/ui/icon";
import { AiRecognizeResult } from "./invoices.shared";

interface Props {
  result: AiRecognizeResult;
}

export default function AiDebugTab({ result }: Props) {
  return (
    <div className="space-y-3">
      {result.parse_error && (
        <div className="rounded-lg border border-red-200 bg-white overflow-hidden">
          <div className="px-3 py-2 bg-red-50 text-[11px] font-semibold text-red-700 flex items-center gap-1.5">
            <Icon name="Bug" size={11} />Ошибка парсера
          </div>
          <pre className="px-3 py-2 text-[10px] font-mono text-red-600 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
            {result.parse_error}
          </pre>
        </div>
      )}
      <div className="rounded-lg border border-border bg-white overflow-hidden">
        <div className="px-3 py-2 bg-secondary/50 text-[11px] font-semibold flex items-center gap-1.5">
          <Icon name="MessageSquare" size={11} />Сырой текст / ответ AI
        </div>
        <pre className="px-3 py-2 text-[10px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto bg-gray-950 text-gray-100">
          {result.debug.raw_response || "(пусто)"}
        </pre>
      </div>
      {(result.debug.continuation_log?.length ?? 0) > 0 && (
        <div className="rounded-lg border border-violet-200 bg-white overflow-hidden">
          <div className="px-3 py-2 bg-violet-50 text-[11px] font-semibold text-violet-700 flex items-center gap-1.5">
            <Icon name="GitMerge" size={11} />Debug лог
          </div>
          <div className="px-3 py-2 space-y-0.5 max-h-40 overflow-y-auto">
            {result.debug.continuation_log!.map((line, i) => (
              <div key={i} className="text-[10px] font-mono text-muted-foreground">{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
