"use client";

import { useEffect, useState } from "react";
import { Button, Modal, Spin } from "antd";
import { History, RotateCcw } from "lucide-react";
import { listProjectSnapshots, type CanvasProjectSnapshot, type CanvasProject } from "../stores/use-canvas-store";

export function CanvasSnapshotDialog({
    projectId,
    open,
    onClose,
    onRestore,
}: {
    projectId: string | null;
    open: boolean;
    onClose: () => void;
    onRestore: (project: CanvasProject) => void;
}) {
    const [snapshots, setSnapshots] = useState<CanvasProjectSnapshot[] | null>(null);

    useEffect(() => {
        if (!open || !projectId) {
            setSnapshots(null);
            return;
        }
        let cancelled = false;
        void listProjectSnapshots(projectId).then((versions) => {
            if (!cancelled) setSnapshots(versions);
        });
        return () => {
            cancelled = true;
        };
    }, [open, projectId]);

    return (
        <Modal
            title={
                <span className="flex items-center gap-2">
                    <History className="size-4" />
                    恢复历史快照
                </span>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={520}
        >
            <p className="mb-3 text-xs opacity-70">
                自动保存会为当前画布保留最近 5 份本地快照（内容变化时更新）。恢复会把该快照创建为一张新画布，不影响当前画布。
            </p>
            {snapshots === null ? (
                <div className="grid place-items-center py-10">
                    <Spin />
                </div>
            ) : snapshots.length === 0 ? (
                <div className="py-10 text-center text-sm opacity-60">暂无快照，编辑画布后将自动生成。</div>
            ) : (
                <div className="flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1">
                    {snapshots.map((snapshot) => (
                        <div key={snapshot.at} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 px-4 py-3 dark:border-white/10">
                            <div className="min-w-0">
                                <div className="truncate text-sm font-medium">
                                    {new Date(snapshot.at).toLocaleString("zh-CN", { hour12: false })}
                                </div>
                                <div className="text-xs opacity-60">
                                    {snapshot.project.nodes?.length || 0} 个节点 · {snapshot.project.connections?.length || 0} 条连线
                                </div>
                            </div>
                            <Button
                                size="small"
                                icon={<RotateCcw className="size-3.5" />}
                                onClick={() => onRestore(snapshot.project)}
                            >
                                恢复为新画布
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
}
