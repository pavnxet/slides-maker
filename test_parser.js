
// Parser Logic (Copied from script.js for testing)
function parseQuestions(text) {
    const questions = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line !== '');

    let currentQuestion = null;

    // Regex patterns
    const questionStartRegex = /^(\d+)\.\s*(.+)/;

    // Helper to extract options from a line
    function extractOptions(line, qObj) {
        // Check for (a) and (b)
        if (line.includes('(a)')) {
            const matchA = line.match(/\(a\)\s*(.+?)(?=\s*\(b\)|$)/);
            if (matchA) qObj.options.a = matchA[1].trim();

            const matchB = line.match(/\(b\)\s*(.+?)(?=\s*\(c\)|\(d\)|$)/);
            if (matchB) qObj.options.b = matchB[1].trim();

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

// Test Data
const sampleText = `
1. What is the capital of France?
फ्रांस की राजधानी क्या है?
(a) Berlin (b) Madrid
(c) Paris (d) Rome

2. Which planet is known as the Red Planet?
(a) Earth (b) Mars
(c) Jupiter (d) Saturn

3. Single line options example?
(a) One (b) Two (c) Three (d) Four
`;

console.log("Running Parser Test...");
const result = parseQuestions(sampleText);
console.log(JSON.stringify(result, null, 2));

// Assertions
let passed = true;

if (result.length === 3) {
    console.log("PASS: Found 3 questions.");
} else {
    console.log("FAIL: Expected 3 questions, found " + result.length);
    passed = false;
}

if (result[0].options.c === "Paris") {
    console.log("PASS: Q1 Option C is correct.");
} else {
    console.log("FAIL: Q1 Option C is " + result[0].options.c);
    passed = false;
}

if (result[0].textHi === "फ्रांस की राजधानी क्या है?") {
    console.log("PASS: Q1 Hindi text captured.");
} else {
    console.log("FAIL: Q1 Hindi text is " + result[0].textHi);
    passed = false;
}

if (result[1].textHi === "") {
    console.log("PASS: Q2 Hindi text is empty (correctly skipped).");
} else {
    console.log("FAIL: Q2 Hindi text is " + result[1].textHi);
    passed = false;
}

if (result[2].options.d === "Four") {
    console.log("PASS: Q3 single line options parsed.");
} else {
    console.log("FAIL: Q3 Option D is " + result[2].options.d);
    passed = false;
}

if (!passed) process.exit(1);
