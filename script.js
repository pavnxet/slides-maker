const { jsPDF } = window.jspdf;

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.log('SW Failed:', err));
    });
}

// DOM Elements
const PAVNXET_ELEMENTS = {
    input: document.getElementById('questionInput'),
    generateBtn: document.getElementById('generateBtn'),
    clearBtn: document.getElementById('clearBtn'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    logWindow: document.getElementById('logWindow'),
    renderContainer: document.getElementById('slideTemplate'),
    previewContainer: document.getElementById('previewContainer'),
    themeSelect: document.getElementById('themeSelect'),
    // Slide fields
    slideQNum: document.getElementById('slideQNum'),
    slideQuestionEn: document.getElementById('slideQuestionEn'),
    slideQuestionHi: document.getElementById('slideQuestionHi'),
    slideOptA: document.getElementById('slideOptA'),
    slideOptB: document.getElementById('slideOptB'),
    slideOptC: document.getElementById('slideOptC'),
    slideOptD: document.getElementById('slideOptD'),
};

// State
let isProcessing = false;
let previewTimeout = null;

// Logger Function
function log(message, type = 'info') {
    const div = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

    let color = 'text-gray-400';
    if (type === 'success') color = 'text-green-400';
    if (type === 'error') color = 'text-red-400';
    if (type === 'process') color = 'text-blue-400';

    div.className = `${color} font-mono text-xs hover:bg-white/5 p-0.5 rounded transition-colors`;
    div.innerHTML = `<span class="opacity-50">[${timestamp}]</span> ${message}`;

    PAVNXET_ELEMENTS.logWindow.appendChild(div);
    PAVNXET_ELEMENTS.logWindow.scrollTop = PAVNXET_ELEMENTS.logWindow.scrollHeight;
}

// Progress Bar Helper
function updateProgress(percent) {
    PAVNXET_ELEMENTS.progressBar.style.width = `${percent}%`;
    PAVNXET_ELEMENTS.progressText.innerText = `${Math.round(percent)}%`;
}

// Parser Logic
function parseQuestions(text) {
    const questions = [];

    // Normalize newlines and remove BOM if present
    text = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');

    // Split by question number (e.g., "1.", "2.", "10.")
    // Regex looks for: Start of line, number, dot, space
    // Using positive lookahead (?=\d+\.\s) to keep the delimiter with the split block
    // We split by newline + lookahead to avoid splitting mid-sentence if a number appears there (rare but possible)
    // Actually, splitting by `\n(?=\d+\.\s)` is robust for most MCQ dumps.
    const questionBlocks = text.split(/\n(?=\d+\.\s)/).filter(block => block.trim().length > 0);

    // Handle the first block if it doesn't start with a newline (e.g. start of file)
    // The split might leave the first question intact if it starts at index 0 without \n
    // But if there's garbage before Q1, it might be in block 0.
    // Let's map and filter.

    questionBlocks.forEach(block => {
        // block might start with "1. ..." directly
        // Regex to capture ID, Question Text (up to options)
        // We look for the first occurrence of an option pattern to end the question text

        const questionMatch = block.match(/^(\d+)\.\s+([\s\S]+?)(?=(?:\n\s*(?:[a-dA-D]\.|[a-dA-D]\)|(?:\(|\[)[a-dA-D](?:\)|\])))|$)/);

        if (questionMatch) {
            const id = questionMatch[1];
            let rawQuestionText = questionMatch[2].trim();

            // Attempt to separate English and Hindi
            // Strategy: Split by newline. If multiple lines, 1st is En, rest is Hi.
            const qLines = rawQuestionText.split('\n').map(l => l.trim()).filter(l => l);
            let textEn = qLines[0] || "";
            let textHi = qLines.length > 1 ? qLines.slice(1).join('\n') : "";

            const options = { a: '', b: '', c: '', d: '' };

            // Extract Options from the *entire* block to handle multiline options
            // We use a global regex that finds option markers
            const optionRegex = /(?:^|\s)(?:\(|\[)?([a-dA-D])(?:\)|\]|\.)\s+([\s\S]+?)(?=(?:\s(?:\(|\[)?[a-dA-D](?:\)|\]|\.)\s)|$)/g;

            // To ensure we don't match things inside the question text as options,
            // we should technically only search after the question text.
            // But since we split the block based on the "start of options" lookahead in questionMatch,
            // we can just search the whole block, but improved logic:

            // Let's refine: We know where the question text ends.
            // Use that index to slice the block for options.
            const qEndIndex = questionMatch[0].length;
            // However, questionMatch[0] includes the lookahead? No, lookahead is zero-width.
            // So questionMatch[0] is just "1. ... text ...".
            // The rest of the block contains the options.

            // Actually, my regex `([\s\S]+?)` is non-greedy, stopping at the lookahead.
            // So `block.substring(questionMatch[0].length)` should contain the options.

            // There's a catch: `match[0]` matches the whole string if the lookahead matches.
            // Wait, match[0] is the full match.
            // If the regex is `^(\d+)\.\s+([\s\S]+?)(?=...)`
            // Then match[0] is everything up to the lookahead.

            const optionsText = block.substring(questionMatch[0].length);

            let optionMatch;
            while ((optionMatch = optionRegex.exec(optionsText)) !== null) {
                const label = optionMatch[1].toLowerCase();
                const optText = optionMatch[2].trim();
                if (options.hasOwnProperty(label)) {
                    options[label] = optText;
                }
            }

            // Fallback: If optionsText is empty or regex fails, maybe the question text regex was too greedy
            // or the options are inline (e.g. "1. Q? (a) ...").
            // If optionsText is empty, try parsing options from the rawQuestionText (and update textEn/Hi accordingly).
            // But strict format usually puts options on new lines or clearly separated.
            // For inline "1. Question (a) OptA (b) OptB", the lookahead `(?=(?:\n...` expects a newline before options.
            // If options are inline, the lookahead fails, and match[2] eats everything.

            if (!options.a && !options.b) {
                const inlineOptionRegex = /(?:\(|\[)?([a-dA-D])(?:\)|\]|\.)\s+([\s\S]+?)(?=(?:\s(?:\(|\[)?[a-dA-D](?:\)|\]|\.)\s)|$)/g;
                let inlineOptionMatch;
                while ((inlineOptionMatch = inlineOptionRegex.exec(rawQuestionText)) !== null) {
                    const label = inlineOptionMatch[1].toLowerCase();
                    const optText = inlineOptionMatch[2].trim();
                    if (options.hasOwnProperty(label)) {
                        options[label] = optText;
                    }
                }
                if (options.a || options.b) {
                    const lastOptionEnd = rawQuestionText.lastIndexOf(options.d || options.c || options.b || options.a);
                    const stripped = rawQuestionText.substring(0, lastOptionEnd).replace(/[\s\(]*(?:[a-dA-D][\.\)\]\s]+)$/, '').trim();
                    if (stripped) textEn = stripped;
                    textHi = '';
                }
            }

            questions.push({
                id,
                textEn,
                textHi,
                options
            });
        }
    });

    return questions;
}

const THEMES = {
    whiteboard: {
        bg: '#ffffff', text: '#0f172a', qHi: '#475569', qHiBorder: '#2563eb',
        badge: { bg: '#eff6ff', color: '#1d4ed8', border: '2px solid #dbeafe' },
        optBox: { bg: '#f8fafc', border: '2px solid #e2e8f0' },
        optText: '#0f172a', solutionBorder: '2px dashed #e2e8f0',
        solutionText: '#94a3b8', footer: '#cbd5e1', bgElements: false
    },
    dark: {
        bg: '#0f172a', text: '#f8fafc', qHi: '#94a3b8', qHiBorder: '#3b82f6',
        badge: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '2px solid rgba(59,130,246,0.2)' },
        optBox: { bg: 'rgba(255,255,255,0.05)', border: '2px solid #334155' },
        optText: '#f8fafc', solutionBorder: '2px dashed #334155',
        solutionText: '#64748b', footer: '#475569', bgElements: true
    },
    print: {
        bg: '#ffffff', text: '#000000', qHi: '#333333', qHiBorder: '#000000',
        badge: { bg: '#ffffff', color: '#000000', border: '2px solid #000000' },
        optBox: { bg: '#ffffff', border: '2px solid #000000' },
        optText: '#000000', solutionBorder: '2px solid #000000',
        solutionText: '#666666', footer: '#000000', bgElements: false
    }
};

function switchTheme(theme) {
    const t = THEMES[theme] || THEMES.whiteboard;
    const el = PAVNXET_ELEMENTS.renderContainer;

    el.setAttribute('data-theme', theme);
    el.style.backgroundColor = t.bg;
    el.style.color = t.text;

    const qEn = el.querySelector('#slideQuestionEn');
    const qHi = el.querySelector('#slideQuestionHi');
    const qBadge = el.querySelector('#qBadge');
    const solution = el.querySelector('#solutionSpace');
    const footer = solution.querySelector('div:last-child');
    const solutionText = solution.querySelector('div:first-child');

    if (qEn) qEn.style.color = t.text;
    if (qHi) { qHi.style.color = t.qHi; qHi.style.borderLeftColor = t.qHiBorder; }
    if (qBadge) {
        qBadge.style.backgroundColor = t.badge.bg;
        qBadge.style.color = t.badge.color;
        qBadge.style.border = t.badge.border;
    }

    el.querySelectorAll('.opt-box').forEach(box => {
        box.style.backgroundColor = t.optBox.bg;
        box.style.border = t.optBox.border;
    });
    el.querySelectorAll('.opt-text').forEach(txt => { txt.style.color = t.optText; });

    if (theme === 'print') {
        el.querySelectorAll('.opt-badge').forEach(b => {
            b.style.backgroundColor = '#fff';
            b.style.color = '#000';
            b.style.border = '2px solid #000';
        });
    } else {
        el.querySelectorAll('.opt-badge').forEach(b => {
            b.style.backgroundColor = '';
            b.style.color = '';
            b.style.border = '';
        });
    }

    if (solution) solution.style.borderLeft = t.solutionBorder;
    if (solutionText) solutionText.style.color = t.solutionText;
    if (footer) footer.style.color = t.footer;

    document.getElementById('bgElements').style.opacity = t.bgElements ? '1' : '0';

    log(`Switched to ${theme} theme.`);
    updatePreview();
}

// Live Preview
function updatePreview() {
    const text = PAVNXET_ELEMENTS.input.value;
    if (!text.trim()) return;

    const questions = parseQuestions(text);
    if (questions.length > 0) {
        const q = questions[0]; // Preview first question

        // Populate DOM
        PAVNXET_ELEMENTS.slideQNum.innerText = q.id.padStart(2, '0');
        PAVNXET_ELEMENTS.slideQuestionEn.innerText = q.textEn;
        PAVNXET_ELEMENTS.slideQuestionHi.innerText = q.textHi;
        PAVNXET_ELEMENTS.slideOptA.innerText = q.options.a;
        PAVNXET_ELEMENTS.slideOptB.innerText = q.options.b;
        PAVNXET_ELEMENTS.slideOptC.innerText = q.options.c;
        PAVNXET_ELEMENTS.slideOptD.innerText = q.options.d;

        // Clone rendering container into preview container
        // We use transform scale to fit 1920x1080 into the small box
        const scale = PAVNXET_ELEMENTS.previewContainer.clientWidth / 1920;

        // Simply clone the innerHTML to preview container
        // But we need to keep the style context.
        // Actually, we can just style the previewContainer to show the #slideTemplate using CSS transform
        // But #slideTemplate is hidden. Let's make a visible clone.

        PAVNXET_ELEMENTS.previewContainer.innerHTML = '';
        const clone = PAVNXET_ELEMENTS.renderContainer.cloneNode(true);
        clone.id = 'previewSlide';
        clone.classList.remove('fixed', '-z-50', 'opacity-0', 'pointer-events-none');
        clone.style.transform = `scale(${scale})`;
        clone.style.transformOrigin = 'top left';
        clone.style.width = '1920px';
        clone.style.height = '1080px';

        PAVNXET_ELEMENTS.previewContainer.appendChild(clone);
    }
}

// PDF Generation
async function generateSlides() {
    if (isProcessing) return;

    const text = PAVNXET_ELEMENTS.input.value;
    if (!text.trim()) {
        log('Error: Input is empty.', 'error');
        return;
    }

    isProcessing = true;
    PAVNXET_ELEMENTS.generateBtn.disabled = true;
    PAVNXET_ELEMENTS.generateBtn.classList.add('opacity-50', 'cursor-not-allowed');
    updateProgress(0);
    log('Starting process...', 'process');

    try {
        // 1. Parse
        log('Parsing input text...', 'process');
        const questions = parseQuestions(text);

        if (questions.length === 0) {
            throw new Error('No valid questions found. Check input format.');
        }

        log(`Found ${questions.length} questions.`, 'success');

        // 2. Initialize PDF (with compression)
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [1920, 1080],
            hotfixes: ['px_scaling'],
            compress: true
        });

        // 3. Render Loop
        const total = questions.length;

        for (let i = 0; i < total; i++) {
            const q = questions[i];
            log(`Rendering Slide ${i + 1}/${total}...`);

            // Populate DOM
            PAVNXET_ELEMENTS.slideQNum.innerText = q.id.padStart(2, '0');
            PAVNXET_ELEMENTS.slideQuestionEn.innerText = q.textEn;
            PAVNXET_ELEMENTS.slideQuestionHi.innerText = q.textHi;
            PAVNXET_ELEMENTS.slideOptA.innerText = q.options.a;
            PAVNXET_ELEMENTS.slideOptB.innerText = q.options.b;
            PAVNXET_ELEMENTS.slideOptC.innerText = q.options.c;
            PAVNXET_ELEMENTS.slideOptD.innerText = q.options.d;

            await new Promise(r => setTimeout(r, 50));

            const outer = PAVNXET_ELEMENTS.renderContainer.parentElement;
            const outerPrev = outer.style.cssText;
            outer.style.cssText = 'position:fixed;top:0;left:0;width:1920px;height:1080px;z-index:-1;opacity:1;pointer-events:none;overflow:hidden;';

            const canvas = await html2canvas(outer, {
                scale: 2,
                useCORS: true,
                backgroundColor: null,
                logging: false
            });

            outer.style.cssText = outerPrev;

            const imgData = canvas.toDataURL('image/png');

            if (i > 0) doc.addPage([1920, 1080]);
            doc.addImage(imgData, 'PNG', 0, 0, 1920, 1080);

            updateProgress(((i + 1) / total) * 100);
        }

        // 4. Save
        log('Finalizing PDF...', 'process');
        doc.save('mcq-presentation.pdf');
        log('Download started!', 'success');
        updateProgress(100);

    } catch (error) {
        log(`Error: ${error.message}`, 'error');
        console.error(error);
    } finally {
        isProcessing = false;
        PAVNXET_ELEMENTS.generateBtn.disabled = false;
        PAVNXET_ELEMENTS.generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');

        setTimeout(() => {
            if (!isProcessing) {
                updateProgress(0);
            }
        }, 3000);
    }
}

// Event Listeners
PAVNXET_ELEMENTS.generateBtn.addEventListener('click', generateSlides);

PAVNXET_ELEMENTS.clearBtn.addEventListener('click', () => {
    PAVNXET_ELEMENTS.input.value = '';
    log('Input cleared.', 'info');
    updateProgress(0);
    PAVNXET_ELEMENTS.previewContainer.innerHTML = ''; // Clear preview
});

PAVNXET_ELEMENTS.themeSelect.addEventListener('change', (e) => {
    switchTheme(e.target.value);
});

PAVNXET_ELEMENTS.input.addEventListener('input', () => {
    clearTimeout(previewTimeout);
    previewTimeout = setTimeout(updatePreview, 500); // Debounce
});

// Window Resize Handling for Preview Scaling
window.addEventListener('resize', () => {
    if (PAVNXET_ELEMENTS.input.value.trim()) {
        updatePreview();
    }
});

// Initial Setup
switchTheme('whiteboard');
log('System initialized.');
log('PWA Service Worker ready.');

// Watermark Greeting
console.log("%c🚀 Powered by slides-maker | github.com/pavnxet/slides-maker", "font-weight: bold; font-size: 14px; color: #3b82f6; padding: 10px; border: 1px solid #3b82f6; border-radius: 5px;");
