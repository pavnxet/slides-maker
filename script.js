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

    // Regex patterns
    const questionStartRegex = /^(\d+)\.\s*(.+)/;

    // Helper to extract options from a line
    function extractOptions(line, qObj) {
        // Regex to support both (a) and a. formats
        const patterns = {
            a: /(?:\(a\)|a\.)\s*(.+?)(?=\s*(?:\(b\)|b\.)|$)/i,
            b: /(?:\(b\)|b\.)\s*(.+?)(?=\s*(?:\(c\)|c\.)|$)/i,
            c: /(?:\(c\)|c\.)\s*(.+?)(?=\s*(?:\(d\)|d\.)|$)/i,
            d: /(?:\(d\)|d\.)\s*(.+)/i
        };

        Object.keys(patterns).forEach(opt => {
            const match = line.match(patterns[opt]);
            if (match) qObj.options[opt] = match[1].trim();
        });
    }

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
                const isNextLineOption = /(?:\(a\)|a\.)/.test(nextLine);
                const isNextLineQuestion = /^\d+\./.test(nextLine);

                if (!isNextLineQuestion && !isNextLineOption) {
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
