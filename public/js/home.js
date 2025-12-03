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

const dateTypeBtns = document.querySelectorAll('.date-type-btn');
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

const today = new Date().toISOString().split('T')[0];
document.getElementById('startDate').min = today;
document.getElementById('endDate').min = today;

document.getElementById('startDate').addEventListener('change', (e) => {
    document.getElementById('endDate').min = e.target.value;
});

const urlParams = new URLSearchParams(window.location.search);
const prefilledCity = urlParams.get('city');
if (prefilledCity) {
    document.getElementById('city').value = prefilledCity;
}

const viewingTripId = urlParams.get('view');
if (viewingTripId) {
    const viewingTrip = JSON.parse(localStorage.getItem('viewingTrip'));
    if (viewingTrip) {
        displayTripPlan(viewingTrip.tripPlan);
        displayPackingList(viewingTrip.packingList);
        
        if (viewingTrip.tripPlan.locations && viewingTrip.tripPlan.locations.length > 0) {
            setTimeout(() => {
                displayRoute(viewingTrip.city, viewingTrip.tripPlan.locations);
            }, 500);
        }
        
        document.getElementById('saveTripSection').style.display = 'none';
        
        setTimeout(() => {
            document.querySelector('.results-section').scrollIntoView({ behavior: 'smooth' });
        }, 100);
        
        localStorage.removeItem('viewingTrip');
    }
}

let map = null;
let directionsService = null;
let directionsRenderer = null;

async function initializeMap() {
    try {
        const response = await fetch(`${API_URL}/maps-key`);
        const data = await response.json();
        
        if (typeof google !== 'undefined') {
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

initializeMap();

let currentTripData = null;

document.getElementById('tripForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const city = document.getElementById('city').value;
    const mustVisit = document.getElementById('mustVisit').value.trim();
    const activities = Array.from(document.querySelectorAll('.checkbox-item input:checked'))
        .map(cb => cb.value);
    
    let days = 3;
    
    if (document.getElementById('calendarInputs').classList.contains('active')) {
        const start = new Date(document.getElementById('startDate').value);
        const end = new Date(document.getElementById('endDate').value);
        
        if (!document.getElementById('startDate').value || !document.getElementById('endDate').value) {
            alert('Please select start and end dates.');
            return;
        }
        
        days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        
        if (days <= 0) {
            alert('End date must be after start date.');
            return;
        }
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

    document.getElementById('tripPlanContent').innerHTML = '<div class="loading">🤖 AI is generating your personalized trip plan</div>';
    document.getElementById('packingContent').innerHTML = '<div class="loading">📦 Creating your packing list</div>';
    document.getElementById('saveTripSection').style.display = 'none';
    
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';
    
    try {
        const response = await fetch(`${API_URL}/generate-trip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ city, days, activities, mustVisit })
        });

        if (!response.ok) {
            throw new Error('Failed to generate trip');
        }

        const data = await response.json();
        
        currentTripData = {
            city,
            days,
            activities,
            mustVisit,
            tripPlan: data.tripPlan,
            packingList: data.packingList
        };
        
        displayTripPlan(data.tripPlan);
        displayPackingList(data.packingList);
        
        if (data.tripPlan.locations && data.tripPlan.locations.length > 0) {
            displayRoute(city, data.tripPlan.locations);
        }
        
        document.getElementById('saveTripSection').style.display = 'block';
        document.querySelector('.results-section').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error:', error);
        alert('Error generating trip plan. Please try again.');
        document.getElementById('tripPlanContent').innerHTML = '<div class="empty-state"><p>Failed to generate trip plan</p></div>';
        document.getElementById('packingContent').innerHTML = '<div class="empty-state"><p>Failed to generate packing list</p></div>';
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = 'Generate Trip Plan';
    }
});

document.getElementById('saveTripBtn').addEventListener('click', async () => {
    if (!currentTripData) {
        alert('No trip data to save');
        return;
    }
    
    const saveTripBtn = document.getElementById('saveTripBtn');
    saveTripBtn.disabled = true;
    saveTripBtn.textContent = '💾 Saving...';
    
    try {
        const response = await fetch(`${API_URL}/save-trip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(currentTripData)
        });

        const data = await response.json();

        if (response.ok) {
            alert('Trip saved successfully to My Trips!');
            saveTripBtn.textContent = '✓ Saved';
            setTimeout(() => {
                saveTripBtn.textContent = 'Save Trip to My Trips';
                saveTripBtn.disabled = false;
            }, 2000);
        } else {
            throw new Error(data.error || 'Failed to save trip');
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save trip. Please try again.');
        saveTripBtn.textContent = '💾 Save Trip to My Trips';
        saveTripBtn.disabled = false;
    }
});

function displayTripPlan(tripPlan) {
    let html = '';
    
    if (tripPlan.days && tripPlan.days.length > 0) {
        tripPlan.days.forEach(day => {
            html += `<div class="trip-plan-item">
                <h4>Day ${day.day}: ${day.title}</h4>`;
            
            if (day.activities && day.activities.length > 0) {
                day.activities.forEach(activity => {
                    html += `<p><strong>${activity.time}</strong> - ${activity.location}<br>
                             ${activity.description}</p>`;
                });
            }
            
            html += `</div>`;
        });
    } else {
        html = '<div class="empty-state"><p>No itinerary available</p></div>';
    }
    
    document.getElementById('tripPlanContent').innerHTML = html;
}

function displayPackingList(packingList) {
    let html = '';
    
    if (packingList.categories && packingList.categories.length > 0) {
        packingList.categories.forEach(category => {
            html += `<div style="margin-bottom: 20px;">
                <h4 style="color: #1a237e; margin-bottom: 12px;">${category.name}</h4>
                <div class="packing-list">`;
            
            if (category.items && category.items.length > 0) {
                category.items.forEach((item, index) => {
                    const uniqueId = `pack_${category.name.replace(/\s+/g, '_')}_${index}`;
                    html += `<div class="packing-item">
                        <input type="checkbox" id="${uniqueId}">
                        <label for="${uniqueId}">${item}</label>
                    </div>`;
                });
            }
            
            html += `</div></div>`;
        });
    } else {
        html = '<div class="empty-state"><p>No packing list available</p></div>';
    }
    
    document.getElementById('packingContent').innerHTML = html;
}

function displayRoute(city, locations) {
    if (!map || !directionsService || !directionsRenderer) {
        console.log('Google Maps not initialized');
        return;
    }

    if (!locations || locations.length < 2) {
        console.log('Not enough locations for route');
        return;
    }

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