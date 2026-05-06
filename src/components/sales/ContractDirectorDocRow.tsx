import { useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { ContractDocItem, api } from "@/lib/api";

function fileToBase64(file: File): Promise<string> {
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

export default function ContractDirectorDocRow({ item, dealId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const b64 = await fileToBase64(file);
      await api.contract_docs.uploadSigned(dealId, item.template_id, b64, file.name);
      onUploaded();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const hasSigned = !!item.signed_file_url;

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      hasSigned ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50/50"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
          hasSigned ? "bg-emerald-500" : "bg-blue-400"
        }`}>
          {hasSigned
            ? <Icon name="CheckCheck" size={14} className="text-white" />
            : uploading
              ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Icon name="Pen" size={13} className="text-white" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">{item.template_name}</div>
          {hasSigned
            ? <div className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5"><Icon name="Paperclip" size={9} />{item.signed_file_name || "Подписан"}</div>
            : <div className="text-[11px] text-blue-700 mt-0.5">Ожидает вашей подписи</div>
          }
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {item.file_url && (
            <a href={item.file_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 border border-blue-200 bg-white rounded-lg text-[11px] text-blue-700 hover:bg-blue-50 transition-colors font-medium">
              <Icon name="Download" size={11} />От менеджера
            </a>
          )}
          {hasSigned && (
            <a href={item.signed_file_url!} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 border border-emerald-200 bg-emerald-50 rounded-lg text-[11px] text-emerald-700 hover:bg-emerald-100 transition-colors">
              <Icon name="FileCheck" size={11} />Подписанный
            </a>
          )}
          <button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
              hasSigned
                ? "border border-border text-muted-foreground hover:bg-secondary"
                : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            }`}>
            {uploading
              ? <><div className="w-3 h-3 border-2 border-white/60 border-t-white rounded-full animate-spin" />Загрузка...</>
              : hasSigned
                ? <><Icon name="RefreshCw" size={10} />Заменить</>
                : <><Icon name="Upload" size={11} />Загрузить подписанный</>
            }
          </button>
          <input ref={inputRef} type="file" className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFile} />
        </div>
      </div>
    </div>
  );
}
