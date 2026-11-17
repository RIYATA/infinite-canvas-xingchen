export const audioVoiceOptions = [
    { value: "cixingnan", label: "磁性男" },
    { value: "songchinan", label: "松弛男" },
    { value: "surennan", label: "素人男" },
    { value: "cixingnan2", label: "低音男" },
    { value: "zhubonan", label: "主播男" },
    { value: "kefunan", label: "客服男" },
    { value: "zhuchinan", label: "主持男" },
    { value: "jilunan2", label: "记录男" },
    { value: "surennv", label: "素人女" },
    { value: "xianliaonv", label: "闲聊女" },
    { value: "mansunv", label: "慢速女" },
    { value: "kefunv1", label: "主持女" },
    { value: "huoponv", label: "活泼女" },
    { value: "ruyanv", label: "典雅女" },
    { value: "xinwennv", label: "新闻女" },
    { value: "kefunv2", label: "客服女" },
    { value: "luolinv", label: "萝莉女童" },
    { value: "huoponv2", label: "活泼女童" },
    { value: "guangzhounv", label: "粤语·广州女" },
    { value: "shanghainv", label: "上海话·上海女" },
    { value: "chengdunv", label: "四川话·成都女" },
    { value: "zhengzhounv", label: "河南话·郑州女" },
    { value: "dongbeinv", label: "东北话·东北女" },
    { value: "changshanv", label: "长沙话·长沙女" },
    { value: "xiannv", label: "陕西话·西安女" },
    { value: "xiamennv", label: "闽南话·厦门女" },
];

export const audioFormatOptions = [
    { value: "mp3", label: "MP3" },
    { value: "wav", label: "WAV" },
    { value: "opus", label: "Opus" },
    { value: "aac", label: "AAC" },
    { value: "flac", label: "FLAC" },
    { value: "pcm", label: "PCM" },
];

// 星辰超多方言语音合成(8005200016)支持的地方方言音色; 空值=普通话(不启用方言)
export const audioDialectOptions = [
    { value: "", label: "普通话（关闭）" },
    { value: "guangzhounv", label: "粤语·广州女" },
    { value: "shanghainv", label: "上海话·上海女" },
    { value: "chengdunv", label: "四川话·成都女" },
    { value: "zhengzhounv", label: "河南话·郑州女" },
    { value: "dongbeinv", label: "东北话·东北女" },
    { value: "changshanv", label: "长沙话·长沙女" },
    { value: "xiannv", label: "陕西话·西安女" },
    { value: "xiamennv", label: "闽南话·厦门女" },
];

// 音色下拉分组：普通话男声 / 普通话女声 / 童声 / 地方方言（antd Select OptGroup 结构）
export const audioVoiceGroups = [
    {
        label: "普通话 · 男声",
        options: [
            { value: "cixingnan", label: "磁性男" },
            { value: "songchinan", label: "松弛男" },
            { value: "surennan", label: "素人男" },
            { value: "cixingnan2", label: "低音男" },
            { value: "zhubonan", label: "主播男" },
            { value: "kefunan", label: "客服男" },
            { value: "zhuchinan", label: "主持男" },
            { value: "jilunan2", label: "记录男" },
        ],
    },
    {
        label: "普通话 · 女声",
        options: [
            { value: "surennv", label: "素人女" },
            { value: "xianliaonv", label: "闲聊女" },
            { value: "mansunv", label: "慢速女" },
            { value: "kefunv1", label: "主持女" },
            { value: "huoponv", label: "活泼女" },
            { value: "ruyanv", label: "典雅女" },
            { value: "xinwennv", label: "新闻女" },
            { value: "kefunv2", label: "客服女" },
        ],
    },
    {
        label: "童声",
        options: [
            { value: "luolinv", label: "萝莉女童" },
            { value: "huoponv2", label: "活泼女童" },
        ],
    },
    {
        label: "地方方言",
        options: [
            { value: "guangzhounv", label: "粤语·广州女" },
            { value: "shanghainv", label: "上海话·上海女" },
            { value: "chengdunv", label: "四川话·成都女" },
            { value: "zhengzhounv", label: "河南话·郑州女" },
            { value: "dongbeinv", label: "东北话·东北女" },
            { value: "changshanv", label: "长沙话·长沙女" },
            { value: "xiannv", label: "陕西话·西安女" },
            { value: "xiamennv", label: "闽南话·厦门女" },
        ],
    },
];

export function normalizeAudioDialectValue(value: string) {
    return audioDialectOptions.some((item) => item.value === value) ? value : "";
}

export function audioDialectLabel(value: string) {
    const dialect = normalizeAudioDialectValue(value);
    return audioDialectOptions.find((item) => item.value === dialect)?.label || "普通话（关闭）";
}

export function isDialectVoice(value: string) {
    const v = String(value || "").trim().toLowerCase();
    return v === "guangzhounv" || v === "shanghainv" || v === "chengdunv" || v === "zhengzhounv" || v === "dongbeinv" || v === "changshanv" || v === "xiannv" || v === "xiamennv";
}

export const glmTtsVoiceOptions = [
    { value: "tongtong", label: "彤彤" },
    { value: "chuichui", label: "锤锤" },
    { value: "xiaochen", label: "小陈" },
    { value: "jam", label: "Jam" },
    { value: "kazi", label: "Kazi" },
    { value: "douji", label: "Douji" },
    { value: "luodo", label: "Luodo" },
];

export const glmTtsFormatOptions = [
    { value: "wav", label: "WAV" },
    { value: "pcm", label: "PCM" },
];

export function isGlmTtsModel(model: string) {
    return model.trim().toLowerCase() === "glm-tts";
}

export function normalizeGlmTtsVoice(value: string) {
    return glmTtsVoiceOptions.some((item) => item.value === value) ? value : "tongtong";
}

export function normalizeGlmTtsFormat(value: string) {
    return glmTtsFormatOptions.some((item) => item.value === value) ? value : "wav";
}

export function normalizeGlmTtsSpeed(value: string) {
    const speed = Number(value);
    if (!Number.isFinite(speed)) return "1";
    return String(Math.max(0.5, Math.min(2, Number(speed.toFixed(2)))));
}

export function glmTtsVoiceLabel(value: string) {
    const voice = normalizeGlmTtsVoice(value);
    return glmTtsVoiceOptions.find((item) => item.value === voice)?.label || voice;
}

export function normalizeAudioVoiceValue(value: string) {
    return audioVoiceOptions.some((item) => item.value === value) ? value : "xianliaonv";
}

export function normalizeAudioFormatValue(value: string) {
    return audioFormatOptions.some((item) => item.value === value) ? value : "mp3";
}

export function normalizeAudioSpeedValue(value: string) {
    const speed = Number(value);
    if (!Number.isFinite(speed)) return "1";
    return String(Math.max(0.25, Math.min(4, Number(speed.toFixed(2)))));
}

export function audioVoiceLabel(value: string) {
    const voice = normalizeAudioVoiceValue(value);
    return audioVoiceOptions.find((item) => item.value === voice)?.label || voice;
}

export function audioFormatLabel(value: string) {
    const format = normalizeAudioFormatValue(value);
    return audioFormatOptions.find((item) => item.value === format)?.label || format;
}

export function audioSpeedLabel(value: string) {
    return `${normalizeAudioSpeedValue(value)}x`;
}

export function audioMimeType(format: string) {
    if (format === "wav") return "audio/wav";
    if (format === "opus") return "audio/opus";
    if (format === "aac") return "audio/aac";
    if (format === "flac") return "audio/flac";
    if (format === "pcm") return "audio/pcm";
    return "audio/mpeg";
}
