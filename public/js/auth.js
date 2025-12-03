const API_URL = 'http://localhost:3000/api';

const loginPage = document.getElementById('loginPage');
const signupPage = document.getElementById('signupPage');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');

const authToken = localStorage.getItem('authToken');
if (authToken) {
    verifyToken();
}

async function verifyToken() {
    try {
        const response = await fetch(`${API_URL}/trips`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            window.location.href = 'home.html';
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
        }
    } catch (error) {
        console.error('Token verification failed:', error);
    }
}

showSignup.addEventListener('click', () => {
    loginPage.style.display = 'none';
    signupPage.style.display = 'flex';
});

showLogin.addEventListener('click', () => {
    signupPage.style.display = 'none';
    loginPage.style.display = 'flex';
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    try {
        const response = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            
            alert('Sign up successful!');
            window.location.href = 'home.html';
        } else {
            alert(data.error || 'Sign up failed');
        }
    } catch (error) {
        console.error('Signup error:', error);
        alert('Sign up failed. Please try again.');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            
            window.location.href = 'home.html';
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
});