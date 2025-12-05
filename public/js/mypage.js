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

loadSavedTrips();

async function loadSavedTrips() {
    try {
        const response = await fetch(`${API_URL}/trips`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displaySavedTrips(data.trips);
        }
    } catch (error) {
        console.error('Error loading trips:', error);
    }
}

function displaySavedTrips(trips) {
    const container = document.getElementById('savedTripsContainer');
    
    if (!trips || trips.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"></path>
                </svg>
                <p>No saved trips yet. Start planning your first adventure!</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="trips-grid">';
    
    trips.forEach(trip => {
        const date = new Date(trip.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        const activitiesText = trip.activities.join(', ');
        
        html += `
            <div class="trip-card">
                <div class="trip-card-header">
                    <h3>${trip.city}</h3>
                    <button class="btn-delete" onclick="deleteTrip('${trip._id}')">🗑️</button>
                </div>
                <div class="trip-card-body">
                    <p><strong>Duration:</strong> ${trip.days} days</p>
                    <p><strong>Activities:</strong> ${activitiesText}</p>
                    ${trip.mustVisit ? `<p><strong>Must Visit:</strong> ${trip.mustVisit}</p>` : ''}
                    <p><strong>Created:</strong> ${date}</p>
                </div>
                <button class="btn-view" onclick="viewTrip('${trip._id}')">View Details</button>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function deleteTrip(tripId) {
    if (!confirm('Are you sure you want to delete this trip?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/trips/${tripId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            alert('Trip deleted successfully');
            loadSavedTrips();
        } else {
            alert('Failed to delete trip');
        }
    } catch (error) {
        console.error('Delete error:', error);
        alert('Failed to delete trip');
    }
}

async function viewTrip(tripId) {
    try {
        const response = await fetch(`${API_URL}/trips/${tripId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            
            localStorage.setItem('viewingTrip', JSON.stringify(data.trip));
            
            window.location.href = `home.html?view=${tripId}`;
        }
    } catch (error) {
        console.error('View error:', error);
        alert('Failed to load trip details');
    }
}