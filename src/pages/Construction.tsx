import { useEffect, useState } from "react";
import { Role } from "@/App";
import Icon from "@/components/ui/icon";
import { api, Project } from "@/lib/api";
import MaterialRequestModal from "@/components/construction/MaterialRequestModal";
import ConstructionHeader from "@/components/construction/ConstructionHeader";
import ProjectCard from "@/components/construction/ProjectCard";
import CreateActModal from "@/components/construction/CreateActModal";

interface Props { role: Role; }

export default function Construction({ role }: Props) {
  const [projects, setProjects]         = useState<Project[]>([]);
  const [archived, setArchived]         = useState<Project[]>([]);
  const [loading, setLoading]           = useState(true);
  const [tab, setTab]                   = useState<"active" | "archive">("active");
  const [actionId, setActionId]         = useState<number | null>(null);
  const [confirmId, setConfirmId]       = useState<number | null>(null);
  const [materialModalProject, setMaterialModalProject] = useState<Project | null>(null);
  const [actModalProject, setActModalProject] = useState<Project | null>(null);

  const isDirector = role === "director";
  const isConstructionDirector = role === "construction_director";
  const canArchive = role === "director";

  const load = () => {
    setLoading(true);
    api.projects.list()
      .then(setProjects)
      .finally(() => setLoading(false));
  };

  const loadArchived = () => {
    setLoading(true);
    api.projects.listArchived()
      .then(setArchived)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === "archive") loadArchived();
    else load();
  }, [tab]);

  const handleArchive = async (p: Project) => {
    setActionId(p.id);
    try {
      await api.projects.archive(p.id);
      setConfirmId(null);
      load();
    } finally { setActionId(null); }
  };

  const handleRestore = async (p: Project) => {
    setActionId(p.id);
    try {
      await api.projects.restore(p.id);
      loadArchived();
    } finally { setActionId(null); }
  };

  const handleApprove = async (p: Project) => {
    setActionId(p.id);
    try {
      await api.projects.approve(p.id);
      load();
    } finally { setActionId(null); }
  };

  const handleCancel = async (p: Project) => {
    if (!confirm(`Расторгнуть договор и отменить проект ${p.code}?\nСлот будет освобождён, сделка переведена в «Отказ».`)) return;
    setActionId(p.id);
    try {
      await api.projects.cancel(p.id);
      load();
    } finally { setActionId(null); }
  };

  const handleComplete = async (p: Project) => {
    if (!confirm(`Отметить проект ${p.code} как завершённый (сдан клиенту)?`)) return;
    setActionId(p.id);
    try {
      await api.projects.complete(p.id);
      load();
    } finally { setActionId(null); }
  };

  const planningProjects = projects.filter(p => p.status === "planning");
  const activeProjects   = projects.filter(p => p.status === "active");
  const onTimeProjects   = activeProjects.filter(p => p.days_left >= 7);
  const lateProjects     = activeProjects.filter(p => p.days_left < 7);

  const displayProjects = tab === "archive" ? archived : projects;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <ConstructionHeader
        tab={tab}
        loading={loading}
        projectsCount={projects.length}
        archivedCount={archived.length}
        planningCount={planningProjects.length}
        activeCount={activeProjects.length}
        onTimeCount={onTimeProjects.length}
        lateCount={lateProjects.length}
        onTabChange={setTab}
        onRefresh={() => tab === "archive" ? loadArchived() : load()}
      />

      {/* Projects list */}
      <div className="space-y-4">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-border overflow-hidden animate-pulse">
              <div className="px-5 py-4 border-b border-border flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-secondary rounded w-32" />
                  <div className="h-4 bg-secondary rounded w-48" />
                  <div className="h-3 bg-secondary rounded w-64" />
                </div>
                <div className="h-8 bg-secondary rounded w-24" />
                <div className="h-8 bg-secondary rounded w-24" />
              </div>
              <div className="px-5 py-4">
                <div className="h-7 bg-secondary rounded" />
              </div>
            </div>
          ))
        ) : displayProjects.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-border p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Icon name={tab === "archive" ? "Archive" : "HardHat"} size={32} />
            <span className="text-[14px] font-medium">
              {tab === "archive" ? "Архив пуст" : "Проектов пока нет"}
            </span>
            <span className="text-hint text-center">
              {tab === "archive"
                ? "Заархивированные проекты появятся здесь"
                : "Проекты создаются автоматически при переводе сделки в статус «Договор»"}
            </span>
          </div>
        ) : (
          displayProjects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              tab={tab}
              isAction={actionId === p.id}
              isConfirm={confirmId === p.id}
              isConstructionDirector={isConstructionDirector}
              isDirector={isDirector}
              canArchive={canArchive}
              role={role}
              onApprove={() => handleApprove(p)}
              onArchive={() => handleArchive(p)}
              onRestoreConfirm={() => setConfirmId(p.id)}
              onCancelConfirm={() => setConfirmId(null)}
              onRestore={() => handleRestore(p)}
              onComplete={() => handleComplete(p)}
              onCancel={() => handleCancel(p)}
              onMaterialRequest={() => setMaterialModalProject(p)}
              onCreateAct={() => setActModalProject(p)}
              onAddressSaved={load}
            />
          ))
        )}
      </div>

      {materialModalProject && (
        <MaterialRequestModal
          projectId={materialModalProject.id}
          projectCode={materialModalProject.code}
          onClose={() => setMaterialModalProject(null)}
          onCreated={() => setMaterialModalProject(null)}
        />
      )}

      {actModalProject && (
        <CreateActModal
          project={actModalProject}
          onClose={() => setActModalProject(null)}
          onCreated={() => { setActModalProject(null); load(); }}
        />
      )}
    </div>
  );
}