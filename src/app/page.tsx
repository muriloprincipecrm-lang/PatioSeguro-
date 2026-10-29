"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

type ForkliftType = "GLP / Diesel" | "Elétrica";
type Answer = "SIM" | "NÃO" | null;
type InspectionStatus = "APROVADO" | "REPROVADO" | "REPROVADO / CRÍTICO";
type View = "form" | "history";

type ChecklistHeader = {
  forkliftType: ForkliftType;
  equipmentId: string;
  unit: string;
  shift: string;
  operator: string;
  startTime: string;
  initialHourMeter: string;
};

type CheckItem = {
  id: string;
  label: string;
  critical?: boolean;
};

type Checklist = {
  id: string;
  header: ChecklistHeader;
  answers: Record<string, Answer>;
  observations: Record<string, string>;
  createdAt: string;
  status: InspectionStatus;
};

const STORAGE_KEY = "forklift-daily-checklists-v1";

const itemsByType: Record<ForkliftType, CheckItem[]> = {
  "GLP / Diesel": [
    { id: "radiator-water", label: 'Nível de água do radiador "ok"? (verificar com o motor frio)' },
    { id: "engine-oil", label: 'Nível de óleo do motor "ok"? (verificar com o motor frio)', critical: true },
    { id: "transmission-oil", label: 'Nível de óleo da transmissão "ok"? (verificar com o motor frio)' },
    { id: "fuel", label: "Nível de combustível “ok”?" },
    { id: "hydraulics", label: "Comandos hidráulicos funcionando corretamente?" },
    { id: "steering", label: "Sistema de direção funcionando corretamente?", critical: true },
    { id: "leaks", label: "O equipamento está sem vazamentos de óleo?" },
    { id: "tires", label: "Pneus e rodas em boas condições?" },
    { id: "fire-extinguisher", label: 'Extintor de incêndio "ok" (vencimento e conservação)?' },
    { id: "forks", label: "Garfos e travas em boas condições?" },
    { id: "dashboard", label: "Painel de instrumentos funcionando corretamente?" },
    { id: "lights", label: "Faróis e lanternas funcionando corretamente?" },
    { id: "reverse-alarm", label: "Luz e alarme de ré funcionando corretamente?" },
    { id: "horn", label: "Buzina funcionando?", critical: true },
    { id: "seat-belt", label: 'Cinto de segurança "ok"?', critical: true },
    { id: "mirrors", label: "Retrovisores em bom estado? (quando aplicável)" },
    { id: "brakes", label: "Sistema de freio e pedais em boas condições?", critical: true },
  ],
  Elétrica: [
    { id: "battery-connectors", label: "Bateria / Conectores em perfeitas condições?" },
    { id: "load-drive-wheels", label: "Rodas de carga e tração em perfeitas condições?" },
    { id: "forks", label: "Garfos e travas em condições?" },
    { id: "battery-water", label: 'Nível de água da bateria "ok"? (verificar somente com o motor frio)' },
    { id: "leaks", label: "O equipamento está sem vazamentos de óleo?" },
    { id: "battery-lock", label: 'Trava da bateria "ok"?' },
    { id: "battery-charge", label: "Carga da bateria nível máximo?" },
    { id: "hydraulics", label: "Comandos hidráulicos funcionando corretamente?" },
    { id: "dashboard", label: "Painel de instrumentos funcionando corretamente?" },
    { id: "brakes", label: "Sistema de freio e pedais em boas condições?", critical: true },
    { id: "steering", label: "Sistema de direção funcionando corretamente?", critical: true },
    { id: "horn", label: "Buzina funcionando?", critical: true },
    { id: "reverse-alarm", label: "Luz e alarme de ré funcionando corretamente?", critical: true },
    { id: "seat-belt", label: 'Cinto de segurança "ok"?', critical: true },
    { id: "mirrors", label: "Retrovisores em bom estado? (quando aplicável)" },
  ],
};

const emptyHeader = (): ChecklistHeader => ({
  forkliftType: "GLP / Diesel",
  equipmentId: "",
  unit: "",
  shift: "",
  operator: "",
  startTime: "",
  initialHourMeter: "",
});

function isForkliftType(value: unknown): value is ForkliftType {
  return value === "GLP / Diesel" || value === "Elétrica";
}

function isChecklist(value: unknown): value is Checklist {
  if (typeof value !== "object" || value === null) return false;
  const checklist = value as Record<string, unknown>;
  if (
    typeof checklist.id !== "string" ||
    typeof checklist.createdAt !== "string" ||
    typeof checklist.header !== "object" ||
    checklist.header === null ||
    typeof checklist.answers !== "object" ||
    checklist.answers === null ||
    typeof checklist.observations !== "object" ||
    checklist.observations === null
  ) {
    return false;
  }
  const header = checklist.header as Record<string, unknown>;
  if (
    isForkliftType(header.forkliftType) &&
    typeof header.equipmentId === "string" &&
    typeof header.unit === "string" &&
    typeof header.shift === "string" &&
    typeof header.operator === "string" &&
    ["1º Turno", "2º Turno", "3º Turno"].includes(String(header.shift)) &&
    typeof header.startTime === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(header.startTime) &&
    typeof header.initialHourMeter === "string" &&
    Number.isFinite(Number(header.initialHourMeter)) &&
    Number(header.initialHourMeter) >= 0 &&
    !Number.isNaN(Date.parse(checklist.createdAt))
  ) {
    const answers = checklist.answers as Record<string, unknown>;
    const observations = checklist.observations as Record<string, unknown>;
    for (const item of itemsByType[header.forkliftType]) {
      const answer = answers[item.id];
      const observation = observations[item.id];
      if (
        (answer !== "SIM" && answer !== "NÃO" && answer !== null) ||
        (observation !== undefined && typeof observation !== "string") ||
        (answer === "NÃO" &&
          (typeof observation !== "string" || !observation.trim()))
      ) {
        return false;
      }
    }
    const hasCriticalFailure = itemsByType[header.forkliftType].some(
      (item) => item.critical && answers[item.id] === "NÃO",
    );
    const hasFailure = itemsByType[header.forkliftType].some(
      (item) => answers[item.id] === "NÃO",
    );
    const expectedStatus: InspectionStatus = hasCriticalFailure
      ? "REPROVADO / CRÍTICO"
      : hasFailure
        ? "REPROVADO"
        : "APROVADO";
    return checklist.status === expectedStatus;
  }
  return false;
}

function getAnswers(type: ForkliftType): Record<string, Answer> {
  return Object.fromEntries(itemsByType[type].map((item) => [item.id, null]));
}

function getChecklistStatus(
  answers: Record<string, Answer>,
  type: ForkliftType,
): InspectionStatus {
  const items = itemsByType[type];
  if (items.some((item) => item.critical && answers[item.id] === "NÃO")) {
    return "REPROVADO / CRÍTICO";
  }
  return items.some((item) => answers[item.id] === "NÃO")
    ? "REPROVADO"
    : "APROVADO";
}

function StatusBadge({ status }: { status: InspectionStatus }) {
  const styles: Record<InspectionStatus, string> = {
    APROVADO: "bg-emerald-100 text-emerald-800 ring-emerald-200",
    REPROVADO: "bg-amber-100 text-amber-800 ring-amber-200",
    "REPROVADO / CRÍTICO": "bg-red-100 text-red-800 ring-red-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ${styles[status]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function Icon({
  name,
  size = 20,
}: {
  name: "forklift" | "clipboard" | "history" | "plus" | "check" | "warning" | "search" | "edit" | "trash" | "eye" | "close" | "arrow";
  size?: number;
}) {
  const paths: Record<typeof name, ReactNode> = {
    forklift: <><path d="M3 17h13V7H6a3 3 0 0 0-3 3v7Z" /><path d="M16 11h3l2 3v3h-5M7 17a2 2 0 1 0 4 0M17 17a2 2 0 1 0 4 0M6 7V4h7v3M5 11h5" /></>,
    clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><path d="M9 5V3h6v2M9 11h6m-6 4h6" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
    plus: <><path d="M12 5v14m-7-7h14" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    warning: <><path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" /></>,
    eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function Home() {
  const [view, setView] = useState<View>("form");
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [header, setHeader] = useState<ChecklistHeader>(emptyHeader);
  const [answers, setAnswers] = useState<Record<string, Answer>>(() =>
    getAnswers("GLP / Diesel"),
  );
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState("");
  const [formError, setFormError] = useState("");
  const [detail, setDetail] = useState<Checklist | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (!Array.isArray(parsed) || !parsed.every(isChecklist)) {
            throw new Error("Os dados salvos não estão em um formato válido.");
          }
          setChecklists(parsed);
        }
      } catch (error) {
        setStorageError(
          error instanceof Error
            ? `Não foi possível carregar o histórico: ${error.message}`
            : "Não foi possível carregar o histórico salvo.",
        );
      } finally {
        setIsLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const currentItems = itemsByType[header.forkliftType];
  const criticalFailure = currentItems.some(
    (item) => item.critical && answers[item.id] === "NÃO",
  );
  const answeredCount = currentItems.filter(
    (item) => answers[item.id] !== null,
  ).length;

  const filteredChecklists = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return checklists
      .filter((checklist) => {
        const matchesQuery =
          !query ||
          checklist.header.equipmentId.toLocaleLowerCase("pt-BR").includes(query) ||
          checklist.header.operator.toLocaleLowerCase("pt-BR").includes(query) ||
          checklist.header.unit.toLocaleLowerCase("pt-BR").includes(query);
        const matchesStatus =
          statusFilter === "Todos" ||
          (statusFilter === "Aprovados" && checklist.status === "APROVADO") ||
          (statusFilter === "Reprovados" && checklist.status !== "APROVADO");
        return matchesQuery && matchesStatus;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [checklists, search, statusFilter]);

  const approvedCount = checklists.filter(
    (checklist) => checklist.status === "APROVADO",
  ).length;
  const rejectedCount = checklists.length - approvedCount;

  function persistChecklists(next: Checklist[]) {
    setChecklists(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStorageError("");
    } catch {
      setStorageError(
        "O registro foi mantido nesta sessão, mas não foi possível salvá-lo no navegador.",
      );
    }
  }

  function updateHeader<Key extends keyof ChecklistHeader>(
    key: Key,
    value: ChecklistHeader[Key],
  ) {
    setHeader((current) => ({ ...current, [key]: value }));
  }

  function changeForkliftType(type: ForkliftType) {
    setHeader((current) => ({ ...current, forkliftType: type }));
    setAnswers(getAnswers(type));
    setObservations({});
    setFormError("");
  }

  function startNewChecklist() {
    setHeader(emptyHeader());
    setAnswers(getAnswers("GLP / Diesel"));
    setObservations({});
    setEditingId(null);
    setFormError("");
    setView("form");
  }

  function editChecklist(checklist: Checklist) {
    setHeader({ ...checklist.header });
    setAnswers({ ...checklist.answers });
    setObservations({ ...checklist.observations });
    setEditingId(checklist.id);
    setFormError("");
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveChecklist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const incomplete = currentItems.some((item) => answers[item.id] === null);
    const missingObservation = currentItems.find(
      (item) =>
        answers[item.id] === "NÃO" && !observations[item.id]?.trim(),
    );

    if (
      !header.equipmentId.trim() ||
      !header.unit.trim() ||
      !header.shift ||
      !header.operator.trim() ||
      !header.startTime ||
      !header.initialHourMeter
    ) {
      setFormError("Preencha todos os dados da empilhadeira e do operador.");
      return;
    }
    if (incomplete) {
      setFormError("Marque SIM ou NÃO em todos os itens antes de salvar.");
      return;
    }
    if (missingObservation) {
      setFormError(
        `Descreva a anormalidade em: ${missingObservation.label}`,
      );
      document.getElementById(`observation-${missingObservation.id}`)?.focus();
      return;
    }

    const existing = editingId
      ? checklists.find((checklist) => checklist.id === editingId)
      : undefined;
    const checklist: Checklist = {
      id: editingId ?? crypto.randomUUID(),
      header: { ...header },
      answers: { ...answers },
      observations: { ...observations },
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      status: getChecklistStatus(answers, header.forkliftType),
    };
    const next = editingId
      ? checklists.map((entry) => (entry.id === editingId ? checklist : entry))
      : [checklist, ...checklists];
    persistChecklists(next);
    setEditingId(null);
    setFormError("");
    setView("history");
  }

  function deleteChecklist(checklist: Checklist) {
    const approved = window.confirm(
      `Excluir o checklist da empilhadeira ${checklist.header.equipmentId}? Esta ação não pode ser desfeita.`,
    );
    if (approved) {
      persistChecklists(
        checklists.filter((entry) => entry.id !== checklist.id),
      );
      if (detail?.id === checklist.id) setDetail(null);
    }
  }

  function setAnswer(item: CheckItem, answer: Answer) {
    setAnswers((current) => ({ ...current, [item.id]: answer }));
    if (answer !== "NÃO") {
      setObservations((current) => ({ ...current, [item.id]: "" }));
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-white">
              <Icon name="forklift" size={25} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                Pátio<span className="text-blue-800">Seguro</span>
              </p>
              <p className="hidden text-xs text-slate-500 sm:block">
                Inspeção diária de empilhadeiras
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 sm:flex">
            <span className="size-2 rounded-full bg-emerald-500" />
            Controle operacional
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-blue-800">
              <span className="size-2 rounded-sm bg-orange-500" />
              Segurança em primeiro lugar
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">
              Checklist diário
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Inspecione o equipamento antes de iniciar a operação.
            </p>
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Navegação do checklist">
            <button
              type="button"
              onClick={startNewChecklist}
              aria-current={view === "form" ? "page" : undefined}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition sm:flex-none ${view === "form" ? "bg-blue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon name="clipboard" size={18} />
              Novo checklist
            </button>
            <button
              type="button"
              onClick={() => setView("history")}
              aria-current={view === "history" ? "page" : undefined}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition sm:flex-none ${view === "history" ? "bg-blue-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon name="history" size={18} />
              Histórico
              {checklists.length > 0 && (
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${view === "history" ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {checklists.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <section className="mb-5 grid grid-cols-3 gap-2 sm:mb-6 sm:gap-3">
          <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 text-center shadow-sm sm:flex-row sm:gap-4 sm:p-4 sm:text-left">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-900 sm:size-11"><Icon name="clipboard" size={18} /></span>
            <div><p className="text-xl font-extrabold leading-none sm:text-2xl">{checklists.length}</p><p className="mt-1.5 text-[10px] font-medium leading-tight text-slate-500 sm:text-xs">Inspeções</p></div>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 text-center shadow-sm sm:flex-row sm:gap-4 sm:p-4 sm:text-left">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 sm:size-11"><Icon name="check" size={18} /></span>
            <div><p className="text-xl font-extrabold leading-none sm:text-2xl">{approvedCount}</p><p className="mt-1.5 text-[10px] font-medium leading-tight text-slate-500 sm:text-xs">Aprovadas</p></div>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 text-center shadow-sm sm:flex-row sm:gap-4 sm:p-4 sm:text-left">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-700 sm:size-11"><Icon name="warning" size={18} /></span>
            <div><p className="text-xl font-extrabold leading-none sm:text-2xl">{rejectedCount}</p><p className="mt-1.5 text-[10px] font-medium leading-tight text-slate-500 sm:text-xs">Pendências</p></div>
          </div>
        </section>

        {storageError && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <Icon name="warning" size={19} />
            <p>{storageError}</p>
          </div>
        )}

        {view === "form" ? (
          <form onSubmit={saveChecklist} noValidate className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-900"><Icon name="forklift" /></span>
                  <div>
                    <h2 className="font-bold text-slate-900">Identificação da inspeção</h2>
                    <p className="mt-1 text-xs text-slate-500">Informe os dados do equipamento, do turno e do operador.</p>
                  </div>
                </div>
                <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">Todos os campos são obrigatórios</span>
              </div>
              <div className="grid grid-cols-1 gap-x-5 gap-y-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2 lg:col-span-2">
                  Tipo de empilhadeira
                  <select
                    value={header.forkliftType}
                    onChange={(event) => changeForkliftType(event.target.value as ForkliftType)}
                    className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-700 focus:ring-4 focus:ring-blue-100"
                  >
                    <option>GLP / Diesel</option>
                    <option>Elétrica</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                  Número / identificador
                  <input value={header.equipmentId} onChange={(event) => updateHeader("equipmentId", event.target.value)} placeholder="Ex.: EMP-01" maxLength={30} autoComplete="off" className="min-h-12 rounded-xl border border-slate-300 px-3 text-base uppercase placeholder:normal-case placeholder:text-slate-400 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                  Unidade / divisão
                  <input value={header.unit} onChange={(event) => updateHeader("unit", event.target.value)} placeholder="Ex.: Centro de distribuição" maxLength={80} className="min-h-12 rounded-xl border border-slate-300 px-3 text-base placeholder:text-slate-400 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                  Turno
                  <select value={header.shift} onChange={(event) => updateHeader("shift", event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100">
                    <option value="">Selecione o turno</option>
                    <option>1º Turno</option><option>2º Turno</option><option>3º Turno</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700 sm:col-span-2">
                  Nome do operador
                  <input value={header.operator} onChange={(event) => updateHeader("operator", event.target.value)} placeholder="Nome completo do operador" maxLength={100} autoComplete="name" className="min-h-12 rounded-xl border border-slate-300 px-3 text-base placeholder:text-slate-400 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                  Hora de início
                  <input type="time" value={header.startTime} onChange={(event) => updateHeader("startTime", event.target.value)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-base outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100" />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-700">
                  Horímetro inicial
                  <input type="number" min="0" step="0.1" inputMode="decimal" value={header.initialHourMeter} onChange={(event) => updateHeader("initialHourMeter", event.target.value)} placeholder="Ex.: 1.250,5" className="min-h-12 rounded-xl border border-slate-300 px-3 text-base placeholder:text-slate-400 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100" />
                </label>
              </div>
            </section>

            {criticalFailure && (
              <div role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-red-500 bg-red-50 p-4 text-red-950 shadow-sm sm:items-center sm:p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><Icon name="warning" size={24} /></span>
                <div><p className="text-sm font-extrabold tracking-wide sm:text-base">EQUIPAMENTO IMPEDIDO DE OPERAR!</p><p className="mt-1 text-sm font-medium">Comunique o superior imediatamente.</p></div>
              </div>
            )}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-900"><Icon name="clipboard" /></span>
                  <div>
                    <h2 className="font-bold text-slate-900">Itens de checagem</h2>
                    <p className="mt-1 text-xs text-slate-500">Marque a condição atual de cada componente do equipamento.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600">{answeredCount} de {currentItems.length} verificados</span>
                  <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100 sm:w-28"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(answeredCount / currentItems.length) * 100}%` }} /></div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {currentItems.map((item, index) => (
                  <fieldset key={`${header.forkliftType}-${item.id}`} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6 sm:py-4">
                    <legend className="sr-only">Item {index + 1}: {item.label}</legend>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 pt-1">
                        <p className="text-sm font-medium leading-5 text-slate-800">{item.label}</p>
                        {item.critical && <span className="mt-1.5 inline-flex rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-red-700 ring-1 ring-inset ring-red-200">Impeditivo</span>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:w-52">
                      {(["SIM", "NÃO"] as const).map((answer) => {
                        const selected = answers[item.id] === answer;
                        const isNo = answer === "NÃO";
                        return (
                          <button
                            key={answer}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`${item.label}: ${answer}${item.critical && isNo ? ", item impeditivo" : ""}`}
                            onClick={() => setAnswer(item, answer)}
                            className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 text-sm font-extrabold transition active:scale-[0.98] ${selected && !isNo ? "border-emerald-600 bg-emerald-50 text-emerald-800" : selected ? "border-red-600 bg-red-50 text-red-800" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400 hover:bg-slate-50"}`}
                          >
                            {selected && <Icon name={isNo ? "warning" : "check"} size={16} />}
                            {answer}
                          </button>
                        );
                      })}
                    </div>
                    {answers[item.id] === "NÃO" && (
                      <label className="flex flex-col gap-1.5 text-xs font-bold text-red-800 sm:col-span-2 sm:pl-10">
                        Descreva a anormalidade <span className="font-medium text-slate-500">— obrigatório para registrar este item</span>
                        <textarea
                          id={`observation-${item.id}`}
                          required
                          rows={2}
                          maxLength={500}
                          value={observations[item.id] ?? ""}
                          onChange={(event) => setObservations((current) => ({ ...current, [item.id]: event.target.value }))}
                          placeholder="Informe o problema identificado e, se necessário, a localização..."
                          className="min-h-20 resize-y rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-500 focus:ring-4 focus:ring-red-100"
                        />
                      </label>
                    )}
                  </fieldset>
                ))}
              </div>
              <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-xs leading-5 text-slate-500"><span className="font-bold text-red-700">Impeditivo:</span> uma resposta NÃO reprova o equipamento e impede sua operação.</p>
                <span className="w-fit rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{currentItems.length} itens · {currentItems.filter((item) => item.critical).length} impeditivos</span>
              </div>
            </section>

            {formError && (
              <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                <Icon name="warning" size={18} />
                <p>{formError}</p>
              </div>
            )}
            <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:gap-3 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
              <button type="button" onClick={startNewChecklist} className="hidden min-h-12 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:inline-flex sm:items-center sm:justify-center">Limpar formulário</button>
              <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-6 text-sm font-bold text-white shadow-lg shadow-blue-900/15 transition hover:bg-blue-800 active:scale-[0.99] sm:w-auto">
                <Icon name="check" size={19} />
                {editingId ? "Salvar alterações" : "Finalizar inspeção"}
              </button>
            </div>
          </form>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-bold text-slate-900">Histórico de inspeções</h2>
                  <p className="mt-1 text-xs text-slate-500">Consulte, edite ou remova checklists registrados neste dispositivo.</p>
                </div>
                <button type="button" onClick={startNewChecklist} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 text-sm font-bold text-white hover:bg-blue-800"><Icon name="plus" size={18} />Novo checklist</button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-slate-300 px-3 text-slate-400 focus-within:border-blue-700 focus-within:ring-4 focus-within:ring-blue-100">
                  <Icon name="search" size={18} />
                  <input aria-label="Buscar por empilhadeira, operador ou unidade" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar empilhadeira, operador ou unidade..." className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
                </label>
                <select aria-label="Filtrar por resultado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-700 focus:ring-4 focus:ring-blue-100">
                  <option>Todos</option><option>Aprovados</option><option>Reprovados</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="flex min-h-60 items-center justify-center gap-3 text-sm text-slate-500"><span className="size-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-900" />Carregando histórico...</div>
            ) : filteredChecklists.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <span className="grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-900"><Icon name="history" size={25} /></span>
                <h3 className="mt-4 font-bold text-slate-900">{checklists.length === 0 ? "Nenhuma inspeção registrada" : "Nenhum resultado encontrado"}</h3>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{checklists.length === 0 ? "Preencha o checklist diário para manter o histórico de segurança da frota." : "Ajuste sua busca ou os filtros e tente novamente."}</p>
                {checklists.length === 0 && <button type="button" onClick={startNewChecklist} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-900 px-4 text-sm font-bold text-white hover:bg-blue-800"><Icon name="plus" size={18} />Iniciar checklist</button>}
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[790px] border-collapse text-left">
                    <thead className="bg-blue-900 text-white"><tr>{["Data / hora", "Empilhadeira", "Operador / turno", "Unidade", "Resultado", "Ações"].map((heading) => <th key={heading} className="px-4 py-3.5 text-xs font-bold first:pl-6 last:pr-6">{heading}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredChecklists.map((checklist) => (
                        <tr key={checklist.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-4 pl-6 text-xs text-slate-600">{dateTime(checklist.createdAt)}</td>
                          <td className="px-4 py-4"><p className="text-sm font-bold text-slate-900">{checklist.header.equipmentId}</p><p className="mt-1 text-xs text-slate-500">{checklist.header.forkliftType}</p></td>
                          <td className="px-4 py-4"><p className="text-sm font-semibold text-slate-800">{checklist.header.operator}</p><p className="mt-1 text-xs text-slate-500">{checklist.header.shift} · início às {checklist.header.startTime}</p></td>
                          <td className="px-4 py-4 text-sm text-slate-600">{checklist.header.unit}</td>
                          <td className="px-4 py-4"><StatusBadge status={checklist.status} /></td>
                          <td className="px-4 py-4 pr-6"><div className="flex items-center gap-1">
                            <button type="button" onClick={() => setDetail(checklist)} aria-label={`Ver checklist ${checklist.header.equipmentId}`} title="Ver detalhes" className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-900"><Icon name="eye" size={18} /></button>
                            <button type="button" onClick={() => editChecklist(checklist)} aria-label={`Editar checklist ${checklist.header.equipmentId}`} title="Editar" className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-900"><Icon name="edit" size={18} /></button>
                            <button type="button" onClick={() => deleteChecklist(checklist)} aria-label={`Excluir checklist ${checklist.header.equipmentId}`} title="Excluir" className="grid size-10 place-items-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"><Icon name="trash" size={18} /></button>
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-slate-100 md:hidden">
                  {filteredChecklists.map((checklist) => (
                    <article key={checklist.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-extrabold text-slate-900">{checklist.header.equipmentId}</p><p className="mt-1 text-xs text-slate-500">{checklist.header.forkliftType} · {dateTime(checklist.createdAt)}</p></div>
                        <StatusBadge status={checklist.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><p className="text-slate-500">Operador</p><p className="mt-0.5 font-semibold text-slate-800">{checklist.header.operator}</p></div><div><p className="text-slate-500">Turno</p><p className="mt-0.5 font-semibold text-slate-800">{checklist.header.shift}</p></div><div className="col-span-2"><p className="text-slate-500">Unidade</p><p className="mt-0.5 font-semibold text-slate-800">{checklist.header.unit}</p></div></div>
                      <div className="mt-3 flex justify-end gap-1 border-t border-slate-100 pt-2">
                        <button type="button" onClick={() => setDetail(checklist)} aria-label={`Ver checklist ${checklist.header.equipmentId}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-blue-50"><Icon name="eye" size={17} />Ver</button>
                        <button type="button" onClick={() => editChecklist(checklist)} aria-label={`Editar checklist ${checklist.header.equipmentId}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-blue-50"><Icon name="edit" size={17} />Editar</button>
                        <button type="button" onClick={() => deleteChecklist(checklist)} aria-label={`Excluir checklist ${checklist.header.equipmentId}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold text-red-700 hover:bg-red-50"><Icon name="trash" size={17} />Excluir</button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-6">
              {filteredChecklists.length} {filteredChecklists.length === 1 ? "inspeção" : "inspeções"} exibida(s) · dados salvos somente neste dispositivo
            </div>
          </section>
        )}

        <footer className="py-6 text-center text-xs text-slate-400">PátioSeguro · Inspecione antes de operar · Registros armazenados neste dispositivo</footer>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="detail-title" className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div><div className="flex flex-wrap items-center gap-2"><h2 id="detail-title" className="text-lg font-extrabold text-slate-900">Checklist {detail.header.equipmentId}</h2><StatusBadge status={detail.status} /></div><p className="mt-1 text-xs text-slate-500">{dateTime(detail.createdAt)} · {detail.header.forkliftType}</p></div>
              <button type="button" onClick={() => setDetail(null)} aria-label="Fechar detalhes" className="grid size-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><Icon name="close" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4 px-5 py-4 text-sm sm:grid-cols-3 sm:px-6">
              {[["Operador", detail.header.operator], ["Unidade", detail.header.unit], ["Turno", detail.header.shift], ["Início", detail.header.startTime], ["Horímetro", detail.header.initialHourMeter], ["Equipamento", detail.header.equipmentId]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-800">{value}</p></div>)}
            </div>
            <div className="divide-y divide-slate-100 border-t border-slate-100 px-5 sm:px-6">
              {itemsByType[detail.header.forkliftType].map((item, index) => (
                <div key={item.id} className="flex items-start gap-3 py-3">
                  <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${detail.answers[item.id] === "SIM" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{detail.answers[item.id] === "SIM" ? <Icon name="check" size={14} /> : <Icon name="close" size={14} />}</span>
                  <div className="min-w-0 flex-1"><p className="text-sm text-slate-800">{index + 1}. {item.label}{item.critical && <span className="ml-2 text-[10px] font-bold uppercase text-red-700">Impeditivo</span>}</p>{detail.answers[item.id] === "NÃO" && <p className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-800"><strong>Anormalidade:</strong> {detail.observations[item.id]}</p>}</div>
                  <span className={`text-xs font-extrabold ${detail.answers[item.id] === "SIM" ? "text-emerald-700" : "text-red-700"}`}>{detail.answers[item.id]}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-4 sm:px-6">
              <button type="button" onClick={() => { setDetail(null); editChecklist(detail); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-900 px-4 text-sm font-bold text-white hover:bg-blue-800"><Icon name="edit" size={17} />Editar checklist</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
