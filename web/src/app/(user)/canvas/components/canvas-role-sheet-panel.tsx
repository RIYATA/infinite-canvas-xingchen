"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Camera, ScanFace, Settings2, Sparkles, X, Zap } from "lucide-react";

/**
 * 角色三视图生成面板 —— 仿星图风格暗黑工作台。
 * 参考图为当前选中的图片节点（右键入口带过来），生成走画布图片链路（edit 模式）。
 */
export function RoleSheetPanel({
    open,
    sourceImageUrl,
    onClose,
    onGenerate,
}: {
    open: boolean;
    sourceImageUrl?: string;
    onClose: () => void;
    onGenerate: (payload: { prompt: string; size: string; quality: string; count: string }) => void;
}) {
    const [prompt, setPrompt] = useState("为参考图中的角色生成角色三视图：正面、侧面、背面三个视角等大并排展示。严格保持角色形象特征完全一致（脸型、发型、五官、服装配色、配饰），纯色浅灰背景，无遮挡，适合作为角色资产使用。");
    const [size, setSize] = useState("16:9");
    const [quality, setQuality] = useState("high");
    const [count, setCount] = useState("1");
    const [generating, setGenerating] = useState(false);

    const source = useMemo(() => sourceImageUrl || "", [sourceImageUrl]);

    if (!open) return null;

    const submit = () => {
        setGenerating(true);
        try {
            onGenerate({ prompt: prompt.trim() || "生成该角色的角色三视图", size, quality, count });
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[20000000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onPointerDown={onClose}>
            <div
                className="relative flex w-[520px] max-w-[92vw] flex-col overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,.5)]"
                style={{ background: "rgba(24,24,26,.92)" }}
                onPointerDown={(event) => event.stopPropagation()}
            >
                {/* 标题栏 */}
                <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-[#3a2f12] text-[#f5c542]">
                            <Zap className="size-4" />
                        </span>
                        <div className="leading-tight">
                            <div className="text-[15px] font-semibold text-[#f3f3f5]">角色三视图</div>
                            <div className="text-[11px] text-[#8b8b92]">为角色资产生成 头部特写 + 正侧背三视图 · 16:9</div>
                        </div>
                    </div>
                    <button type="button" className="flex size-7 items-center justify-center rounded-lg text-[#8b8b92] transition-colors hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="关闭">
                        <X className="size-4" />
                    </button>
                </div>

                {/* 预览 / 参考图区 */}
                <div className="mx-5 mb-3 flex h-40 items-center justify-center rounded-xl border border-[#333338] bg-[#1b1b1d]">
                    {source ? (
                        <img src={source} alt="角色参考图" className="h-full max-w-full rounded-lg object-contain" />
                    ) : (
                        <div className="flex flex-col items-center text-[#5a5a61]">
                            <ScanFace className="mb-2 size-9" />
                            <span className="text-xs">参考图（当前图片节点）</span>
                        </div>
                    )}
                </div>

                {/* 参数行 */}
                <div className="mx-5 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[#9c9ca3]">
                    <ParamGroup icon={<Settings2 className="size-3.5" />} label="参数">
                        <ParamSelect value={size} onChange={setSize} options={["16:9", "1:1", "9:16", "4:3", "3:4"]} />
                        <span className="text-[#5f5f66]">·</span>
                        <ParamSelect value={quality} onChange={setQuality} options={["自动", "高", "中", "低"]} labels={{ auto: "自动", high: "高", medium: "中", low: "低" }} />
                        <span className="text-[#5f5f66]">·</span>
                        <ParamSelect value={count} onChange={setCount} options={["1", "2", "4"]} prefix="x" />
                    </ParamGroup>
                    <ParamChip icon={<Sparkles className="size-3.5" />} label="角色资产">
                        形象一致 · 三视角
                    </ParamChip>
                    <ParamChip icon={<Camera className="size-3.5" />} label="镜头">
                        平视正面
                    </ParamChip>
                </div>

                {/* 提示词 */}
                <div className="mx-5 mb-4">
                    <textarea
                        value={prompt}
                        onChange={(event) => setPrompt(event.target.value)}
                        spellCheck={false}
                        rows={3}
                        className="w-full resize-none rounded-xl border border-[#333338] bg-[#1b1b1d] px-3 py-2.5 text-[13px] leading-relaxed text-[#e6e6e9] outline-none transition-colors placeholder:text-[#6a6a70] focus:border-[#f5c542]/60"
                        placeholder="描述你想要的角色三视图…"
                    />
                </div>

                {/* 底部 */}
                <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
                    <div className="text-[11px] text-[#6a6a70]">以当前图片节点为参考 · 生成后落在右侧新节点</div>
                    <button
                        type="button"
                        onClick={submit}
                        className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-85 disabled:opacity-50"
                        disabled={generating}
                    >
                        <Zap className="size-3.5" />
                        生成 ✦
                    </button>
                </div>
            </div>
        </div>
    );
}

function ParamGroup({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
    return (
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="flex items-center gap-1 text-[#9c9ca3]">
                {icon}
                {label}
            </span>
            {children}
        </span>
    );
}

function ParamSelect({ value, onChange, options, prefix = "", labels }: { value: string; onChange: (value: string) => void; options: string[]; prefix?: string; labels?: Record<string, string> }) {
    return (
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="cursor-pointer appearance-none rounded-md border border-[#3a3a40] bg-[#2a2a2e] px-2 py-1 text-[12px] text-[#e6e6e9] outline-none"
        >
            {options.map((option) => (
                <option key={option} value={option}>
                    {prefix}
                    {labels ? labels[option] ?? option : option}
                </option>
            ))}
        </select>
    );
}

function ParamChip({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[#f5c542]">
                {icon}
                {label}
            </span>
            <span className="text-[#d6d6da]">{children}</span>
        </span>
    );
}