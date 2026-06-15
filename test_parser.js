function parseQuestions(text) {
    const questions = [];
    text = text.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
    const questionBlocks = text.split(/\n(?=\d+\.\s)/).filter(block => block.trim().length > 0);

    questionBlocks.forEach(block => {
        const questionMatch = block.match(/^(\d+)\.\s+([\s\S]+?)(?=(?:\n\s*(?:[a-dA-D]\.|[a-dA-D]\)|(?:\(|\[)[a-dA-D](?:\)|\])))|$)/);
        if (questionMatch) {
            const id = questionMatch[1];
            let rawQuestionText = questionMatch[2].trim();
            const qLines = rawQuestionText.split('\n').map(l => l.trim()).filter(l => l);
            let textEn = qLines[0] || "";
            let textHi = qLines.length > 1 ? qLines.slice(1).join('\n') : "";
            const options = { a: '', b: '', c: '', d: '' };
            const optionRegex = /(?:^|\s)(?:\(|\[)?([a-dA-D])(?:\)|\]|\.)\s+([\s\S]+?)(?=(?:\s(?:\(|\[)?[a-dA-D](?:\)|\]|\.)\s)|$)/g;
            const optionsText = block.substring(questionMatch[0].length);
            let optionMatch;
            while ((optionMatch = optionRegex.exec(optionsText)) !== null) {
                const label = optionMatch[1].toLowerCase();
                const optText = optionMatch[2].trim();
                if (options.hasOwnProperty(label)) options[label] = optText;
            }
            if (!options.a && !options.b) {
                const inlineOptionRegex = /(?:\(|\[)?([a-dA-D])(?:\)|\]|\.)\s+([\s\S]+?)(?=(?:\s(?:\(|\[)?[a-dA-D](?:\)|\]|\.)\s)|$)/g;
                let inlineOptionMatch;
                while ((inlineOptionMatch = inlineOptionRegex.exec(rawQuestionText)) !== null) {
                    const label = inlineOptionMatch[1].toLowerCase();
                    const optText = inlineOptionMatch[2].trim();
                    if (options.hasOwnProperty(label)) options[label] = optText;
                }
                if (options.a || options.b) {
                    const lastOptionEnd = rawQuestionText.lastIndexOf(options.d || options.c || options.b || options.a);
                    const stripped = rawQuestionText.substring(0, lastOptionEnd).replace(/[\s\(]*(?:[a-dA-D][\.\)\]\s]+)$/, '').trim();
                    if (stripped) textEn = stripped;
                    textHi = '';
                }
            }
            questions.push({ id, textEn, textHi, options });
        }
    });
    return questions;
}

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

4. Inline options test (a) Alpha (b) Beta (c) Gamma (d) Delta
`;

console.log("Running Parser Test...");
const result = parseQuestions(sampleText);
console.log(JSON.stringify(result, null, 2));

let passed = true;

if (result.length === 4) {
    console.log("PASS: Found 4 questions.");
} else {
    console.log("FAIL: Expected 4 questions, found " + result.length);
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

if (result[3].options.a === "Alpha" && result[3].options.d === "Delta") {
    console.log("PASS: Q4 inline options parsed.");
} else {
    console.log("FAIL: Q4 inline options - a:" + result[3].options.a + " d:" + result[3].options.d);
    passed = false;
}

if (result[3].textEn.includes("Inline options test")) {
    console.log("PASS: Q4 question text preserved after inline parse.");
} else {
    console.log("FAIL: Q4 textEn is '" + result[3].textEn + "'");
    passed = false;
}

if (!passed) process.exit(1);
console.log("\nAll tests passed!");
