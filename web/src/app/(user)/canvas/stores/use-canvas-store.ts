import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import { nanoid } from "nanoid";
import { localForageStorage } from "@/lib/localforage-storage";
import { deleteImagePreviews } from "@/services/image-storage";
import { listCanvasProjects, saveCanvasProject, syncCanvasProjects } from "@/services/api/canvas-tasks";
import { fetchUserConfig } from "@/services/api/user-config";
import { useUserStore } from "@/stores/use-user-store";
import { useCanvasSaveStore } from "./use-canvas-save-store";
import type { CanvasBackgroundMode } from "@/lib/canvas-theme";
import type { CanvasAgentConfig, CanvasAssistantSession, CanvasConnection, CanvasNodeData, CanvasPendingAgentRequest, ViewportTransform } from "../types";

export type CanvasSidePanelState = {
    open: boolean;
    width: number;
};

export const DEFAULT_CANVAS_SIDE_PANEL: CanvasSidePanelState = { open: true, width: 280 };
export const DEFAULT_CANVAS_AGENT_PANEL: CanvasSidePanelState = { open: false, width: 464 };

export type CanvasProject = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    nodes: CanvasNodeData[];
    connections: CanvasConnection[];
    chatSessions: CanvasAssistantSession[];
    activeChatId: string | null;
    agentConfig: CanvasAgentConfig | null;
    autoTitlePending: boolean;
    pendingAgentRequest?: CanvasPendingAgentRequest;
    backgroundMode: CanvasBackgroundMode;
    showImageInfo: boolean;
    viewport: ViewportTransform;
    sidePanel: CanvasSidePanelState;
    agentPanel: CanvasSidePanelState;
};

type CanvasStore = {
    hydrated: boolean;
    projects: CanvasProject[];
    createProject: (title?: string, options?: { agentConfig?: CanvasAgentConfig; pendingAgentRequest?: CanvasPendingAgentRequest }) => string;
    importProject: (project: Partial<CanvasProject>) => string;
    openProject: (id: string) => CanvasProject | null;
    renameProject: (id: string, title: string) => void;
    deleteProjects: (ids: string[]) => void;
    updateProject: (id: string, patch: Partial<Pick<CanvasProject, "nodes" | "connections" | "chatSessions" | "activeChatId" | "agentConfig" | "autoTitlePending" | "backgroundMode" | "showImageInfo" | "viewport" | "sidePanel" | "agentPanel" | "pendingAgentRequest">>) => void;
    syncWithRemote: (token: string, syncEnabled: boolean) => Promise<void>;
    setSyncEnabled: (enabled: boolean) => void;
};

const initialViewport: ViewportTransform = { x: 0, y: 0, k: 1 };
const CANVAS_STORE_KEY = "infinite-canvas:canvas_store";
type PersistedCanvasState = Pick<CanvasStore, "projects">;
let saveTimerHandle: ReturnType<typeof setTimeout> | null = null;
let queuedPersistState: PersistedCanvasState | null = null;
let accountCanvasSyncEnabled = false;
const projectSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingProjectSaves = new Map<string, { token: string; project: CanvasProject }>();
const failedProjectSaves = new Map<string, { token: string; project: CanvasProject }>();
const savingProjects = new Set<string>();

const CANVAS_SNAPSHOT_PREFIX = "infinite-canvas:canvas_snapshots:";
const CANVAS_SNAPSHOT_LIMIT = 5;

export type CanvasProjectSnapshot = { at: string; signature: string; project: CanvasProject };

export function canvasProjectSignature(project: CanvasProject): string {
    const contentSize = (project.nodes || []).reduce((total, node) => total + (node.metadata?.content?.length || 0), 0);
    return [project.title, project.nodes?.length || 0, project.connections?.length || 0, project.chatSessions?.length || 0, contentSize].join("|");
}

function waitForUserStoreHydration() {
    if (useUserStore.persist.hasHydrated()) return Promise.resolve();

    return new Promise<void>((resolve) => {
        let unsubscribe = () => { };
        unsubscribe = useUserStore.persist.onFinishHydration(() => {
            unsubscribe();
            resolve();
        });
        if (useUserStore.persist.hasHydrated()) {
            unsubscribe();
            resolve();
        }
    });
}

async function flushProjectSave(id: string) {
    if (savingProjects.has(id) || projectSaveTimers.has(id)) return;
    const pending = pendingProjectSaves.get(id);
    pendingProjectSaves.delete(id);
    if (!pending || !accountCanvasSyncEnabled || useUserStore.getState().token !== pending.token) return;

    savingProjects.add(id);
    useCanvasSaveStore.getState().markSaving();
    try {
        await saveCanvasProject(pending.token, pending.project);
        useCanvasSaveStore.getState().markSaved();
    } catch (error) {
        // 保存失败也不丢失：放入失败队列，交给自动保存定时重试，避免立刻死循环
        failedProjectSaves.set(id, pending);
        console.warn("[canvas] 画布保存失败，已进入自动重试队列", id, error);
    }
    savingProjects.delete(id);
    if (failedProjectSaves.has(id)) return;
    void flushProjectSave(id);
}

function retryFailedProjectSaves() {
    if (!failedProjectSaves.size) return 0;
    const token = useUserStore.getState().token;
    let count = 0;
    failedProjectSaves.forEach((pending, id) => {
        failedProjectSaves.delete(id);
        if (!accountCanvasSyncEnabled || token !== pending.token) return;
        if (!pendingProjectSaves.has(id) && !savingProjects.has(id)) {
            pendingProjectSaves.set(id, pending);
            count += 1;
        }
    });
    return count;
}

function queueProjectSave(project: CanvasProject) {
    const token = useUserStore.getState().token;
    const previous = projectSaveTimers.get(project.id);
    if (previous) clearTimeout(previous);
    projectSaveTimers.delete(project.id);
    if (!token || !accountCanvasSyncEnabled) {
        pendingProjectSaves.delete(project.id);
        useCanvasSaveStore.getState().markDirty();
        return;
    }
    pendingProjectSaves.set(project.id, { token, project });
    useCanvasSaveStore.getState().markDirty();
    projectSaveTimers.set(
        project.id,
        setTimeout(() => {
            projectSaveTimers.delete(project.id);
            void flushProjectSave(project.id);
        }, 400),
    );
}

export function flushCanvasSavesNow() {
    retryFailedProjectSaves();
    const ids = Array.from(new Set([...projectSaveTimers.keys(), ...pendingProjectSaves.keys()]));
    ids.forEach((id) => {
        const timer = projectSaveTimers.get(id);
        if (timer) clearTimeout(timer);
        projectSaveTimers.delete(id);
    });
    ids.forEach((id) => void flushProjectSave(id));
    return ids.length;
}

export async function persistCanvasStateNow() {
    if (typeof window === "undefined") return;
    const state = useCanvasStore.getState();
    const nextState: PersistedCanvasState = { projects: state.projects };
    queuedPersistState = nextState;
    if (saveTimerHandle) {
        clearTimeout(saveTimerHandle);
        saveTimerHandle = null;
    }
    const statusBefore = useCanvasSaveStore.getState().status;
    try {
        await localForageStorage.setItem(CANVAS_STORE_KEY, JSON.stringify({ state: { projects: state.projects }, version: 0 }));
        if (statusBefore !== "saved" && statusBefore !== "idle") {
            useCanvasSaveStore.getState().markSaved();
        }
    } catch (error) {
        console.warn("[canvas] 本地保存失败", error);
        useCanvasSaveStore.getState().markError();
    }
}

export async function writeProjectSnapshot(projectId: string) {
    const project = useCanvasStore.getState().projects.find((item) => item.id === projectId);
    if (!project) return false;
    const signature = canvasProjectSignature(project);
    const key = CANVAS_SNAPSHOT_PREFIX + projectId;
    try {
        const raw = await localForageStorage.getItem(key);
        const parsed = raw ? (JSON.parse(raw as string) as { versions?: CanvasProjectSnapshot[] }) : {};
        const versions = parsed.versions || [];
        if (versions[0]?.signature === signature) return false;
        versions.unshift({ at: new Date().toISOString(), signature, project });
        while (versions.length > CANVAS_SNAPSHOT_LIMIT) versions.pop();
        await localForageStorage.setItem(key, JSON.stringify({ versions }));
        return true;
    } catch (error) {
        console.warn("[canvas] 写入画布快照失败", error);
        return false;
    }
}

export async function listProjectSnapshots(projectId: string): Promise<CanvasProjectSnapshot[]> {
    try {
        const raw = await localForageStorage.getItem(CANVAS_SNAPSHOT_PREFIX + projectId);
        if (!raw) return [];
        const parsed = JSON.parse(raw as string) as { versions?: CanvasProjectSnapshot[] };
        return parsed.versions || [];
    } catch {
        return [];
    }
}

function cancelProjectSaves(ids: string[]) {
    ids.forEach((id) => {
        pendingProjectSaves.delete(id);
        const timer = projectSaveTimers.get(id);
        if (!timer) return;
        clearTimeout(timer);
        projectSaveTimers.delete(id);
    });
}

async function reconcileCanvasProjects(
    token: string,
    remoteProjects: CanvasProject[],
    localProjects: CanvasProject[],
) {
    const remoteById = new Map(
        remoteProjects.map((project) => [project.id, project]),
    );
    const missingProjects = localProjects.filter(
        (project) => !remoteById.has(project.id),
    );
    const existingLocalProjects = localProjects.filter((project) =>
        remoteById.has(project.id),
    );
    const projects = missingProjects.length
        ? await syncCanvasProjects(token, missingProjects)
            .then((syncedProjects) =>
                mergeCanvasProjects(
                    syncedProjects,
                    existingLocalProjects,
                ),
            )
            .catch(() =>
                mergeCanvasProjects(remoteProjects, localProjects),
            )
        : mergeCanvasProjects(remoteProjects, existingLocalProjects);

    localProjects.forEach((project) => {
        const remote = remoteById.get(project.id);
        if (
            remote &&
            Date.parse(project.updatedAt || "") >
            Date.parse(remote.updatedAt || "")
        ) {
            queueProjectSave(project);
        }
    });

    return projects;
}

const canvasStorage: PersistStorage<CanvasStore> = {
    getItem: async (name) => {
        await waitForUserStoreHydration();
        const localValue = await localForageStorage.getItem(name);
        const token = useUserStore.getState().token;
        const localParsed = localValue
            ? (JSON.parse(localValue) as StorageValue<CanvasStore>)
            : null;
        const localProjects =
            (localParsed?.state as PersistedCanvasState)?.projects || [];
        const localHasData =
            Array.isArray(localProjects) && localProjects.length > 0;

        if (token) {
            try {
                const [userConfig, remoteProjects] = await Promise.all([
                    fetchUserConfig(token),
                    listCanvasProjects(token),
                ]);
                accountCanvasSyncEnabled =
                    userConfig.syncCapabilities?.userData === true;

                if (accountCanvasSyncEnabled && localHasData) {
                    const projects = await reconcileCanvasProjects(
                        token,
                        remoteProjects,
                        localProjects,
                    );

                    const nextState = { projects };
                    const parsed = {
                        state: nextState,
                        version: 0,
                    } as StorageValue<CanvasStore>;
                    queuedPersistState = nextState;
                    await localForageStorage.setItem(
                        name,
                        JSON.stringify(parsed),
                    );
                    return parsed;
                }

                if (
                    remoteProjects.length > 0 &&
                    (accountCanvasSyncEnabled || !localHasData)
                ) {
                    const nextState = { projects: remoteProjects };
                    const parsed = {
                        state: nextState,
                        version: 0,
                    } as StorageValue<CanvasStore>;
                    queuedPersistState = nextState;
                    await localForageStorage.setItem(
                        name,
                        JSON.stringify(parsed),
                    );
                    return parsed;
                }
            } catch (error) {
                console.error(
                    "Failed to hydrate canvas projects from remote",
                    error,
                );
            }
        }

        if (!localParsed) return null;
        queuedPersistState = localParsed.state as PersistedCanvasState;
        return localParsed;
    },

    setItem: (name, value) => {
        const nextState = value.state as PersistedCanvasState;
        if (
            queuedPersistState &&
            queuedPersistState.projects === nextState.projects
        ) {
            return;
        }
        queuedPersistState = nextState;
        const saveStatus = useCanvasSaveStore.getState();
        if (saveStatus.status === "saved" || saveStatus.status === "idle") saveStatus.markDirty();
        if (saveTimerHandle) clearTimeout(saveTimerHandle);
        saveTimerHandle = setTimeout(() => {
            saveTimerHandle = null;
            void localForageStorage.setItem(name, JSON.stringify(value));
        }, 400);
    },
    removeItem: (name) => localForageStorage.removeItem(name),
};

export const useCanvasStore = create<CanvasStore>()(
    persist(
        (set, get) => ({
            hydrated: false,
            projects: [],
            createProject: (title = "未命名画布", options) => {
                const now = new Date().toISOString();
                const id = nanoid();
                const project: CanvasProject = {
                    id,
                    title,
                    createdAt: now,
                    updatedAt: now,
                    nodes: [],
                    connections: [],
                    chatSessions: [],
                    activeChatId: null,
                    agentConfig: options?.agentConfig || null,
                    autoTitlePending: true,
                    pendingAgentRequest: options?.pendingAgentRequest,
                    backgroundMode: "lines",
                    showImageInfo: false,
                    viewport: initialViewport,
                    sidePanel: DEFAULT_CANVAS_SIDE_PANEL,
                    agentPanel: options?.pendingAgentRequest ? { ...DEFAULT_CANVAS_AGENT_PANEL, open: true } : DEFAULT_CANVAS_AGENT_PANEL,
                };
                set((state) => ({
                    projects: [project, ...state.projects],
                }));
                queueProjectSave(project);
                return id;
            },
            importProject: (source) => {
                const now = new Date().toISOString();
                const project: CanvasProject = {
                    id: nanoid(),
                    title: source.title || "导入画布",
                    createdAt: source.createdAt || now,
                    updatedAt: now,
                    nodes: source.nodes || [],
                    connections: source.connections || [],
                    chatSessions: (source.chatSessions || []).map((session) => ({ ...session, codexThreadId: undefined, codexServiceId: undefined })),
                    activeChatId: source.activeChatId || null,
                    agentConfig: source.agentConfig || null,
                    autoTitlePending: false,
                    backgroundMode: source.backgroundMode || "lines",
                    showImageInfo: source.showImageInfo || false,
                    viewport: source.viewport || initialViewport,
                    sidePanel: source.sidePanel || DEFAULT_CANVAS_SIDE_PANEL,
                    agentPanel: source.agentPanel || DEFAULT_CANVAS_AGENT_PANEL,
                };
                set((state) => ({
                    projects: [project, ...state.projects],
                }));
                queueProjectSave(project);
                return project.id;
            },
            openProject: (id) =>
                get().projects.find((item) => item.id === id) || null,
            renameProject: (id, title) => {
                const project = get().projects.find(
                    (item) => item.id === id,
                );
                if (!project) return;
                const nextProject = {
                    ...project,
                    title: title.trim() || project.title,
                    autoTitlePending: false,
                    updatedAt: new Date().toISOString(),
                };
                set((state) => ({
                    projects: state.projects.map((item) =>
                        item.id === id ? nextProject : item,
                    ),
                }));
                queueProjectSave(nextProject);
            },
            deleteProjects: (ids) => {
                cancelProjectSaves(ids);
                void deleteImagePreviews(
                    get().projects
                        .filter((project) => ids.includes(project.id))
                        .flatMap((project) => project.nodes.map((node) => `canvas-node:${project.id}:${node.id}`)),
                );
                set((state) => ({
                    projects: state.projects.filter(
                        (project) => !ids.includes(project.id),
                    ),
                }));
            },
            updateProject: (id, patch) => {
                const project = get().projects.find(
                    (item) => item.id === id,
                );
                if (!project) return;
                const nextProject = {
                    ...project,
                    ...patch,
                    updatedAt: new Date().toISOString(),
                };
                set((state) => ({
                    projects: state.projects.map((item) =>
                        item.id === id ? nextProject : item,
                    ),
                }));
                queueProjectSave(nextProject);
            },
            syncWithRemote: async (token, syncEnabled) => {
                accountCanvasSyncEnabled = syncEnabled;
                if (!syncEnabled) return;
                const localProjects = get().projects;
                const remoteProjects = await listCanvasProjects(token).catch(
                    () => null,
                );
                if (!remoteProjects) return;
                const projects = await reconcileCanvasProjects(
                    token,
                    remoteProjects,
                    localProjects,
                );
                if (saveTimerHandle) {
                    clearTimeout(saveTimerHandle);
                    saveTimerHandle = null;
                }
                const nextState = { projects };
                queuedPersistState = nextState;
                set(nextState);
                await localForageStorage.setItem(
                    CANVAS_STORE_KEY,
                    JSON.stringify({ state: nextState, version: 0 }),
                );
            },
            setSyncEnabled: (enabled) => {
                accountCanvasSyncEnabled = enabled;
            },
        }),
        {
            name: CANVAS_STORE_KEY,
            storage: canvasStorage,
            partialize: (state) =>
                ({
                    projects: state.projects,
                }) as StorageValue<CanvasStore>["state"],
            onRehydrateStorage: () => () => {
                useCanvasStore.setState({ hydrated: true });
            },
        },
    ),
);

export function mergeCanvasProjects(
    remoteProjects: CanvasProject[],
    localProjects: CanvasProject[],
): CanvasProject[] {
    const projects = new Map<string, CanvasProject>();
    [...localProjects, ...remoteProjects].forEach((project) => {
        const previous = projects.get(project.id);
        if (
            !previous ||
            Date.parse(project.updatedAt || "") >=
            Date.parse(previous.updatedAt || "")
        ) {
            projects.set(project.id, project);
        }
    });
    return Array.from(projects.values()).sort(
        (a, b) =>
            Date.parse(b.updatedAt || "") -
            Date.parse(a.updatedAt || ""),
    );
}
