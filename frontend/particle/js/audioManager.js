
// 辅助函数：Blob 转 Base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// 辅助函数：简单的静音截取（模拟，实际需要分析音频数据）
// 这里为了演示，我们直接返回原始 Blob，或者做一个简单的 slice
async function trimSilence(audioBlob) {
    // 在实际生产环境中，这里应该使用 Web Audio API 分析 AudioBuffer
    // 并移除开头和结尾音量低于阈值的部分。
    // 这里直接返回原数据以确保流程跑通。
    return audioBlob;
}

export async function generateEmotionPoem(audioBlob) {
    // 1. 预处理：截取有效语音片段（移除静音头尾）
    const trimmedAudio = await trimSilence(audioBlob);
    const base64Audio = await blobToBase64(trimmedAudio);

    // 2. 构造请求
    // 发送给 Python 后端，后端负责 ASR 和 LLM 调用
    // 使用绝对路径以支持跨端口调用（如前端在 5500，后端在 3000）
    const response = await fetch('http://localhost:3000/api/generate-poem', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            audio: base64Audio
        })
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("API Error:", err);
        throw new Error("API Request Failed");
    }

    const data = await response.json();

    if (data.code === 'NO_SPEECH') {
        throw new Error('NO_SPEECH');
    }

    // API 响应格式: { text: poem_text, userText: asr_text, imageUrl: url }
    const result = {
        userWords: data.userText || "...",
        poem: data.text || "雪落无声心自暖\n星光点点映笑颜\n风起云涌皆过客\n将有好事在明天",
        imageUrl: data.imageUrl || ""
    };

    return result;
}
