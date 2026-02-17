const { jsPDF } = window.jspdf;

// DOM Elements
const elements = {
    input: document.getElementById('questionInput'),
    generateBtn: document.getElementById('generateBtn'),
    clearBtn: document.getElementById('clearBtn'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    logWindow: document.getElementById('logWindow'),
    renderContainer: document.getElementById('slideTemplate'),
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

    elements.logWindow.appendChild(div);
    elements.logWindow.scrollTop = elements.logWindow.scrollHeight;
}

// Progress Bar Helper
function updateProgress(percent) {
    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.innerText = `${Math.round(percent)}%`;
}

// Parser Logic
function parseQuestions(text) {
    const questions = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');

    let currentQuestion = null;
    let state = 'IDLE'; // IDLE, QUESTION_EN, QUESTION_HI, OPTIONS

    // Regex patterns
    const questionStartRegex = /^(\d+)\.\s*(.+)/;
    const optionARegex = /\(a\)\s*(.+?)(?=\s*\(b\)|$)/;
    const optionBRegex = /\(b\)\s*(.+?)(?=\s*\(c\)|\(d\)|$)/;
    const optionCRegex = /\(c\)\s*(.+?)(?=\s*\(d\)|$)/;
    const optionDRegex = /\(d\)\s*(.+)/;

    // Helper to extract options from a line
    function extractOptions(line, qObj) {
        // Try to match (a) ... (b) ...
        // and (c) ... (d) ...
        // This is a simple parser assuming the format is relatively consistent

        // Check for (a) and (b)
        if (line.includes('(a)')) {
            const matchA = line.match(/\(a\)\s*(.+?)(?=\s*\(b\)|$)/);
            if (matchA) qObj.options.a = matchA[1].trim();

            const matchB = line.match(/\(b\)\s*(.+?)(?=\s*\(c\)|\(d\)|$)/); // (b) usually followed by nothing or end of line in this format, but let's be safe
            if (matchB) qObj.options.b = matchB[1].trim();

            // In case (a) (b) (c) (d) are all on one line
             const matchC = line.match(/\(c\)\s*(.+?)(?=\s*\(d\)|$)/);
             if (matchC) qObj.options.c = matchC[1].trim();

             const matchD = line.match(/\(d\)\s*(.+)/);
             if (matchD) qObj.options.d = matchD[1].trim();
        }
        // Check for (c) and (d)
        else if (line.includes('(c)')) {
            const matchC = line.match(/\(c\)\s*(.+?)(?=\s*\(d\)|$)/);
            if (matchC) qObj.options.c = matchC[1].trim();

            const matchD = line.match(/\(d\)\s*(.+)/);
            if (matchD) qObj.options.d = matchD[1].trim();
        }
    }

    // We'll iterate through lines and try to build question objects
    // This is a state machine approach

    /*
      The format is:
      1. [English]
      [Hindi]
      (a)... (b)...
      (c)... (d)...
    */

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if new question starts
        const qMatch = line.match(questionStartRegex);
        if (qMatch) {
            // Save previous question if exists
            if (currentQuestion) {
                questions.push(currentQuestion);
            }

            // Start new question
            currentQuestion = {
                id: qMatch[1],
                textEn: qMatch[2],
                textHi: '',
                options: { a: '', b: '', c: '', d: '' }
            };

            // Look ahead for Hindi text (next line usually)
            // But we need to be careful not to consume options if they appear immediately
            if (i + 1 < lines.length) {
                const nextLine = lines[i+1];
                if (!nextLine.match(/^\d+\./) && !nextLine.includes('(a)')) {
                   currentQuestion.textHi = nextLine;
                   i++; // Skip next line
                }
            }
            continue;
        }

        // If we have a current question, look for options
        if (currentQuestion) {
            extractOptions(line, currentQuestion);
        }
    }

    // Push the last question
    if (currentQuestion) {
        questions.push(currentQuestion);
    }

    return questions;
}

// PDF Generation
async function generateSlides() {
    if (isProcessing) return;

    const text = elements.input.value;
    if (!text.trim()) {
        log('Error: Input is empty.', 'error');
        return;
    }

    isProcessing = true;
    elements.generateBtn.disabled = true;
    elements.generateBtn.classList.add('opacity-50', 'cursor-not-allowed');
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

        // 2. Initialize PDF
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [1920, 1080],
            hotfixes: ['px_scaling']
        });

        // 3. Render Loop
        const total = questions.length;

        for (let i = 0; i < total; i++) {
            const q = questions[i];
            log(`Processing Slide ${i + 1}/${total} (Q${q.id})...`);

            // Populate DOM
            elements.slideQNum.innerText = q.id.padStart(2, '0');
            elements.slideQuestionEn.innerText = q.textEn;
            elements.slideQuestionHi.innerText = q.textHi;
            elements.slideOptA.innerText = q.options.a;
            elements.slideOptB.innerText = q.options.b;
            elements.slideOptC.innerText = q.options.c;
            elements.slideOptD.innerText = q.options.d;

            // Wait for DOM update (small delay to ensure rendering)
            await new Promise(r => setTimeout(r, 100));

            // Capture
            const canvas = await html2canvas(elements.renderContainer, {
                scale: 1, // 1:1 scale with the 1920x1080 container
                useCORS: true,
                backgroundColor: null,
                logging: false
            });

            const imgData = canvas.toDataURL('image/png');

            if (i > 0) doc.addPage([1920, 1080]);
            doc.addImage(imgData, 'PNG', 0, 0, 1920, 1080);

            // Update Progress
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
        elements.generateBtn.disabled = false;
        elements.generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');

        setTimeout(() => {
            if (!isProcessing) {
               // updateProgress(0);
               // Keep at 100% for satisfaction until next run
            }
        }, 3000);
    }
}

// Event Listeners
elements.generateBtn.addEventListener('click', generateSlides);

elements.clearBtn.addEventListener('click', () => {
    elements.input.value = '';
    log('Input cleared.', 'info');
    updateProgress(0);
});

// Initial Log
log('System initialized.');
log('Ready to process questions.');
