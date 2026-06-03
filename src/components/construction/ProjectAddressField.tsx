import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { api, Project } from "@/lib/api";

interface Props {
  project: Project;
  onSaved: () => void;
}

export default function ProjectAddressField({ project, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(project.address || "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Фокус на поле при входе в режим редактирования (с корректным cleanup таймера)
  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [editing]);

  const startEdit = () => {
    setVal(project.address || "");
    setEditing(true);
  };

  const save = async () => {
    await api.projects.updateAddress(project.id, val.trim());
    setEditing(false);
    onSaved();
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="flex items-center gap-1 mt-0.5">
        <input
          ref={inputRef}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="text-[12px] border border-primary rounded px-2 py-0.5 outline-none flex-1 min-w-0"
          placeholder="Введите адрес объекта"
        />
        <button onClick={save} className="text-emerald-600 hover:text-emerald-700 shrink-0">
          <Icon name="Check" size={14} />
        </button>
        <button onClick={cancel} className="text-muted-foreground hover:text-foreground shrink-0">
          <Icon name="X" size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="flex items-center gap-1 text-hint text-[12px] hover:text-foreground group transition-colors"
    >
      <Icon name="MapPin" size={10} className="shrink-0" />
      <span className="truncate">{project.address || "Адрес не указан"}</span>
      <Icon name="Pencil" size={10} className="opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
    </button>
  );
}