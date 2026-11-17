"use client";

// 试听共享的 WebAudio 上下文：在用户手势内创建/resume 后可持续播放，不受自动播放策略限制
let previewAudioCtx: AudioContext | null = null;

import { message, Select } from "antd";
import { type ReactNode, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { requestAudioGeneration } from "@/services/api/audio";

import { GrokTtsVoiceSelect } from "@/components/grok-tts-voice-select";
import { MiniMaxTtsVoiceSelect } from "@/components/minimax-tts-voice-select";
import { ImageSettingsTheme } from "@/components/image-settings-panel";
import { audioVoiceGroups, audioFormatOptions, audioSpeedLabel, audioVoiceOptions, glmTtsFormatOptions, glmTtsVoiceOptions, isGlmTtsModel, normalizeAudioFormatValue, normalizeAudioSpeedValue, normalizeAudioVoiceValue, normalizeGlmTtsFormat, normalizeGlmTtsSpeed, normalizeGlmTtsVoice } from "@/lib/audio-generation";
import { grokTtsFormatOptions, grokTtsLanguageOptions, isGrok2APITtsConfig, normalizeGrokTtsFormat, normalizeGrokTtsLanguage, normalizeGrokTtsSpeed } from "@/lib/grok-tts";
import { isMimoPresetTtsModel, isMimoTtsModel, isMimoVoiceCloneModel, isMimoVoiceDesignModel, mimoTtsFormatOptions, mimoTtsVoiceOptions, normalizeMimoTtsFormat, normalizeMimoTtsVoice } from "@/lib/mimo-tts";
import { isGeminiConfig, isGeminiTtsModel } from "@/lib/gemini";
import { geminiTtsVoiceOptions, normalizeGeminiTtsVoice } from "@/lib/gemini-tts";
import { isMiniMaxTtsConfig, miniMaxTtsFormatOptions, normalizeMiniMaxTtsFormat, normalizeMiniMaxTtsSpeed, normalizeMiniMaxTtsVoice } from "@/lib/minimax-tts";
import { miniMaxTtsVoiceOptions } from "@/lib/minimax-tts-voices";
import { type CanvasTheme } from "@/lib/canvas-theme";
import { channelProtocolForConfig, type AiConfig } from "@/stores/use-config-store";

const speedOptions = ["0.75", "1", "1.25", "1.5"];

export type AudioSettingKey = "audioVoice" | "audioDialect" | "audioFormat" | "audioSpeed" | "audioInstructions" | "grokTtsVoice" | "grokTtsLanguage" | "grokTtsFormat" | "grokTtsSpeed" | "glmTtsVoice" | "glmTtsFormat" | "glmTtsSpeed" | "mimoTtsVoice" | "mimoTtsFormat" | "mimoVoiceDesignPrompt" | "geminiTtsVoice" | "miniMaxTtsVoice" | "miniMaxTtsFormat" | "miniMaxTtsSpeed";

type AudioSettingsPanelProps = {
    config: AiConfig;
    onConfigChange: (key: AudioSettingKey, value: string) => void;
    theme: CanvasTheme;
    showTitle?: boolean;
    className?: string;
};

export function AudioSettingsPanel({ config, onConfigChange, theme, showTitle = true, className = "w-[320px] space-y-4 rounded-2xl px-1 py-0.5" }: AudioSettingsPanelProps) {
    const model = config.model || config.audioModel || "";
    const grok = isGrok2APITtsConfig(config, model);
    const gemini = isGeminiTtsModel(model) && isGeminiConfig(config, model);
    const miniMax = isMiniMaxTtsConfig(config, model);

    return (
        <ImageSettingsTheme theme={theme}>
            <div className={className} style={{ color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()}>
                {showTitle ? <div className="text-lg font-semibold">音频设置</div> : null}
                {gemini ? <GeminiAudioSettings config={config} onConfigChange={onConfigChange} theme={theme} /> : isMimoTtsModel(model) ? <MiMoAudioSettings config={config} model={model} onConfigChange={onConfigChange} theme={theme} /> : <AudioSpeechSettings config={config} model={model} glm={isGlmTtsModel(model)} grok={grok} miniMax={miniMax} onConfigChange={onConfigChange} theme={theme} />}
            </div>
        </ImageSettingsTheme>
    );
}

function GeminiAudioSettings({ config, onConfigChange, theme }: { config: AiConfig; onConfigChange: AudioSettingsPanelProps["onConfigChange"]; theme: CanvasTheme }) {
    return (
        <SettingGroup title="声音" color={theme.node.muted}>
            <Select className="w-full" showSearch optionFilterProp="label" value={normalizeGeminiTtsVoice(config.geminiTtsVoice)} options={geminiTtsVoiceOptions} onChange={(value) => onConfigChange("geminiTtsVoice", value)} />
        </SettingGroup>
    );
}

function MiMoAudioSettings({ config, model, onConfigChange, theme }: { config: AiConfig; model: string; onConfigChange: AudioSettingsPanelProps["onConfigChange"]; theme: CanvasTheme }) {
    const format = normalizeMimoTtsFormat(config.mimoTtsFormat);

    return (
        <>
            {isMimoPresetTtsModel(model) ? (
                <SettingGroup title="声音" color={theme.node.muted}>
                    <div className="grid grid-cols-4 gap-2.5">
                        {mimoTtsVoiceOptions.map((item) => (
                            <OptionPill key={item.value} selected={normalizeMimoTtsVoice(config.mimoTtsVoice) === item.value} theme={theme} onClick={() => onConfigChange("mimoTtsVoice", item.value)}>
                                {item.label}
                            </OptionPill>
                        ))}
                    </div>
                </SettingGroup>
            ) : null}
            {isMimoVoiceDesignModel(model) ? (
                <SettingGroup title="音色描述" color={theme.node.muted}>
                    <textarea
                        value={config.mimoVoiceDesignPrompt || ""}
                        placeholder="例如：年轻女性，声音清亮自然，有亲和力。"
                        className="thin-scrollbar h-24 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm leading-5 outline-none"
                        style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                        onChange={(event) => onConfigChange("mimoVoiceDesignPrompt", event.target.value)}
                        onMouseDown={(event) => event.stopPropagation()}
                    />
                </SettingGroup>
            ) : null}
            <SettingGroup title="格式" color={theme.node.muted}>
                <div className="grid grid-cols-3 gap-2.5">
                    {mimoTtsFormatOptions.map((item) => (
                        <OptionPill key={item.value} selected={format === item.value} theme={theme} onClick={() => onConfigChange("mimoTtsFormat", item.value)}>
                            {item.label}
                        </OptionPill>
                    ))}
                </div>
            </SettingGroup>
            {isMimoPresetTtsModel(model) || isMimoVoiceCloneModel(model) ? (
                <SettingGroup title="声音指令" color={theme.node.muted}>
                    <textarea
                        value={config.audioInstructions || ""}
                        placeholder="例如：语速轻快，语气兴奋，结尾略微上扬。"
                        className="thin-scrollbar h-20 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm leading-5 outline-none"
                        style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                        onChange={(event) => onConfigChange("audioInstructions", event.target.value)}
                        onMouseDown={(event) => event.stopPropagation()}
                    />
                </SettingGroup>
            ) : null}
        </>
    );
}

function AudioSpeechSettings({ config, model, glm, grok, miniMax, onConfigChange, theme }: { config: AiConfig; model: string; glm: boolean; grok: boolean; miniMax: boolean; onConfigChange: AudioSettingsPanelProps["onConfigChange"]; theme: CanvasTheme }) {
    const officialMiniMax = miniMax && channelProtocolForConfig({ ...config, model, audioModel: model }) === "minimax";
    const voice = glm ? normalizeGlmTtsVoice(config.glmTtsVoice) : miniMax ? normalizeMiniMaxTtsVoice(config.miniMaxTtsVoice) : grok ? config.grokTtsVoice || "eve" : normalizeAudioVoiceValue(config.audioVoice);
    const format = glm ? normalizeGlmTtsFormat(config.glmTtsFormat) : miniMax ? normalizeMiniMaxTtsFormat(config.miniMaxTtsFormat) : grok ? normalizeGrokTtsFormat(config.grokTtsFormat) : normalizeAudioFormatValue(config.audioFormat);
    const speed = glm ? normalizeGlmTtsSpeed(config.glmTtsSpeed) : miniMax ? normalizeMiniMaxTtsSpeed(config.miniMaxTtsSpeed) : grok ? normalizeGrokTtsSpeed(config.grokTtsSpeed) : normalizeAudioSpeedValue(config.audioSpeed);
    const voiceOptions = glm ? glmTtsVoiceOptions : audioVoiceOptions;
    const formatOptions = glm ? glmTtsFormatOptions : miniMax ? miniMaxTtsFormatOptions : grok ? grokTtsFormatOptions : audioFormatOptions;
    const voiceKey: AudioSettingKey = glm ? "glmTtsVoice" : "audioVoice";
    const formatKey: AudioSettingKey = glm ? "glmTtsFormat" : miniMax ? "miniMaxTtsFormat" : grok ? "grokTtsFormat" : "audioFormat";
    const speedKey: AudioSettingKey = glm ? "glmTtsSpeed" : miniMax ? "miniMaxTtsSpeed" : grok ? "grokTtsSpeed" : "audioSpeed";
    const previewingXing = !glm && !grok && !miniMax;
    const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);

    const previewVoice = async (value: string) => {
        if (previewingVoice) return;
        // 在用户手势内同步创建/解锁 AudioContext，规避浏览器自动播放策略（await 网络后 play() 会被拦截）
        if (!previewAudioCtx) {
            try {
                previewAudioCtx = new AudioContext();
            } catch {
                previewAudioCtx = null;
            }
        }
        const ctx = previewAudioCtx;
        if (ctx && ctx.state === "suspended") {
            try { await ctx.resume(); } catch { /* 忽略 */ }
        }
        setPreviewingVoice(value);
        try {
            const blob = await requestAudioGeneration({ ...config, model: config.model || config.audioModel, audioVoice: value, audioDialect: "" }, "你好，我是星河语音助手，现在为你进行音色试听。");
            if (ctx && ctx.state === "running") {
                const buf = await blob.arrayBuffer();
                const audioBuffer = await ctx.decodeAudioData(buf);
                const src = ctx.createBufferSource();
                src.buffer = audioBuffer;
                src.connect(ctx.destination);
                src.onended = () => setPreviewingVoice(null);
                src.start();
            } else {
                // 降级：浏览器不支持 WebAudio 或上下文被挂起
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.onended = () => { URL.revokeObjectURL(url); setPreviewingVoice(null); };
                audio.onerror = () => { URL.revokeObjectURL(url); setPreviewingVoice(null); };
                await audio.play();
                if (ctx) { message.warning("浏览器限制了自动播放，请再点一次试听即可出声"); setPreviewingVoice(null); }
            }
        } catch (error) {
            setPreviewingVoice(null);
            message.error(`试听失败：${error instanceof Error ? error.message : String(error)}`);
        }
    };

    return (
        <>
            <SettingGroup title="声音" color={theme.node.muted}>
                {grok ? <GrokTtsVoiceSelect config={config} model={model} value={voice} onChange={(value) => onConfigChange("grokTtsVoice", value)} /> : miniMax ? (
                    officialMiniMax ? (
                        <MiniMaxTtsVoiceSelect config={config} model={model} value={voice} onChange={(value) => onConfigChange("miniMaxTtsVoice", value)} />
                    ) : (
                        <Select className="w-full" value={voice} options={miniMaxTtsVoiceOptions} showSearch optionFilterProp="label" styles={{ popup: { root: { zIndex: 1300 } } }} getPopupContainer={(trigger) => trigger.closest<HTMLElement>(".canvas-image-settings-popover") || document.body} onChange={(value) => onConfigChange("miniMaxTtsVoice", value)} />
                    )
                ) : (
                    <Select
                        className="w-full"
                        value={voice}
                        options={glm ? glmTtsVoiceOptions : audioVoiceGroups}
                        showSearch
                        optionFilterProp="label"
                        popupMatchSelectWidth={false}
                        styles={{ popup: { root: { zIndex: 1300 } } }}
                        getPopupContainer={(trigger) => trigger.closest<HTMLElement>(".canvas-image-settings-popover") || document.body}
                        onChange={(value) => onConfigChange(voiceKey, value)}
                        optionRender={(option, info) => (
                            <div className="flex w-full items-center justify-between gap-2">
                                <span className="truncate">{option.label}</span>
                                {previewingXing ? (
                                    <span
                                        title="试听音色"
                                        className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:opacity-80"
                                        style={{ background: "rgba(255,255,255,0.1)", color: theme.node.text }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); void previewVoice(String((option.data as { value?: string }).value ?? "")); }}
                                    >
                                        {previewingVoice === (option.data as { value?: string }).value ? <Loader2 className="size-3.5 animate-spin" /> : <Volume2 className="size-3.5" />}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    />
                )}
            </SettingGroup>
            {grok ? (
                <SettingGroup title="语言" color={theme.node.muted}>
                    <Select className="w-full" value={normalizeGrokTtsLanguage(config.grokTtsLanguage)} options={grokTtsLanguageOptions} showSearch optionFilterProp="label" onChange={(value) => onConfigChange("grokTtsLanguage", value)} />
                </SettingGroup>
            ) : null}
            <SettingGroup title="格式" color={theme.node.muted}>
                <div className="grid grid-cols-3 gap-2.5">
                    {formatOptions.map((item) => (
                        <OptionPill key={item.value} selected={format === item.value} theme={theme} onClick={() => onConfigChange(formatKey, item.value)}>
                            {item.label}
                        </OptionPill>
                    ))}
                </div>
            </SettingGroup>
            <SettingGroup title="语速" color={theme.node.muted}>
                <div className="grid grid-cols-4 gap-2.5">
                    {speedOptions.map((value) => (
                        <OptionPill key={value} selected={speed === value} theme={theme} onClick={() => onConfigChange(speedKey, value)}>
                            {audioSpeedLabel(value)}
                        </OptionPill>
                    ))}
                </div>
                <input
                    type="number"
                    min={glm || miniMax ? 0.5 : grok ? 0.7 : 0.25}
                    max={glm || miniMax ? 2 : grok ? 1.5 : 4}
                    step={0.05}
                    className="h-9 w-full rounded-full border bg-transparent px-3 text-center text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    style={{ borderColor: theme.node.stroke, color: theme.node.text, WebkitTextFillColor: theme.node.text }}
                    value={(glm ? config.glmTtsSpeed : miniMax ? config.miniMaxTtsSpeed : grok ? config.grokTtsSpeed : config.audioSpeed) || "1"}
                    onChange={(event) => onConfigChange(speedKey, event.target.value)}
                    onBlur={(event) => onConfigChange(speedKey, glm ? normalizeGlmTtsSpeed(event.target.value) : miniMax ? normalizeMiniMaxTtsSpeed(event.target.value) : grok ? normalizeGrokTtsSpeed(event.target.value) : normalizeAudioSpeedValue(event.target.value))}
                    onMouseDown={(event) => event.stopPropagation()}
                />
            </SettingGroup>
            {!glm && !grok && !miniMax ? (
                <SettingGroup title="声音指令" color={theme.node.muted}>
                    <textarea
                        value={config.audioInstructions || ""}
                        placeholder="例如：自然、温暖、适合旁白。"
                        className="thin-scrollbar h-20 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm leading-5 outline-none"
                        style={{ borderColor: theme.node.stroke, color: theme.node.text }}
                        onChange={(event) => onConfigChange("audioInstructions", event.target.value)}
                        onMouseDown={(event) => event.stopPropagation()}
                    />
                </SettingGroup>
            ) : null}
        </>
    );
}

function OptionPill({ selected, theme, onClick, children }: { selected: boolean; theme: CanvasTheme; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" className="h-9 cursor-pointer rounded-full border px-2 text-sm transition hover:opacity-80" style={{ background: "transparent", borderColor: selected ? theme.node.text : theme.node.stroke, color: theme.node.text }} onMouseDown={(event) => event.stopPropagation()} onClick={onClick}>
            {children}
        </button>
    );
}

function SettingGroup({ title, color, children }: { title: string; color: string; children: ReactNode }) {
    return (
        <div className="space-y-2.5">
            <div className="text-xs font-medium" style={{ color }}>
                {title}
            </div>
            {children}
        </div>
    );
}
