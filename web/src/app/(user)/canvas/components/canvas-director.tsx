"use client";

import { useEffect, useRef } from "react";

import type { CanvasDirectorCapture, CanvasDirectorPanorama, CanvasDirectorVideo } from "../types";

type PanoramaRemoval = Pick<CanvasDirectorPanorama, "edgeId" | "sourceNodeId">;
type DirectorCapturePayload = { dataUrl?: unknown; fileName?: unknown } | null | undefined;
type DirectorBridgeMessage = { type?: string; payload?: Record<string, unknown> } | null | undefined;

/**
 * 3D 导演台宿主（新标签页模式）。
 * 挂载时用 window.open 在浏览器新标签页打开 /director/index.html?instance=<nodeId>，
 * 画布与导演台通过专属 BroadcastChannel("storyai-director-<nodeId>") 通信（同源跨标签页，
 * 多个导演台节点各自独立通道，互不串扰；BroadcastChannel 不回环，画布自身发送的消息不会收到）。
 *
 *   画布 -> 导演台: storyai:director-session { instanceId, theme, project }
 *                   storyai:director-panoramas { panoramas }
 *                   storyai:director-hello {} （面板重开时探测，导演台已 ready 会回发 ready）
 *   导演台 -> 画布: storyai:director-ready
 *                   storyai:director-project-changed / storyai:director-panorama-removed
 *                   storyai:director-captures-sent / storyai:director-video-sent
 *                   storyai:director-close（导演台主动退出，标签页会自行关闭）
 *
 * 用户手动关闭标签页时由 closed 轮询感知并复位画布状态。
 */
export function CanvasDirector({
    nodeId,
    project,
    panoramas,
    theme,
    onClose,
    onProjectChange,
    onPanoramaRemoved,
    onCapturesSent,
    onVideoSent,
}: {
    nodeId: string;
    project: unknown;
    panoramas: CanvasDirectorPanorama[];
    theme: "light" | "dark";
    onClose: () => void;
    onProjectChange: (project: unknown) => void;
    onPanoramaRemoved: (payload: PanoramaRemoval) => void;
    onCapturesSent: (nodeId: string, captures: CanvasDirectorCapture[]) => void;
    onVideoSent: (nodeId: string, video: CanvasDirectorVideo) => void;
}) {
    const channelRef = useRef<BroadcastChannel | null>(null);
    const projectRef = useRef(project);
    const themeRef = useRef(theme);
    const panoramasRef = useRef(panoramas);
    const sessionSentRef = useRef(false);
    const onCloseRef = useRef(onClose);
    const onProjectChangeRef = useRef(onProjectChange);
    const onPanoramaRemovedRef = useRef(onPanoramaRemoved);
    const onCapturesSentRef = useRef(onCapturesSent);
    const onVideoSentRef = useRef(onVideoSent);

    useEffect(() => {
        projectRef.current = project;
    }, [project]);

    useEffect(() => {
        themeRef.current = theme;
    }, [theme]);

    useEffect(() => {
        panoramasRef.current = panoramas;
    }, [panoramas]);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        onProjectChangeRef.current = onProjectChange;
    }, [onProjectChange]);

    useEffect(() => {
        onPanoramaRemovedRef.current = onPanoramaRemoved;
    }, [onPanoramaRemoved]);

    useEffect(() => {
        onCapturesSentRef.current = onCapturesSent;
    }, [onCapturesSent]);

    useEffect(() => {
        onVideoSentRef.current = onVideoSent;
    }, [onVideoSent]);

    // 打开导演台新标签页（命名窗口：再次打开复用同一标签页并聚焦），轮询感知标签页被手动关闭
    useEffect(() => {
        sessionSentRef.current = false;
        const directorUrl = `/director/index.html?instance=${encodeURIComponent(nodeId)}`;
        const openedWindow = window.open(directorUrl, "storyai-director-" + nodeId);
        if (!openedWindow) {
            window.console.warn("导演台新标签页被浏览器拦截，请允许本站弹出式窗口。");
            onCloseRef.current();
            return;
        }
        const watchId = window.setInterval(() => {
            if (openedWindow.closed) {
                window.clearInterval(watchId);
                onCloseRef.current();
            }
        }, 1500);
        return () => {
            window.clearInterval(watchId);
        };
    }, [nodeId]);

    // 专属通道：接收导演台消息、按需注入 session / 全景
    useEffect(() => {
        const channel = new BroadcastChannel("storyai-director-" + nodeId);
        channelRef.current = channel;

        channel.onmessage = (event: MessageEvent) => {
            const data = event.data as DirectorBridgeMessage;
            const type = data?.type;
            const payload = data?.payload;

            if (type === "storyai:director-ready") {
                if (!sessionSentRef.current) {
                    sessionSentRef.current = true;
                    channel.postMessage({
                        type: "storyai:director-session",
                        payload: { instanceId: nodeId, theme: themeRef.current, project: projectRef.current },
                    });
                    channel.postMessage({
                        type: "storyai:director-panoramas",
                        payload: { panoramas: panoramasRef.current },
                    });
                }
                return;
            }

            if (type === "storyai:director-close") {
                onCloseRef.current();
                return;
            }

            if (type === "storyai:director-project-changed") {
                const nextProject = (payload as { project?: unknown } | undefined)?.project;
                if (nextProject && typeof nextProject === "object" && !Array.isArray(nextProject)) onProjectChangeRef.current(nextProject);
                return;
            }

            if (type === "storyai:director-panorama-removed") {
                const edgeId = typeof (payload as { edgeId?: unknown } | undefined)?.edgeId === "string" ? (payload as { edgeId: string }).edgeId.trim() : "";
                const sourceNodeId = typeof (payload as { sourceNodeId?: unknown } | undefined)?.sourceNodeId === "string" ? (payload as { sourceNodeId: string }).sourceNodeId.trim() : "";
                if (edgeId && sourceNodeId) onPanoramaRemovedRef.current({ edgeId, sourceNodeId });
                return;
            }

            if (type === "storyai:director-captures-sent") {
                const captures = Array.isArray((payload as { captures?: unknown } | undefined)?.captures)
                    ? ((payload as { captures: DirectorCapturePayload[] }).captures)
                        .filter((capture: DirectorCapturePayload): capture is { dataUrl: string; fileName?: unknown } => typeof capture?.dataUrl === "string" && capture.dataUrl.startsWith("data:image/"))
                        .map((capture: { dataUrl: string; fileName?: unknown }, index: number) => ({ dataUrl: capture.dataUrl, fileName: typeof capture.fileName === "string" && capture.fileName.trim() ? capture.fileName.trim() : "导演台截图-" + (index + 1) + ".png" }))
                    : [];
                if (captures.length) void onCapturesSentRef.current(nodeId, captures);
                return;
            }

            if (type === "storyai:director-video-sent") {
                const blob = (payload as { blob?: unknown } | undefined)?.blob;
                if (!(blob instanceof Blob) || !blob.size || !blob.type.startsWith("video/mp4")) return;
                const fileName = typeof (payload as { fileName?: unknown } | undefined)?.fileName === "string" && (payload as { fileName: string }).fileName.trim()
                    ? (payload as { fileName: string }).fileName.trim()
                    : "导演台视频.mp4";
                const width = Number((payload as { width?: unknown }).width);
                const height = Number((payload as { height?: unknown }).height);
                const durationSeconds = Number((payload as { durationSeconds?: unknown }).durationSeconds);
                void onVideoSentRef.current(nodeId, {
                    blob,
                    fileName,
                    width: Number.isFinite(width) && width > 0 ? width : 1280,
                    height: Number.isFinite(height) && height > 0 ? height : 720,
                    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
                });
                return;
            }
        };

        // 通道建立即探测：导演台标签页若早已加载（画布面板重开），触发其回发 ready 以重新注入 session
        channel.postMessage({ type: "storyai:director-hello", payload: {} });

        return () => {
            channel.close();
            channelRef.current = null;
        };
    }, [nodeId]);

    // 画布全景列表变化时推送给已就绪的导演台
    useEffect(() => {
        if (!sessionSentRef.current) return;
        channelRef.current?.postMessage({ type: "storyai:director-panoramas", payload: { panoramas } });
    }, [panoramas]);

    // 新标签页宿主在画布内不渲染任何 UI
    return null;
}
