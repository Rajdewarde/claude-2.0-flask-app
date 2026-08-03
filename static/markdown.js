export function renderMarkdown(content) {
    if (!window.marked) return content;

    // Configure marked
    marked.setOptions({
        highlight: function(code, lang) {
            if (window.hljs && window.hljs.getLanguage(lang)) {
                return window.hljs.highlight(code, { language: lang }).value;
            }
            return window.hljs ? window.hljs.highlightAuto(code).value : code;
        },
        breaks: true
    });

    let rawHtml = marked.parse(content);

    // Process KaTeX math equations $...$ or $$...$$
    rawHtml = rawHtml.replace(/\$\$(.*?)\$\$/gs, (_, math) => {
        try { return katex.renderToString(math, { displayMode: true }); } catch { return math; }
    });
    rawHtml = rawHtml.replace(/\$(.*?)\$/g, (_, math) => {
        try { return katex.renderToString(math, { displayMode: false }); } catch { return math; }
    });

    return rawHtml;
}

export function enhanceCodeBlocks(container) {
    container.querySelectorAll('pre code').forEach((codeBlock) => {
        if (codeBlock.parentElement.classList.contains('enhanced')) return;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';

        const header = document.createElement('div');
        header.className = 'code-header';
        
        const lang = codeBlock.className.replace('language-', '') || 'code';
        header.innerHTML = `<span>${lang}</span><button class="copy-btn">Copy</button>`;

        const pre = codeBlock.parentElement;
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(header);
        wrapper.appendChild(pre);
        pre.classList.add('enhanced');

        header.querySelector('.copy-btn').addEventListener('click', () => {
            navigator.clipboard.writeText(codeBlock.innerText);
            header.querySelector('.copy-btn').innerText = 'Copied!';
            setTimeout(() => header.querySelector('.copy-btn').innerText = 'Copy', 2000);
        });
    });
}