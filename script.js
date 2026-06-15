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

// Theme Handling
function switchTheme(theme) {
    PAVNXET_ELEMENTS.renderContainer.setAttribute('data-theme', theme);

    // Update Badge Styles based on theme
    const badges = PAVNXET_ELEMENTS.renderContainer.querySelectorAll('.opt-badge');
    const badgeColors = ['badge-A', 'badge-B', 'badge-C', 'badge-D'];

    badges.forEach((badge, index) => {
        // Reset classes
        badge.className = `opt-badge w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 transition-colors duration-300`;

        if (theme === 'print') {
            badge.style.border = '2px solid black';
            badge.style.color = 'black';
            badge.style.backgroundColor = 'white';
        } else {
            badge.classList.add(badgeColors[index]);
            badge.style.border = '';
            badge.style.color = '';
            badge.style.backgroundColor = '';
        }
    });

    // Dark Mode Specific Backgrounds
    const bgElements = document.getElementById('bgElements');
    if (theme === 'dark') {
        PAVNXET_ELEMENTS.renderContainer.classList.add('bg-[#0f172a]', 'text-white');
        PAVNXET_ELEMENTS.renderContainer.classList.remove('bg-white', 'text-slate-900');
        bgElements.style.opacity = '1';
    } else {
        PAVNXET_ELEMENTS.renderContainer.classList.add('bg-white', 'text-slate-900');
        PAVNXET_ELEMENTS.renderContainer.classList.remove('bg-[#0f172a]', 'text-white');
        bgElements.style.opacity = '0';
    }

    log(`Switched to ${theme} theme.`);
    updatePreview(); // Re-render preview
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

            // Wait for DOM update
            await new Promise(r => setTimeout(r, 50));

            // Capture with JPEG compression
            const canvas = await html2canvas(PAVNXET_ELEMENTS.renderContainer, {
                scale: 1,
                useCORS: true,
                backgroundColor: null,
                logging: false
            });

            // Use JPEG with 0.8 quality for optimization
            const imgData = canvas.toDataURL('image/jpeg', 0.8);

            if (i > 0) doc.addPage([1920, 1080]);
            doc.addImage(imgData, 'JPEG', 0, 0, 1920, 1080, undefined, 'FAST');

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
