import { useEffect } from "react";
import { flushCanvasSavesNow, persistCanvasStateNow, writeProjectSnapshot } from "../stores/use-canvas-store";

const AUTOSAVE_INTERVAL_MS = 15000;

/**
 * 画布自动保存：
 * 1. 每 15 秒：把待保存的项目立刻提交到服务器（含失败重试），并立即落盘本地 IndexedDB；内容有变化时写一份本地快照。
 * 2. 页面隐藏 / 关闭（切标签页、最小化、关窗口、注销、断电前的最后时机）：立即触发一次全量保存。
 * 3. 卸载（切换画布）时兜底保存。
 */
export function useCanvasAutosave(projectId: string | null | undefined, enabled: boolean) {
    useEffect(() => {
        if (!enabled) return;

        const flushAll = () => {
            flushCanvasSavesNow();
            void persistCanvasStateNow();
        };

        const tick = () => {
            flushAll();
            if (projectId) void writeProjectSnapshot(projectId);
        };

        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") flushAll();
        };

        const timer = window.setInterval(tick, AUTOSAVE_INTERVAL_MS);
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("pagehide", flushAll);

        return () => {
            window.clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pagehide", flushAll);
            flushAll();
        };
    }, [enabled, projectId]);
}
