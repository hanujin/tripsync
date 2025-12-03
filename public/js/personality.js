const API_URL = 'http://localhost:3000/api';

const authToken = localStorage.getItem('authToken');
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

if (!authToken || !currentUser) {
    window.location.href = 'index.html';
}

document.getElementById('userName').textContent = currentUser.name;

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
});

let questions = [];
let currentQuestionIndex = 0;
let testAnswers = [];

async function loadQuestions() {
    try {
        const response = await fetch('../questions.json');
        questions = await response.json();
    } catch (error) {
        console.error('Error loading questions:', error);
        alert('Failed to load questions');
    }
}

async function loadPersonalityTypes() {
    try {
        const response = await fetch('../personality.json');
        return await response.json();
    } catch (error) {
        console.error('Error loading personality types:', error);
        return null;
    }
}

document.getElementById('startTestBtn').addEventListener('click', async () => {
    await loadQuestions();
    if (questions.length === 0) {
        alert('Failed to load test questions');
        return;
    }
    startTest();
});

function startTest() {
    currentQuestionIndex = 0;
    testAnswers = [];
    
    document.getElementById('testStartScreen').style.display = 'none';
    document.getElementById('testQuestionsScreen').style.display = 'block';
    
    showQuestion(currentQuestionIndex);
}

function showQuestion(index) {
    if (index >= questions.length) {
        finishTest();
        return;
    }
    
    const question = questions[index];
    const progress = ((index + 1) / questions.length) * 100;
    
    document.getElementById('progressFill').style.width = `${progress}%`;
    document.getElementById('progressText').textContent = `Question ${index + 1} of ${questions.length}`;
    
    const questionContainer = document.getElementById('questionContainer');
    questionContainer.innerHTML = `
        <div class="question-card">
            <h3 class="question-title">${question.question}</h3>
            <div class="options-container">
                ${question.options.map((option, i) => `
                    <button class="option-btn" data-score="${option.score}">
                        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="option-text">${option.text}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    questionContainer.querySelectorAll('.option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectAnswer(btn.dataset.score);
        });
    });
}

function selectAnswer(score) {
    testAnswers.push(score);
    currentQuestionIndex++;
    
    setTimeout(() => {
        showQuestion(currentQuestionIndex);
    }, 200);
}

async function finishTest() {
    const personalityTypes = await loadPersonalityTypes();
    if (!personalityTypes) {
        alert('Failed to load personality data');
        return;
    }
    
    const result = calculatePersonalityType(testAnswers);
    const personalityData = personalityTypes[result.destinationType];
    
    const userPersonality = {
        destinationType: result.destinationType,
        planningType: result.planningType,
        fullType: result.fullType,
        ...personalityData
    };
    
    localStorage.setItem('personalityResult', JSON.stringify(userPersonality));
    
    try {
        await fetch(`${API_URL}/personality`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(userPersonality)
        });
    } catch (error) {
        console.error('Error saving personality:', error);
    }
    
    window.location.href = 'result.html';
}

function calculatePersonalityType(answers) {
    const scores = { E: 0, I: 0, C: 0, F: 0, A: 0, N: 0, S: 0, P: 0 };
    
    answers.forEach(answer => {
        scores[answer]++;
    });
    
    const energyType = scores.E >= scores.I ? 'E' : 'I';
    const interestType = scores.C >= scores.F ? 'C' : 'F';
    const activityType = scores.A >= scores.N ? 'A' : 'N';
    const planningType = scores.S >= scores.P ? 'S' : 'P';
    
    const destinationType = energyType + interestType + activityType;
    const fullType = destinationType + planningType;
    
    return {
        destinationType,
        planningType,
        fullType,
        scores
    };
}