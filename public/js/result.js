const API_URL = 
    window.location.hostname === 'localhost' 
        ? 'http://localhost:3000/api'
        : 'https://tripsync-backend-0m7u.onrender.com/api';

console.log("Using API URL:", API_URL);

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

const personalityResult = JSON.parse(localStorage.getItem('personalityResult'));

if (!personalityResult) {
    window.location.href = 'personality.html';
} else {
    displayResults(personalityResult);
}

function displayResults(personality) {
    document.getElementById('personalityBadge').textContent = personality.destinationType;
    document.getElementById('personalityName').textContent = personality.name;
    document.getElementById('personalityDescription').textContent = personality.description;
    
    const destinationsList = document.getElementById('destinationsList');
    destinationsList.innerHTML = personality.destinations.slice(0, 5).map(destination => {
        const city = destination.split(',')[0].trim();
        return `
            <div class="destination-card">
                <div class="destination-info">
                    <h4>${destination}</h4>
                </div>
                <a href="home.html?city=${encodeURIComponent(city)}" class="btn-plan-destination">
                    Plan Trip
                </a>
            </div>
        `;
    }).join('');
}