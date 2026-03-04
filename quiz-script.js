
// ==========================================
// AI TOKENS (LOAD FROM ENV/LOCALSTORAGE)
// ==========================================
const ENV = window.ENV || {};

let GEMINI_FLASH_KEY = localStorage.getItem('GEMINI_FLASH_KEY') || ENV.GEMINI_FLASH_KEY || '';
let GEMINI_BLIND_KEY = localStorage.getItem('GEMINI_BLIND_KEY') || ENV.GEMINI_BLIND_KEY || '';
let GPT5_TOKEN = localStorage.getItem('GPT5_TOKEN') || ENV.GPT5_TOKEN || '';
let GROK_TOKEN = localStorage.getItem('GROK_TOKEN') || ENV.GROK_TOKEN || '';



document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    // API UI Removed

    // Inputs
    const fileInput = document.getElementById('file-upload');
    const fileNameSpan = document.getElementById('file-name');
    const difficultyInput = document.getElementById('difficulty');
    const questionCountInput = document.getElementById('question-count');
    const languageInput = document.getElementById('output-language');
    const enableExplanationCb = document.getElementById('enable-explanation');
    const enableImprovementCb = document.getElementById('enable-improvement');
    const improvementOptionsDiv = document.getElementById('improvement-options');
    
    // Improvement Inputs
    const matrixInput = document.getElementById('matrix-upload');
    const matrixNameSpan = document.getElementById('matrix-name'); // Ensure this ID exists in HTML or remove
    const choicesInput = document.getElementById('choices-upload'); // New input
    const choicesNameSpan = document.getElementById('choices-name');
    const bankInput = document.getElementById('bank-upload');
    const bankNameSpan = document.getElementById('bank-name'); // Ensure this ID exists in HTML or remove
    const incDifficultyCb = document.getElementById('inc-difficulty');
    const incDiscriminationCb = document.getElementById('inc-discrimination');

    const generateBtn = document.getElementById('generate-btn');
    const loadingDiv = document.getElementById('loading');
    const quizContainer = document.getElementById('quiz-container');
    const actionBar = document.getElementById('action-bar');
    const submitBtn = document.getElementById('submit-quiz-btn');
    const exportPdfBtn = document.getElementById('export-pdf-btn');
    
    // Export Modal
    const exportModal = document.getElementById('export-modal');
    const exportYesBtn = document.getElementById('export-yes');
    const exportNoBtn = document.getElementById('export-no');
    const exportCancelBtn = document.getElementById('export-cancel');

    // Google Form
    const createFormBtn = document.getElementById('create-form-btn');
    
    // Replace this with your actual Google Client ID from Google Cloud Console
    // Must enable Google Forms API and Google Drive API
    // Correct format: "YOUR_CLIENT_ID.apps.googleusercontent.com"
    let GOOGLE_CLIENT_ID = localStorage.getItem('GOOGLE_CLIENT_ID') || ENV.GOOGLE_CLIENT_ID || '';
    if (!GOOGLE_CLIENT_ID) {
        console.warn("GOOGLE_CLIENT_ID is missing. Google Forms feature will not work.");
    } 

    // --- Config Modal Logic ---
    const configBtn = document.getElementById('config-btn');
    const configModal = document.getElementById('config-modal');
    const cfgSaveBtn = document.getElementById('cfg-save-btn');
    const cfgCancelBtn = document.getElementById('cfg-cancel-btn');

    const cfgGeminiFlash = document.getElementById('cfg-gemini-flash');
    const cfgGeminiBlind = document.getElementById('cfg-gemini-blind');
    const cfgGpt5 = document.getElementById('cfg-gpt5');
    const cfgGrok = document.getElementById('cfg-grok');
    const cfgClientId = document.getElementById('cfg-client-id');

    if (configBtn) {
        configBtn.addEventListener('click', () => {
            cfgGeminiFlash.value = localStorage.getItem('GEMINI_FLASH_KEY') || ENV.GEMINI_FLASH_KEY || '';
            cfgGeminiBlind.value = localStorage.getItem('GEMINI_BLIND_KEY') || ENV.GEMINI_BLIND_KEY || '';
            cfgGpt5.value = localStorage.getItem('GPT5_TOKEN') || ENV.GPT5_TOKEN || '';
            cfgGrok.value = localStorage.getItem('GROK_TOKEN') || ENV.GROK_TOKEN || '';
            cfgClientId.value = localStorage.getItem('GOOGLE_CLIENT_ID') || ENV.GOOGLE_CLIENT_ID || '';
            configModal.classList.remove('hidden');
        });
    }

    if (cfgSaveBtn) {
        cfgSaveBtn.addEventListener('click', () => {
            localStorage.setItem('GEMINI_FLASH_KEY', cfgGeminiFlash.value.trim());
            localStorage.setItem('GEMINI_BLIND_KEY', cfgGeminiBlind.value.trim());
            localStorage.setItem('GPT5_TOKEN', cfgGpt5.value.trim());
            localStorage.setItem('GROK_TOKEN', cfgGrok.value.trim());
            localStorage.setItem('GOOGLE_CLIENT_ID', cfgClientId.value.trim());
            alert('Cấu hình đã được lưu! Trang sẽ tải lại để áp dụng thay đổi.');
            location.reload();
        });
    }

    if (cfgCancelBtn) {
        cfgCancelBtn.addEventListener('click', () => {
            configModal.classList.add('hidden');
        });
    } 

    // State
    let currentQuizData = [];
    let isQuizSubmitted = false;
    let fileContent = '';
    let matrixContent = '';
    let choicesContent = '';
    let bankContent = '';
    let tokenClient;
    let accessToken = null;

    // --- Google Auth ---
    function initGoogleAuth() {
        if (!window.google) return;
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/forms.body https://www.googleapis.com/auth/drive.file',
            callback: (tokenResponse) => {
                if (tokenResponse.access_token) {
                    accessToken = tokenResponse.access_token;
                    console.log("Google Access Token acquired");
                    createGoogleFormAction(); // Proceed to create form after auth
                }
            },
        });
    }
    // Initialize slightly after load
    setTimeout(initGoogleAuth, 1000);

    createFormBtn.addEventListener('click', () => {
        if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_GOOGLE_CLIENT_ID')) {
            alert("Vui lòng cấu hình GOOGLE_CLIENT_ID (trong file env.js hoặc cấu hình trực tiếp) để sử dụng tính năng này.");
            return;
        }

        if (!accessToken) {
            // Trigger Auth Flow
            // Removed 'hint' as we removed the email input. Google will show account chooser.
            tokenClient.requestAccessToken();
        } else {
            createGoogleFormAction();
        }
    });

    async function createGoogleFormAction() {
        if (!currentQuizData || currentQuizData.length === 0) {
            alert("Chưa có dữ liệu câu hỏi để tạo Form.");
            return;
        }

        try {
            showLoading(true);
            updateProgress(6, 'Đang tạo Google Form...'); // Re-use progress UI temporarily

            // 1. Create a new blank form
            const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    info: {
                        title: "Bài Kiểm Tra Trắc Nghiệm (AI Generated)",
                        documentTitle: "Quiz_AI_" + new Date().toISOString().slice(0,10)
                    }
                })
            });

            if (!createRes.ok) throw new Error('Failed to create form: ' + createRes.statusText);
            const formData = await createRes.json();
            const formId = formData.formId;
            const formUrl = formData.responderUri;

            // 2. Batch Update to add questions and settings
            const requests = [];

            // A. Update Settings to make it a QUIZ
            requests.push({
                updateSettings: {
                    settings: {
                        quizSettings: {
                            isQuiz: true
                        }
                    },
                    updateMask: "quizSettings.isQuiz"
                }
            });

            // B. Add Questions
            const pointPerQuestion = Math.floor(10 / currentQuizData.length) || 1; // Integer points required? API supports int only usually. Let's use 1 if < 1. 
            // Actually API supports int point values. 10 / n might be decimal. 
            // Google Forms API pointValue is integer.
            // Let's just set 1 point per question to be safe, or round.
            // Requirement: "điểm của mỗi câu hỏi trắc nghiệm được chia đều theo thang điểm 10"
            // If 10 questions, 1 point each. If 3 questions, 3 points each (total 9). 
            // We'll do Math.floor(10 / count).

            currentQuizData.forEach((q, index) => {
                requests.push({
                    createItem: {
                        item: {
                            title: `Câu ${index + 1}: ${q.question}`,
                            questionItem: {
                                question: {
                                    required: true,
                                    grading: {
                                        pointValue: pointPerQuestion,
                                        correctAnswers: {
                                            answers: [{ value: q.options[q.answer] }] // Logic: value matches option text
                                        }
                                    },
                                    choiceQuestion: {
                                        type: 'RADIO',
                                        options: q.options.map(opt => ({ value: opt }))
                                    }
                                }
                            }
                        },
                        location: { index: index }
                    }
                });
            });

            const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}:batchUpdate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ requests })
            });

            if (!updateRes.ok) throw new Error('Failed to add questions: ' + updateRes.statusText);

            // 3. Redirect
            showLoading(false);
            alert("Tạo Google Form thành công!");
            window.open(formUrl, '_blank');

        } catch (e) {
            console.error(e);
            alert("Lỗi khi tạo Google Form: " + e.message);
            showLoading(false);
        }
    }

    // --- Event Listeners ---

    // File Upload Handlers
    fileInput.addEventListener('change', handleFileSelect(fileNameSpan, 'Đã chọn tài liệu'));
    if (matrixInput) matrixInput.addEventListener('change', handleFileSelect(matrixNameSpan, 'Đã chọn ma trận'));
    if (choicesInput) choicesInput.addEventListener('change', handleFileSelect(choicesNameSpan, 'Đã chọn bảng lựa chọn'));
    if (bankInput) bankInput.addEventListener('change', handleFileSelect(bankNameSpan, 'Đã chọn ngân hàng'));

    function handleFileSelect(labelElement, prefix) {
        return (e) => {
            const file = e.target.files[0];
            if (file) {
                if (labelElement) {
                    labelElement.textContent = `${prefix}: ${file.name}`;
                }
                checkEnableGenerate();
            }
        };
    }

    // Toggle Improvement Options
    enableImprovementCb.addEventListener('change', (e) => {
        if (e.target.checked) {
            improvementOptionsDiv.classList.remove('hidden');
        } else {
            improvementOptionsDiv.classList.add('hidden');
        }
        checkEnableGenerate();
    });

    function checkEnableGenerate() {
        let isValid = fileInput.files.length > 0;
        generateBtn.disabled = !isValid;
    }

    // Generate Quiz
    generateBtn.addEventListener('click', async () => {
        if (!GEMINI_FLASH_KEY || !GEMINI_BLIND_KEY || !GPT5_TOKEN || !GROK_TOKEN) {
            alert('Thiếu API Keys/Tokens: GEMINI_FLASH_KEY, GEMINI_BLIND_KEY, GPT5_TOKEN, GROK_TOKEN. Vui lòng kiểm tra các biến ở đầu file quiz-script.js.');
            return;
        }

        // Reset UI
        quizContainer.innerHTML = '';
        quizContainer.classList.add('hidden');
        actionBar.classList.add('hidden');
        isQuizSubmitted = false;
        currentQuizData = [];

        try {
            showLoading(true);

            // Step 0: Read Files
            updateProgress(1, 'Đang đọc và phân tích dữ liệu...');
            fileContent = await readFileContent(fileInput.files[0]);
            
            if (enableImprovementCb.checked) {
                if (matrixInput && matrixInput.files.length > 0) {
                    matrixContent = await readFileContent(matrixInput.files[0]);
                }
                if (choicesInput && choicesInput.files.length > 0) {
                    choicesContent = await readFileContent(choicesInput.files[0]);
                }
                if (bankInput && bankInput.files.length > 0) {
                    bankContent = await readFileContent(bankInput.files[0]);
                }
            }

            // Step 1: Context Expansion (Grok 3)
            const difficultyLevel = ['Dễ', 'Vừa', 'Khó'][parseInt(difficultyInput.value)];
            const questionCount = parseInt(questionCountInput.value);
            const lang = languageInput.value; // 'vi' or 'en'
            
            updateProgress(1, 'Đang mở rộng kiến thức và phân tích lỗi thường gặp (Grok 3)...');
            const expandedContext = await step1_ExpandContext(fileContent, difficultyLevel, lang);

            // Step 2: Generate Questions (Gemini)
            updateProgress(2, `Đang tạo ${questionCount} câu hỏi mức độ ${difficultyLevel} (Gemini-2.5-flash)...`);
            let questions = await step2_GenerateQuestions(expandedContext, difficultyLevel, questionCount, lang);

            // Step 3: Check Delta L (Logic + Gemini Fix)
            updateProgress(3, 'Đang kiểm tra độ nhiễu và độ dài đáp án (GPT-5)...');
            questions = await step3_CheckDeltaL(questions, lang);

            // Step 4: Check Hallucinations (Gemini)
            updateProgress(4, 'Đang kiểm tra tính chính xác (GPT-5)...');
            questions = await step3_5_CheckHallucinations(questions, expandedContext, lang);

            // Step 5: Blind Verification (Gemini 2.5 Flash - Key 2)
            updateProgress(5, 'Đang thẩm định chất lượng câu hỏi (Blind Test - Gemini 2.5 Flash)...');
            questions = await step4_BlindTest(questions, lang);

            // Step 6: Explanations (Gemini)
            if (enableExplanationCb.checked) {
                updateProgress(6, 'Đang tạo lời giải thích ngắn gọn (Gemini-2.5-flash)...');
                questions = await step5_GenerateExplanations(questions, expandedContext, lang);
            }

            // Render
            currentQuizData = questions;
            renderQuiz(questions);
            showLoading(false);
            quizContainer.classList.remove('hidden');
            actionBar.classList.remove('hidden');

        } catch (error) {
            console.error(error);
            alert('Lỗi: ' + error.message);
            showLoading(false);
        }
    });

    // Submit Quiz
    submitBtn.addEventListener('click', () => {
        isQuizSubmitted = true;
        let score = 0;
        
        currentQuizData.forEach((q, index) => {
            const card = document.getElementById(`q-card-${index}`);
            const selected = document.querySelector(`input[name="q${index}"]:checked`);
            const correctIndex = q.answer; // 0-3

            // Show explanation
            const expBox = card.querySelector('.explanation-box');
            if (expBox) expBox.classList.remove('hidden');

            // Highlight correct answer
            const correctLabel = card.querySelector(`label[data-idx="${correctIndex}"]`);
            if (correctLabel) correctLabel.classList.add('correct-answer');

            // Check user answer
            if (selected) {
                const userVal = parseInt(selected.value);
                if (userVal === correctIndex) {
                    score++;
                } else {
                    selected.parentElement.classList.add('wrong-answer');
                }
            }
            card.classList.add('answered');
        });

        alert(`Bạn trả lời đúng ${score}/${currentQuizData.length} câu!`);
        exportPdfBtn.classList.remove('hidden');
        submitBtn.disabled = true;
        submitBtn.textContent = `Kết quả: ${score}/${currentQuizData.length}`;
    });

    // Export PDF
    exportPdfBtn.addEventListener('click', () => exportModal.classList.remove('hidden'));
    exportCancelBtn.addEventListener('click', () => exportModal.classList.add('hidden'));
    
    exportYesBtn.addEventListener('click', () => {
        exportToPDF(true);
        exportModal.classList.add('hidden');
    });
    
    exportNoBtn.addEventListener('click', () => {
        exportToPDF(false);
        exportModal.classList.add('hidden');
    });

    // --- AI Calling Functions (Azure AI Inference) ---
    async function callAzureInference(token, modelName, messages, expectJson = true) {
        const url = 'https://models.inference.ai.azure.com/chat/completions';
        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: modelName,
                messages,
                temperature: 0.7,
                response_format: expectJson ? { type: "json_object" } : undefined
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`AI API Error (${modelName}): ${err.error?.message || response.statusText}`);
        }
        const data = await response.json();
        let content = data.choices[0]?.message?.content || '';

        if (expectJson) {
            // 1. Strip Markdown
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                content = jsonMatch[1] || jsonMatch[0]; // jsonMatch[1] if markdown group, [0] if just braces
            }

            // 2. Try Strict Parse
            try {
                return JSON.parse(content);
            } catch (e) {
                console.warn(`JSON Parse Error (${modelName}). Attempting lenient parse...`, e);
                
                // 3. Lenient Parse (Regex)
                const obj = {};
                // Matches "key": "value" or "key": number or "key": [ ... ] (simple)
                // Note: Complex nested arrays/objects might fail this simple regex, 
                // but usually sufficient for flat lists or simple structures.
                // Improved Regex to catch arrays: "key": [...]
                
                // Fallback: If it's a list like "fixed_questions": [ ... ], try to extract the array content
                // This is specific to our use case where we often expect objects with arrays
                
                try {
                    // Dirty fix: replace newlines inside strings that might break JSON
                    // This is hard to do perfectly with regex, so we rely on the model instructions first.
                    
                    // Regex for extracting top-level keys
                    const regex = /"([a-zA-Z0-9_]+)"\s*:\s*(\[[\s\S]*?\]|"[^"]*"|\d+|true|false|null)/g;
                    let match;
                    let found = false;
                    while ((match = regex.exec(content)) !== null) {
                        found = true;
                        try {
                            obj[match[1]] = JSON.parse(match[2]);
                        } catch {
                            // If value parse fails (e.g. unescaped chars in string), take raw string
                            obj[match[1]] = match[2]; 
                        }
                    }
                    
                    if (found) return obj;

                } catch (lenientErr) {
                    console.error("Lenient parse also failed:", lenientErr);
                }

                console.error("Fatal JSON Parse Error. Raw content:", content);
                throw new Error(`AI (${modelName}) trả về dữ liệu không phải JSON hợp lệ.`);
            }
        }
        return content;
    }

    function sysMsgJSON() {
        return { role: "system", content: "Luôn trả về JSON hợp lệ, không dùng markdown code block." };
    }
    
    // GPT-5 (Sử dụng GPT-4o qua Azure AI Inference)
    async function callGPT5(prompt) {
        const sys = {
            role: "system",
            content: "You are a helpful assistant. You MUST return valid JSON only. Do not add explanations or markdown blocks."
        };
        // Model Name: 'gpt-4o' (Azure AI Inference / GitHub Models)
        return await callAzureInference(GPT5_TOKEN, "gpt-4o", [sys, { role: "user", content: prompt }], true);
    }
    
    // Grok 3 (GitHub Models / Azure AI Inference)
    async function callGrok(prompt) {
        const sys = {
            role: "system",
            content: "You are a helpful assistant. You MUST return valid JSON only. Do not add explanations or markdown blocks."
        };
        // Model Name: 'grok-3' (Azure AI Inference / GitHub Models)
        // Note: If 'grok-3' fails, try 'x-ai/grok-3' or 'grok-3-beta'
        return await callAzureInference(GROK_TOKEN, "grok-3", [sys, { role: "user", content: prompt }], true);
    }
    
    // DeepSeek-V3: Blind Test (REMOVED - Switched to Gemini)
    // async function callDeepSeekBlind(messages) { ... }
    async function callGeminiFlash(key, prompt, expectJson = true) {
        // Lưu ý: Nếu gemini-2.5-flash không tồn tại, hãy thử đổi thành gemini-1.5-flash hoặc gemini-2.0-flash-exp
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
        
        const generationConfig = { temperature: 0.7 };
        if (expectJson) {
            generationConfig.responseMimeType = "application/json";
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }]}],
                generationConfig: generationConfig,
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        if (!response.ok) {
            let errText = '';
            try { errText = await response.text(); } catch {}
            throw new Error(`Gemini API Error: ${response.status} - ${errText || response.statusText}`);
        }
        
        const data = await response.json();
        
        // Kiểm tra xem có candidate nào không
        if (!data.candidates || data.candidates.length === 0) {
            console.error("Gemini No Candidates:", data);
            if (data.promptFeedback) {
                throw new Error(`Gemini Safety Block: ${JSON.stringify(data.promptFeedback)}`);
            }
            throw new Error('Gemini không trả về kết quả (No candidates).');
        }

        let text = data.candidates[0].content?.parts?.[0]?.text || '';
        
        if (expectJson) {
            // Tìm chuỗi JSON hợp lệ nhất (từ { đầu tiên đến } cuối cùng)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                text = jsonMatch[0];
            }
            
            try { 
                return JSON.parse(text); 
            } catch (e) { 
                console.warn("Gemini JSON Parse Error. Attempting lenient parse...", e);
                // Lenient Parse: Cố gắng trích xuất key-value bằng Regex nếu JSON lỗi (do unescaped quotes hoặc newlines)
                const obj = {};
                // Regex: Tìm "key": "value"
                // Value được lấy đến khi gặp " mà theo sau là , hoặc }
                // [^"]+ cho key để tránh match sai
                const regex = /"([a-zA-Z0-9_]+)"\s*:\s*"([\s\S]*?)"\s*(?=[,}])/g;
                let match;
                let found = false;
                while ((match = regex.exec(text)) !== null) {
                    found = true;
                    // match[1]: Key
                    // match[2]: Value (raw content)
                    // Xử lý value: unescape cơ bản nếu cần, nhưng giữ nguyên các ký tự đặc biệt
                    // Lưu ý: replace(/\\"/g, '"') có thể cần thiết nếu model đã escape một số chỗ
                    obj[match[1]] = match[2]; 
                }
                
                if (found) {
                    console.log("Lenient parse success:", obj);
                    return obj;
                }

                console.error("Gemini JSON Parse Error. Raw text:", text);
                throw new Error('Gemini trả về dữ liệu không phải JSON hợp lệ. Xem Console để biết chi tiết.'); 
            }
        }
        return text;
    }

    // --- Logic Steps ---

    async function step1_ExpandContext(text, difficulty, lang = 'vi') {
        // 1. Chia nhỏ văn bản (Chunking strategy)
        const CHUNK_SIZE = 8000; // ~2000-2500 tokens per chunk
        const chunks = [];
        if (text.length <= CHUNK_SIZE) {
            chunks.push(text);
        } else {
            for (let i = 0; i < text.length; i += CHUNK_SIZE) {
                chunks.push(text.slice(i, i + CHUNK_SIZE));
            }
        }
        
        console.log(`Step 1: Splitting document into ${chunks.length} chunks for Grok 3 analysis...`);
        const targetLang = lang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh (English)';

        // 2. Xây dựng Prompt cho từng phần
        const processChunk = async (chunkText, index) => {
            let improvementContext = "";
            // Chỉ thêm Context cải thiện (IRT) vào chunk đầu tiên để tiết kiệm token
            if (index === 0 && enableImprovementCb.checked && matrixContent) {
                improvementContext = `
                DỮ LIỆU CẢI THIỆN (IRT - Tham khảo cho toàn bộ tài liệu):
                Dưới đây là ma trận kết quả học sinh. Phân tích tham số $b_i$ (độ khó) và $a_i$ (độ phân biệt).
                ${toSafeString(matrixContent, 2000)}
                `;
            }

            const prompt = `
            Bạn là trợ lý AI phân tích tài liệu học tập (Phần ${index + 1}/${chunks.length}).

            NHIỆM VỤ:
            Trích xuất kiến thức cốt lõi từ "Đoạn văn bản" bên dưới. Đây là một phần của tài liệu lớn.
            Ngôn ngữ đầu ra yêu cầu: ${targetLang}.

            Đoạn văn bản cần xử lý:
            """${toSafeString(chunkText, CHUNK_SIZE + 500)}"""

            ${improvementContext}

            YÊU CẦU:
            1. Trích xuất TẤT CẢ định nghĩa, công thức, sự kiện quan trọng trong đoạn này.
            2. Nếu đoạn văn bị cắt giữa chừng, hãy cố gắng hiểu ngữ cảnh hoặc bỏ qua câu không hoàn chỉnh.
            3. TRUNG THỰC: Không bịa đặt thông tin.

            Trả về JSON (Valid JSON Only):
            {
                "theory": "Chuỗi văn bản tóm tắt lý thuyết, kiến thức của đoạn này (bằng ${targetLang}, dùng \\n để xuống dòng)",
                "exercises": ["Dạng bài tập 1 (bằng ${targetLang})", "Dạng bài tập 2"],
                "mistakes": ["Lỗi sai 1 (bằng ${targetLang})", "Lỗi sai 2"]
            }
            `;
            
            try {
                // Ưu tiên dùng Grok 3 vì khả năng tổng hợp tốt
                if (GROK_TOKEN && GROK_TOKEN.startsWith('github_pat_')) {
                    return await callGrok(prompt);
                } else {
                    throw new Error("Grok Token missing or invalid.");
                }
            } catch (e) {
                console.warn(`Chunk ${index + 1}: Grok 3 failed (${e.message}). Switching to Gemini Flash fallback...`);
                try {
                    // Fallback: Gemini 2.5 Flash
                    // Sửa prompt một chút cho Gemini nếu cần, nhưng prompt hiện tại khá ổn
                    const geminiRes = await callGeminiFlash(GEMINI_FLASH_KEY, prompt);
                    return geminiRes;
                } catch (geminiErr) {
                    console.warn(`Chunk ${index + 1}: Gemini also failed (${geminiErr.message}). Using raw text fallback.`);
                    // Fallback cuối cùng: Trả về raw text để Step 2 tự xử lý
                    return { 
                        theory: chunkText, 
                        exercises: [], 
                        mistakes: [] 
                    };
                }
            }
        };

        // 3. Chạy song song (Parallel Execution)
        const results = await Promise.all(chunks.map((chunk, i) => processChunk(chunk, i)));

        // 4. Tổng hợp kết quả (Merge)
        let mergedTheory = "";
        let mergedExercises = [];
        let mergedMistakes = [];

        results.forEach(res => {
            if (res) {
                // Xử lý cả trường hợp res là string (lỗi parse JSON nhưng có nội dung)
                if (typeof res === 'string') {
                    mergedTheory += res + "\n\n";
                } else {
                    if (res.theory) mergedTheory += res.theory + "\n\n";
                    if (res.exercises && Array.isArray(res.exercises)) mergedExercises = mergedExercises.concat(res.exercises);
                    if (res.mistakes && Array.isArray(res.mistakes)) mergedMistakes = mergedMistakes.concat(res.mistakes);
                }
            }
        });

        // Fallback: Nếu không trích xuất được gì, dùng toàn bộ text gốc
        if (!mergedTheory.trim()) {
            console.warn("Step 1 Warning: No theory extracted. Using original text as context.");
            mergedTheory = text;
        }

        return {
            theory: mergedTheory,
            exercises: mergedExercises,
            mistakes: mergedMistakes
        };
    }

    async function step2_GenerateQuestions(context, difficulty, count, lang = 'vi') {
        let bloomDist = "";
        if (difficulty === 'Dễ') bloomDist = "70% Nhớ (Remember), 20% Hiểu (Understand), 10% Vận dụng (Apply), 0% Phân tích (Analyze)";
        else if (difficulty === 'Vừa') bloomDist = "20% Nhớ, 50% Hiểu, 20% Vận dụng, 10% Phân tích";
        else bloomDist = "0% Nhớ, 20% Hiểu, 50% Vận dụng, 30% Phân tích";

        const targetLang = lang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh (English)';

        let allQuestions = [];
        let remaining = count;
        let batchCount = 0;
        const BATCH_SIZE = 10; // Generate in small batches to ensure quality and quantity

        while (allQuestions.length < count) {
            batchCount++;
            // Calculate how many to generate in this batch
            const currentBatchSize = Math.min(BATCH_SIZE, remaining);
            // Request slightly more to account for bad generations/filtering
            const requestCount = currentBatchSize; 
            
            console.log(`Step 2: Generating batch ${batchCount} (Target: ${currentBatchSize}, Remaining needed: ${remaining})...`);
            updateProgress(2, `Đang tạo câu hỏi (Batch ${batchCount}: ${allQuestions.length}/${count})...`);

            let prompt = "";
            
            // IMPROVEMENT MODE: Improve existing bank
            if (enableImprovementCb.checked && bankContent) {
                // ... (Improvement mode logic remains similar but uses requestCount)
                // Note: For improvement mode, we typically process the whole bank or chunks. 
                // But here we assume we are generating NEW questions based on bank or improving.
                // If improving specific questions, this batching logic might be complex. 
                // However, the prompt implies "rewrite OR create new similar".
                // Let's stick to the prompt structure but update count.
                
                let improvementInstructions = "";
                if (incDifficultyCb.checked) improvementInstructions += "- Tăng độ khó: Tập trung vào các câu có $b_i < 0$ (dễ), viết lại nội dung sâu hơn, phức tạp hơn.\n";
                if (incDiscriminationCb.checked) improvementInstructions += "- Tăng độ phân loại: Tập trung vào các câu có $a_i < 1$ (kém phân loại), sửa lại các phương án nhiễu sao cho khó phân biệt hơn.\n";
                
                prompt = `
                Dữ liệu đầu vào:
                - Ngân hàng câu hỏi gốc (Tham khảo): ${toSafeString(bankContent, 5000)}
                - Phân tích lỗi (Mistakes): ${toSafeString(context.mistakes, 2000)}
                
                ${matrixContent ? `- Dữ liệu Ma trận (IRT): ${toSafeString(matrixContent, 2000)}` : ''}
                ${choicesContent ? `- Dữ liệu Lựa chọn Học sinh: ${toSafeString(choicesContent, 2000)}` : ''}

                Yêu cầu cải thiện:
                ${improvementInstructions}
                
                Hãy viết/tạo ${requestCount} câu hỏi trắc nghiệm (Ngôn ngữ: ${targetLang}).
                Đã có ${allQuestions.length} câu. Hãy tạo thêm các câu MỚI, KHÁC với các câu trước đó.
                Đảm bảo tuân thủ phân bổ Bloom: ${bloomDist}.
                Cấu trúc 4 lựa chọn (1 đúng, 3 sai).
                QUAN TRỌNG: Các lựa chọn (options) CHỈ chứa nội dung, KHÔNG được chứa các ký tự tiền tố như "A.", "B.", "1.", "-".
                
                Trả về JSON dạng: { "questions": [...] }
                `;
            } else {
                // NORMAL MODE: Generate from scratch
                prompt = `
                Dựa vào kiến thức sau:
                Lý thuyết: ${toSafeString(context.theory, 200000)}
                Lỗi sai thường gặp: ${toSafeString(context.mistakes, 10000)}

                Hãy tạo ${requestCount} câu hỏi trắc nghiệm (${targetLang}) theo cấu trúc chuẩn:
                - Phân bổ Bloom: ${bloomDist}.
                - Mỗi câu có 4 lựa chọn (options), 1 đúng, 3 sai.
                - Đáp án sai phải dựa trên "mistakes" đã phân tích để gây nhiễu tốt.
                - TRÁNH TRÙNG LẶP: Đã tạo ${allQuestions.length} câu. Các câu mới phải khác biệt về nội dung hoặc cách hỏi.
                
                QUAN TRỌNG: Các lựa chọn (options) CHỈ chứa nội dung, KHÔNG được chứa các ký tự tiền tố như "A.", "B.", "1.", "-".
                Ví dụ đúng: "Hà Nội"
                Ví dụ sai: "A. Hà Nội", "1. Hà Nội"

                Trả về JSON dạng:
                {
                    "questions": [
                        {
                            "id": ${allQuestions.length + 1}, // Start ID from next number
                            "question": "...",
                            "options": ["...", "...", "...", "..."],
                            "answer": 0,
                            "bloom_level": "Understand"
                        }
                    ]
                }
                `;
            }

            try {
                const res = await callGeminiFlash(GEMINI_FLASH_KEY, prompt);
                if (res && res.questions && Array.isArray(res.questions)) {
                    const normalizedBatch = normalizeQuestions(res.questions);
                    
                    // Add to total
                    allQuestions = allQuestions.concat(normalizedBatch);
                    
                    // Update remaining
                    remaining = count - allQuestions.length;

                    // Safety break if we aren't making progress
                    if (normalizedBatch.length === 0) {
                        console.warn("Batch returned 0 questions. Stopping to prevent loop.");
                        break;
                    }
                } else {
                    console.warn("Invalid batch response. Retrying...");
                }
            } catch (e) {
                console.error("Batch generation failed:", e);
                // Allow one or two failures, but don't loop forever
            }

            // Max iterations safety (e.g. max 10 batches or 2x expected batches)
            if (batchCount > Math.ceil(count / BATCH_SIZE) + 3) {
                console.warn("Max batches reached. Stopping.");
                break;
            }
        }
        
        // Trim if we got too many
        return allQuestions.slice(0, count);
    }

    async function step3_CheckDeltaL(questions, lang = 'vi') {
        if (!questions || !Array.isArray(questions)) {
            console.warn("Step 3 skipped: Invalid questions input", questions);
            return questions || [];
        }

        const badQuestions = [];
        const targetLang = lang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh (English)';
        
        questions.forEach((q, idx) => {
            const lengths = q.options.map(opt => opt.length);
            const correctLen = lengths[q.answer];
            const distractorLens = lengths.filter((_, i) => i !== q.answer);
            const avgDistractor = distractorLens.reduce((a,b) => a+b, 0) / distractorLens.length;
            
            const deltaL = Math.abs(correctLen - avgDistractor) / avgDistractor * 100;

            if (deltaL >= 5) {
                badQuestions.push(idx);
            }
        });

        if (badQuestions.length > 0) {
            console.log(`Phát hiện ${badQuestions.length} câu có độ dài đáp án lộ liễu (Delta L > 5%). Đang nhờ GPT-5 sửa...`);
            
            const fixPrompt = `
            Các câu hỏi sau có đáp án đúng quá dài hoặc quá ngắn so với các câu sai (lộ liễu). Hãy viết lại CÁC LỰA CHỌN sao cho độ dài đồng đều hơn ($\\Delta L < 5\%$). Giữ nguyên ý nghĩa.
            Ngôn ngữ: ${targetLang}.
            
            Danh sách cần sửa:
            ${JSON.stringify(badQuestions.map(i => questions[i]))}

            Trả về JSON hợp lệ dạng { "fixed_questions": [...] } với thứ tự tương ứng.
            KHÔNG dùng markdown (\\\`\\\`\\\`json). KHÔNG thêm lời dẫn.
            Đảm bảo chuỗi JSON không bị ngắt quãng bởi ký tự xuống dòng.
            `;
            
            const res = await callGeminiFlash(GEMINI_BLIND_KEY, fixPrompt);
            
            if (res && res.fixed_questions) {
                const fixed = normalizeQuestions(res.fixed_questions);
                fixed.forEach((fixedQ, i) => {
                    const originalIdx = badQuestions[i];
                    if (questions[originalIdx]) {
                        questions[originalIdx].options = fixedQ.options;
                        questions[originalIdx].answer = fixedQ.answer;
                    }
                });
            }
        }
        return questions;
    }

    async function step3_5_CheckHallucinations(questions, context, lang = 'vi') {
        if (!questions || !Array.isArray(questions)) return questions || [];

        console.log("Checking hallucinations with GPT-5 (Batched)...");
        const targetLang = lang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh (English)';
        
        // Process in batches to avoid token limits
        const BATCH_SIZE = 5;
        let checkedQuestions = [];
        
        for (let i = 0; i < questions.length; i += BATCH_SIZE) {
            const batch = questions.slice(i, i + BATCH_SIZE);
            console.log(`Checking batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(questions.length/BATCH_SIZE)}...`);
            
            const prompt = `
            Vai trò: Bạn là một Fact-Checker (Người kiểm duyệt sự thật) khó tính.
            Nhiệm vụ: Kiểm tra danh sách câu hỏi trắc nghiệm dưới đây dựa trên kiến thức chung và ngữ cảnh đã cung cấp.
            Ngôn ngữ kiểm tra: ${targetLang}.
            
            Ngữ cảnh:
            ${toSafeString(context.theory, 2000)}
            
            Danh sách câu hỏi cần kiểm tra:
            ${JSON.stringify(batch)}
            
            Yêu cầu:
            1. Xác định các câu hỏi sai kiến thức, sai đáp án, hoặc không có đáp án đúng.
            2. Nếu câu nào sai, hãy VIẾT LẠI hoàn toàn cho đúng (bằng ${targetLang}).
            3. Nếu câu nào đã đúng, giữ nguyên.
            
            Trả về JSON dạng:
            { "checked_questions": [ 
                {
                    "id": ...,
                    "question": "...",
                    "options": [...],
                    "answer": ...,
                    "bloom_level": "..." // Giữ nguyên hoặc cập nhật nếu cần
                }
            ] }
            KHÔNG dùng markdown. KHÔNG giải thích thêm.
            `;

            try {
                const res = await callGeminiFlash(GEMINI_BLIND_KEY, prompt);
                if (res.checked_questions && Array.isArray(res.checked_questions)) {
                    // Normalize batch results
                    const normalizedBatch = normalizeQuestions(res.checked_questions);
                    // Ensure we don't lose questions if AI returns fewer than sent
                    if (normalizedBatch.length === batch.length) {
                        checkedQuestions = checkedQuestions.concat(normalizedBatch);
                    } else {
                        console.warn(`Batch check returned mismatch count (${normalizedBatch.length} vs ${batch.length}). Keeping original batch.`);
                        checkedQuestions = checkedQuestions.concat(batch);
                    }
                } else {
                    console.warn("Invalid batch check response. Keeping original batch.");
                    checkedQuestions = checkedQuestions.concat(batch);
                }
            } catch (e) {
                console.warn("Batch hallucination check failed:", e);
                checkedQuestions = checkedQuestions.concat(batch);
            }
        }
        
        console.log("Gemini check completed.");
        return checkedQuestions;
    }

    async function step4_BlindTest(questions, lang = 'vi') {
        if (!questions || !Array.isArray(questions)) return questions || [];

        // Blind Test: Use Gemini 2.5 Flash (Second Key)
        console.log("Bắt đầu Blind Test (Gemini 2.5 Flash)...");
        const targetLang = lang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh (English)';
        
        for (let attempt = 0; attempt < 1; attempt++) {
            const testIndices = questions.map((_, i) => i); 
            const testPayload = testIndices.map(i => ({
                id: i,
                options: questions[i].options
            }));

            const prompt = `
            Bạn là một học sinh thông minh đang làm bài trắc nghiệm mẹo.
            Tôi sẽ đưa cho bạn danh sách các lựa chọn (bỏ qua câu hỏi). Hãy cố gắng đoán đáp án đúng chỉ dựa vào logic ngôn ngữ, độ dài, hoặc sự khác biệt.
            
            Input: ${JSON.stringify(testPayload)}
            
            Trả về JSON: { "guesses": [ { "id": 0, "guessed_index": 1 }, ... ] }
            `;

            // Switched from Grok 3 to Gemini 2.5 Flash (using GEMINI_BLIND_KEY)
            const res = await callGeminiFlash(GEMINI_BLIND_KEY, prompt);
            
            let leakedQuestions = [];
            if (res && Array.isArray(res.guesses)) {
                res.guesses.forEach(g => {
                    const q = questions[g.id];
                    if (q && g.guessed_index === q.answer) {
                        leakedQuestions.push(g.id);
                    }
                });
            }

            const correctRate = leakedQuestions.length / testIndices.length;
            console.log(`Lần ${attempt+1}: AI đoán đúng ${Math.round(correctRate*100)}% (${leakedQuestions.length}/${testIndices.length})`);

            if (correctRate <= 0.35) {
                console.log("Tỷ lệ đạt chuẩn (<= 35%).");
                break;
            }

            console.log("Tỷ lệ > 35%. Đang nhờ Gemini (Blind Key) sửa các câu bị lộ...");
            
            const questionsToFix = leakedQuestions.map(id => questions[id]);
            
            const fixPrompt = `
            Các câu hỏi sau có các phương án lựa chọn bị "lộ" (GPT đoán trúng mà không cần đọc câu hỏi).
            Danh sách cần sửa: ${JSON.stringify(questionsToFix)}
            
            Hãy VIẾT LẠI CÁC LỰA CHỌN (Options) sao cho:
            1. Các lựa chọn sai (distractors) có cấu trúc/độ dài tương đồng với đáp án đúng.
            2. Giữ nguyên ý nghĩa của đáp án đúng.
            3. Ngôn ngữ: ${targetLang}.
            
            Trả về JSON: { "fixed_questions": [ { "id": ... , "options": [...] }, ... ] }
            KHÔNG dùng markdown.
            `;

            const fixRes = await callGeminiFlash(GEMINI_BLIND_KEY, fixPrompt);
            
            if (fixRes && fixRes.fixed_questions) {
                const fixed = normalizeQuestions(fixRes.fixed_questions);
                fixed.forEach((fixedQ) => {
                    const idx = questions.findIndex(q => q.id === fixedQ.id);
                    if (idx !== -1) {
                        questions[idx].options = fixedQ.options;
                    }
                });
            }
        }
        
        return questions;
    }

    async function step5_GenerateExplanations(questions, context, lang = 'vi') {
        if (!questions || !Array.isArray(questions)) return questions || [];

        const targetLang = lang === 'vi' ? 'Tiếng Việt' : 'Tiếng Anh (English)';

        // Chia batch để tránh quá tải token
        const batchSize = 5;
        for (let i = 0; i < questions.length; i += batchSize) {
            const batch = questions.slice(i, i + batchSize);
            
            const prompt = `
            Dựa vào kiến thức: ${toSafeString(context.theory, 2000)}...

            Hãy viết lời giải thích NGẮN GỌN (tối đa 2-3 câu) cho các câu hỏi sau (bằng ${targetLang}):
            ${JSON.stringify(batch)}

            Yêu cầu giải thích:
            1. Tại sao đáp án đúng là đúng? (Ngắn gọn)
            2. Tại sao các phương án nhiễu là sai? (Chỉ nêu lý do chính)
            
            Trả về JSON dạng: { "explanations": [ { "id": 0, "text": "Lời giải thích..." } ] }
            `;

            try {
                const res = await callGeminiFlash(GEMINI_FLASH_KEY, prompt);
                
                if (res.explanations) {
                    res.explanations.forEach((exp) => {
                        const idx = questions.findIndex(q => q.id === exp.id);
                        if (idx !== -1) questions[idx].explanation = exp.text;
                    });
                }
            } catch (e) {
                console.warn("Explanation gen failed for batch:", e);
            }
        }
        
        return questions;
    }

    // --- Helper Functions ---

    function normalizeQuestions(questions) {
        if (!questions || !Array.isArray(questions)) return [];
        questions.forEach(q => {
            // Fix options prefixes (A., B., 1., -)
            if (q.options && Array.isArray(q.options)) {
                q.options = q.options.map(opt => opt.replace(/^[A-D]\.\s*|^[0-9]+\.\s*|^-\s*/i, ''));
            }

            // Fix answer format (String to Number, 1-based to 0-based, Letter to Index)
            if (typeof q.answer === 'string') {
                const ans = q.answer.trim().toUpperCase();
                if (['A', 'B', 'C', 'D'].includes(ans)) {
                    q.answer = ans.charCodeAt(0) - 65;
                } else {
                    q.answer = parseInt(ans);
                }
            }

            // Ensure answer is valid integer 0-3
            if (isNaN(q.answer) || q.answer < 0 || q.answer > 3) {
                // Try to infer from options if answer is the text itself (rare but possible)
                // Search for exact match or substring match
                const rawAns = String(q.answer || "").toLowerCase().trim();
                // Clean prefixes from raw answer just in case (e.g. "A. Option Content")
                const cleanRawAns = rawAns.replace(/^[a-d]\.\s*|^[0-9]+\.\s*|^-\s*/, '');
                
                const foundIdx = q.options.findIndex(opt => {
                    const optText = opt.toLowerCase().trim();
                    return optText === rawAns || optText === cleanRawAns || 
                           optText.includes(cleanRawAns) || cleanRawAns.includes(optText);
                });

                if (foundIdx !== -1) {
                    console.log(`Recovered answer index for ID ${q.id || '?'}: ${foundIdx} (Matched "${q.answer}")`);
                    q.answer = foundIdx;
                } else {
                    console.warn("Invalid answer index detected, defaulting to 0:", q);
                    q.answer = 0;
                }
            }
        });
        return questions;
    }

    function showLoading(show) {
        if (show) {
            loadingDiv.classList.remove('hidden');
            document.querySelectorAll('.step').forEach(s => {
                s.classList.remove('active', 'completed');
            });
        } else {
            loadingDiv.classList.add('hidden');
        }
    }

    function updateProgress(stepNum, text) {
        document.getElementById('loading-text').textContent = text;
        const steps = document.querySelectorAll('.step');
        steps.forEach((s, i) => {
            if (i < stepNum - 1) {
                s.classList.add('completed');
                s.classList.remove('active');
            } else if (i === stepNum - 1) {
                s.classList.add('active');
            }
        });
    }

    function toSafeString(val, maxLen = 200000) {
        let str = '';
        if (typeof val === 'string') str = val;
        else if (val === undefined || val === null) str = '';
        else str = JSON.stringify(val);
        if (str.length > maxLen) return str.slice(0, maxLen);
        return str;
    }
 
    function renderQuiz(questions) {
        const lang = document.getElementById('output-language').value;
        const labels = lang === 'vi' 
            ? { q: 'Câu', exp: 'Giải thích', noExp: 'Chưa có giải thích.', bloom: 'Độ khó (Bloom)' }
            : { q: 'Question', exp: 'Explanation', noExp: 'No explanation available.', bloom: 'Bloom Level' };

        questions.forEach((q, index) => {
            const card = document.createElement('div');
            card.className = 'question-card';
            card.id = `q-card-${index}`;
            
            card.innerHTML = `
                <div class="question-text">${labels.q} ${index + 1}: ${q.question}</div>
                <div class="options-grid">
                    ${q.options.map((opt, i) => `
                        <label class="option-label" data-idx="${i}">
                            <input type="radio" name="q${index}" value="${i}">
                            ${String.fromCharCode(65 + i)}. ${opt}
                        </label>
                    `).join('')}
                </div>
                <div class="explanation-box hidden">
                    <p><strong>${labels.bloom}:</strong> ${q.bloom_level || 'N/A'}</p>
                    <strong>${labels.exp}:</strong><br>
                    ${q.explanation ? q.explanation.replace(/\n/g, '<br>') : labels.noExp}
                </div>
            `;
            quizContainer.appendChild(card);
        });
    }

    // PDF Reading
    async function readFileContent(file) {
        if (file.type === 'application/pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + '\n';
            }
            return fullText;
        } else {
            return await file.text();
        }
    }

    // Export PDF (Text-based with Vietnamese support)
    async function exportToPDF(withExplanation) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Helper to load font
        const addFont = async () => {
            try {
                // Fetch Roboto-Regular from CDN
                const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.1.66/fonts/Roboto/Roboto-Regular.ttf');
                if (!response.ok) throw new Error('Network response was not ok');
                const buffer = await response.arrayBuffer();
                
                // Convert to base64
                let binary = '';
                const bytes = new Uint8Array(buffer);
                const len = bytes.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64 = window.btoa(binary);
                
                doc.addFileToVFS('Roboto-Regular.ttf', base64);
                doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
                doc.setFont('Roboto');
                console.log("Font loaded successfully");
                return true;
            } catch (e) {
                console.warn('Could not load custom font, Vietnamese characters might be broken.', e);
                return false;
            }
        };

        showLoading(true);
        updateProgress(6, 'Đang tải font và tạo file PDF...');
        
        await addFont();
        
        const lang = document.getElementById('output-language').value;
        const labels = lang === 'vi'
            ? { title: "KẾT QUẢ TRẮC NGHIỆM", q: "Câu", exp: "Giải thích", correct: "(ĐÚNG)", bloom: "Độ khó (Bloom)" }
            : { title: "QUIZ RESULTS", q: "Question", exp: "Explanation", correct: "(CORRECT)", bloom: "Bloom Level" };

        // Setup document
        doc.setFontSize(18);
        doc.text(labels.title, 105, 20, { align: 'center' });
        
        // Prepare data for autoTable
        const tableBody = [];
        
        currentQuizData.forEach((q, idx) => {
            // Question
            tableBody.push([{ 
                content: `${labels.q} ${idx + 1}: ${q.question}`, 
                styles: { fontStyle: 'bold', fillColor: [245, 245, 245], textColor: [0, 0, 0] } 
            }]);
            
            // Options
            const optionsText = q.options.map((opt, i) => {
                const prefix = String.fromCharCode(65 + i);
                const isCorrect = i === q.answer;
                // Add marker for correct answer if user wants results
                // Since this is "Export Result", we should indicate the correct answer.
                return `${prefix}. ${opt} ${isCorrect ? labels.correct : ''}`;
            }).join('\n');
            
            tableBody.push([{ content: optionsText, styles: { cellPadding: {top: 2, bottom: 2, left: 5} } }]);
            
            // Explanation & Bloom Level
            if (withExplanation) {
                let contentText = "";
                if (q.bloom_level) {
                    contentText += `[${labels.bloom}: ${q.bloom_level}]\n`;
                }
                if (q.explanation) {
                    contentText += `${labels.exp}: ${q.explanation}`;
                } else {
                    contentText += `${labels.exp}: ${labels.noExp}`;
                }

                tableBody.push([{ 
                    content: contentText, 
                    styles: { fontStyle: 'italic', textColor: [80, 80, 80], fontSize: 10 } 
                }]);
            }
            
            // Spacer
            tableBody.push([{ content: '', styles: { minCellHeight: 2, fillColor: [255, 255, 255] } }]);
        });

        doc.autoTable({
            startY: 30,
            body: tableBody,
            styles: { 
                font: 'Roboto', // Use the added font
                fontSize: 11, 
                cellPadding: 4, 
                overflow: 'linebreak',
                valign: 'middle'
            },
            columnStyles: { 0: { cellWidth: 'auto' } },
            theme: 'plain',
            head: [],
            margin: { top: 30, bottom: 20, left: 20, right: 20 }
        });

        doc.save("trac-nghiem.pdf");
        showLoading(false);
    }
});

