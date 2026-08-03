// static/js/api.js

export async function fetchAppConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Failed to fetch config');
        return await response.json();
    } catch (error) {
        console.error('Error fetching configuration:', error);
        return null;
    }
}

export async function streamChatResponse(payload, onChunk, onError, onComplete) {
    try {
        const response = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server responded with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // process all complete lines
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                    const dataStr = trimmed.slice(6);
                    if (dataStr === '[DONE]') {
                        if (onComplete) onComplete();
                        return;
                    }
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.error) {
                            if (onError) onError(parsed.error);
                            return;
                        }
                        if (parsed.text && onChunk) {
                            onChunk(parsed.text);
                        }
                    } catch (e) {
                        // Ignore partial JSON chunks
                    }
                }
            }
        }

        if (onComplete) onComplete();
    } catch (err) {
        console.error('API Stream Error:', err);
        if (onError) onError(err.message);
    }
}