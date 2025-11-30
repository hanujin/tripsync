const API_URL = 'http://localhost:3000/api';

const loginPage = document.getElementById('loginPage');
const signupPage = document.getElementById('signupPage');
const mainApp = document.getElementById('mainApp');

const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const tripForm = document.getElementById('tripForm');

const showSignup = document.getElementById('showSignup');
const showLogin = document.getElementById('showLogin');
const logoutBtn = document.getElementById('logoutBtn');
const dateTypeBtns = document.querySelectorAll('.date-type-btn');

let currentUser = null;
let authToken = localStorage.getItem('authToken');
let map = null;
let directionsService = null;
let directionsRenderer = null;

if (authToken) {
    verifyTokenAndShowApp();
}

async function verifyTokenAndShowApp() {
    try {
        const response = await fetch(`${API_URL}/trips`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const userData = JSON.parse(localStorage.getItem('currentUser'));
            if (userData) {
                currentUser = userData;
                showMainApp();
            }
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            authToken = null;
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        authToken = null;
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            alert('Sign up successful!');
            signupPage.style.display = 'none';
            signupForm.reset();
            showMainApp();
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            loginForm.reset();
            showMainApp();
        } else {
            alert(data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
});

logoutBtn.addEventListener('click', () => {
    currentUser = null;
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    mainApp.style.display = 'none';
    loginPage.style.display = 'flex';
    loginForm.reset();
});

async function showMainApp() {
    loginPage.style.display = 'none';
    signupPage.style.display = 'none';
    mainApp.style.display = 'block';
    document.getElementById('userName').textContent = currentUser.name;
    await initializeMap();
    loadPreviousTrips();
}

dateTypeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        dateTypeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const type = btn.dataset.type;
        document.getElementById('calendarInputs').classList.remove('active');
        document.getElementById('durationInputs').classList.remove('active');
        
        if (type === 'calendar') {
            document.getElementById('calendarInputs').classList.add('active');
        } else {
            document.getElementById('durationInputs').classList.add('active');
        }
    });
});

async function initializeMap() {
    try {
        const response = await fetch(`${API_URL}/maps-key`);
        const data = await response.json();
        
        if (typeof google !== 'undefined') {
            const mapContainer = document.querySelector('.map-container');
            mapContainer.innerHTML = '<div id="map" style="width: 100%; height: 100%; border-radius: 12px;"></div>';
            
            map = new google.maps.Map(document.getElementById('map'), {
                center: { lat: 37.5665, lng: 126.9780 },
                zoom: 12
            });
            
            directionsService = new google.maps.DirectionsService();
            directionsRenderer = new google.maps.DirectionsRenderer({
                map: map,
                polylineOptions: {
                    strokeColor: '#1a237e',
                    strokeWeight: 4
                }
            });
        }
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

async function loadPreviousTrips() {
    try {
        const response = await fetch(`${API_URL}/trips`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Previous trips:', data.trips);
        }
    } catch (error) {
        console.error('Error loading trips:', error);
    }
}

tripForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const city = document.getElementById('city').value;
    const activities = Array.from(document.querySelectorAll('.checkbox-item input:checked'))
        .map(cb => cb.value);
    
    let days = 3;
    
    if (document.getElementById('calendarInputs').classList.contains('active')) {
        const start = new Date(document.getElementById('startDate').value);
        const end = new Date(document.getElementById('endDate').value);
        days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    } else {
        const duration = document.getElementById('duration').value;
        if (!duration) {
            alert('Please enter trip duration.');
            return;
        }
        days = parseInt(duration);
    }

    if (activities.length === 0) {
        alert('Please select at least one activity.');
        return;
    }

    document.getElementById('tripPlanContent').innerHTML = '<div class="loading">Generating your trip plan</div>';
    document.getElementById('packingContent').innerHTML = '<div class="loading">Creating packing list</div>';
    
    try {
        const response = await fetch(`${API_URL}/generate-trip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ city, days, activities })
        });

        if (!response.ok) {
            throw new Error('Failed to generate trip');
        }

        const data = await response.json();
        
        displayTripPlan(data.tripPlan);
        displayPackingList(data.packingList);
        
        if (data.tripPlan.locations && data.tripPlan.locations.length > 0) {
            displayRoute(city, data.tripPlan.locations);
        }
        
        alert('Trip saved to your account!');
    } catch (error) {
        console.error('Error:', error);
        alert('Error: ' + error.message);
    }
});

function displayTripPlan(tripPlan) {
    let html = '';
    
    if (tripPlan.days) {
        tripPlan.days.forEach(day => {
            html += `<div class="trip-plan-item">
                <h4>Day ${day.day}: ${day.title}</h4>`;
            
            if (day.activities) {
                day.activities.forEach(activity => {
                    html += `<p><strong>${activity.time}</strong> - ${activity.location}<br>
                             ${activity.description}</p>`;
                });
            }
            
            html += `</div>`;
        });
    }
    
    document.getElementById('tripPlanContent').innerHTML = html;
}

function displayPackingList(packingList) {
    let html = '';
    
    if (packingList.categories) {
        packingList.categories.forEach(category => {
            html += `<div style="margin-bottom: 20px;">
                <h4 style="color: #1a237e; margin-bottom: 12px;">${category.name}</h4>
                <div class="packing-list">`;
            
            category.items.forEach((item, index) => {
                html += `<div class="packing-item">
                    <input type="checkbox" id="pack_${category.name}_${index}">
                    <label for="pack_${category.name}_${index}">${item}</label>
                </div>`;
            });
            
            html += `</div></div>`;
        });
    }
    
    document.getElementById('packingContent').innerHTML = html;
}

function displayRoute(city, locations) {
    if (!map || !directionsService || !directionsRenderer) {
        console.log('Google Maps not initialized');
        return;
    }

    if (locations.length < 2) return;

    const waypoints = locations.slice(1, -1).map(location => ({
        location: `${location}, ${city}`,
        stopover: true
    }));

    const request = {
        origin: `${locations[0]}, ${city}`,
        destination: `${locations[locations.length - 1]}, ${city}`,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.WALKING,
        optimizeWaypoints: true
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            console.error('Directions request failed:', status);
        }
    });
}

const today = new Date().toISOString().split('T')[0];
document.getElementById('startDate').min = today;
document.getElementById('endDate').min = today;

document.getElementById('startDate').addEventListener('change', (e) => {
    document.getElementById('endDate').min = e.target.value;
});