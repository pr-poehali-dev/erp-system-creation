import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { ContractDocItem, api } from "@/lib/api";

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface Props {
  item: ContractDocItem;
  dealId: number;
  onUploaded: () => void;
}

export default function ContractDocRow({ item, dealId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localFile, setLocalFile] = useState<string | null>(null);
  const isDone = ["uploaded", "approved", "review"].includes(item.status);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      await api.contract_docs.upload(dealId, item.template_id, b64, file.name);
      setLocalFile(file.name);
      onUploaded();
    } finally { setUploading(false); }
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      isDone ? "border-emerald-200 bg-emerald-50"
      : item.is_required ? "border-amber-200 bg-amber-50/60"
      : "border-border bg-white"
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isDone ? "bg-emerald-500" : item.is_required ? "bg-amber-400" : "bg-muted"}`}>
        {isDone ? <Icon name="Check" size={14} className="text-white" />
          : uploading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <Icon name="Upload" size={13} className="text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold">{item.template_name}</span>
          {item.is_required && !isDone && (
            <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md font-medium">обязательный</span>
          )}
        </div>
        {item.description && !isDone && <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>}
        {isDone && (
          <div className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1">
            <Icon name="Paperclip" size={10} />{localFile || item.file_name || "Загружен"}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.template_file_url && (
          <a href={item.template_file_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 px-2 py-1 border border-border bg-white rounded-lg text-[11px] text-muted-foreground hover:text-primary transition-colors">
            <Icon name="Download" size={11} />Шаблон
          </a>
        )}
        {!isDone ? (
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 bg-primary text-white rounded-lg text-[11px] font-medium disabled:opacity-50">
            {uploading ? "..." : <><Icon name="Upload" size={11} />Загрузить</>}
          </button>
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 border border-emerald-300 bg-white rounded-lg text-[11px] text-emerald-700 hover:bg-emerald-50 transition-colors">
            <Icon name="RefreshCw" size={10} />Заменить
          </button>
        )}
        <input ref={inputRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFile} />
      </div>
    </div>
  );
}
