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
let mapsLoaded = false;

async function initializeMap() {
    try {
        const response = await fetch(`${API_URL}/maps-key`);
        const data = await response.json();
        
        if (!data.key || !data.available) {
            console.warn('Google Maps API key not available');
            document.getElementById('map').innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">Google Maps not configured</div>';
            return;
        }
        
        if (!mapsLoaded) {
            await loadGoogleMapsScript(data.key);
            mapsLoaded = true;
        }
        
        map = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 37.5665, lng: 126.9780 },
            zoom: 12,
            language: 'en',
            region: 'US'
        });
        
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            polylineOptions: {
                strokeColor: '#1a237e',
                strokeWeight: 4
            }
        });
        
        console.log('Google Maps initialized successfully');
    } catch (error) {
        console.error('Error initializing map:', error);
        document.getElementById('map').innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999;">Failed to load map</div>';
    }
}

function loadGoogleMapsScript(apiKey) {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.maps) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
            console.log('Google Maps script loaded');
            resolve();
        };
        
        script.onerror = () => {
            console.error('Failed to load Google Maps script');
            reject(new Error('Failed to load Google Maps'));
        };
        
        document.head.appendChild(script);
    });
}

initializeMap();

let currentTripData = null;
let currentSelectedDay = 'all';
let packingListData = {};

document.getElementById('tripForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const city = document.getElementById('city').value;
    const mustVisit = document.getElementById('mustVisit').value.trim();
    const additionalRequests = document.getElementById('additionalRequests').value.trim();
    const accommodationAddress = document.getElementById('accommodationAddress').value.trim();
    
    const activities = Array.from(document.querySelectorAll('.checkbox-item input[name="activities"]:checked'))
        .map(cb => cb.value);
    
    const meals = Array.from(document.querySelectorAll('.checkbox-item input[name="meals"]:checked'))
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
            body: JSON.stringify({ 
                city, 
                days, 
                activities, 
                mustVisit, 
                additionalRequests,
                meals,
                accommodationAddress,
            })
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
            additionalRequests,
            meals,
            accommodationAddress,
            tripPlan: data.tripPlan,
            packingList: data.packingList
        };
        
        displayTripPlan(data.tripPlan);
        displayPackingList(data.packingList);
        
        if (data.tripPlan.locations && data.tripPlan.locations.length > 0) {
            displayRoute(city, data.tripPlan.locations, 'all');
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
            alert('✅ Trip saved successfully to My Trips!');
            saveTripBtn.textContent = '✓ Saved';
            setTimeout(() => {
                saveTripBtn.textContent = '💾 Save Trip to My Trips';
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
    if (!tripPlan.days || tripPlan.days.length === 0) {
        document.getElementById('tripPlanContent').innerHTML = '<div class="empty-state"><p>No itinerary available</p></div>';
        return;
    }
    
    const dayTabs = document.querySelector('#mapCard .day-tabs');
    dayTabs.style.display = 'flex';
    dayTabs.innerHTML = `
        <button class="day-tab active" data-day="all">All Days</button>
        ${tripPlan.days.map(day => `
            <button class="day-tab" data-day="${day.day}">Day ${day.day}</button>
        `).join('')}
    `;
    
    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const selectedDay = tab.dataset.day;
            currentSelectedDay = selectedDay;
            filterTripByDay(selectedDay);
        });
    });
    
    let html = '';
    tripPlan.days.forEach(day => {
        html += createDayHTML(day);
    });
    
    document.getElementById('tripPlanContent').innerHTML = html;
}

function createDayHTML(day) {
    let html = `<div class="trip-plan-day" data-day="${day.day}">
        <div class="day-header">
            <h4>Day ${day.day}: ${day.title}</h4>
        </div>
        <div class="activities-list">`;
    
    if (day.activities && day.activities.length > 0) {
        day.activities.forEach(activity => {
            html += `
                <div class="activity-item">
                    <div class="activity-time">
                        <span class="time-badge">${activity.time}</span>
                    </div>
                    <div class="activity-details">
                        <h5 class="activity-location">${activity.location}</h5>
                        <p class="activity-description">${activity.description}</p>
                    </div>
                </div>`;
        });
    }
    
    html += `</div></div>`;
    return html;
}

function getMealIcon(time, description) {
    const descStr = description.toLowerCase();
    
    if (descStr.includes('breakfast at') || descStr.includes('enjoy breakfast') || 
        descStr.includes('have breakfast') || descStr.includes('grab breakfast')) {
        return '🍳';
    }
    
    if (descStr.includes('lunch at') || descStr.includes('enjoy lunch') || 
        descStr.includes('have lunch') || descStr.includes('grab lunch')) {
        return '🍽️';
    }
    
    if (descStr.includes('dinner at') || descStr.includes('enjoy dinner') || 
        descStr.includes('have dinner') || descStr.includes('dine at') ||
        descStr.includes('grab dinner')) {
        return '🍴';
    }
    
    if (descStr.includes('eat') || descStr.includes('meal')) {
        const timeStr = time.toLowerCase();
        const hour = parseInt(time.match(/\d+/)?.[0] || 0);
        const isPM = timeStr.includes('pm');
        const actualHour = isPM && hour !== 12 ? hour + 12 : (!isPM && hour === 12 ? 0 : hour);
        
        if (actualHour >= 7 && actualHour <= 10) {
            return '🍳';
        } else if (actualHour >= 12 && actualHour <= 14) {
            return '🍽️';
        } else if (actualHour >= 18 && actualHour <= 21) {
            return '🍴';
        }
    }
    
    return null;
}

function filterTripByDay(selectedDay) {
    const allDays = document.querySelectorAll('.trip-plan-day');
    
    if (selectedDay === 'all') {
        allDays.forEach(day => day.style.display = 'block');
        document.getElementById('mapDayInfo').textContent = 'Showing all locations';
        
        if (currentTripData && currentTripData.tripPlan.locations) {
            displayRoute(currentTripData.city, currentTripData.tripPlan.locations, 'all');
        }
    } else {
        allDays.forEach(day => {
            if (day.dataset.day === selectedDay) {
                day.style.display = 'block';
            } else {
                day.style.display = 'none';
            }
        });
        
        document.getElementById('mapDayInfo').textContent = `Showing Day ${selectedDay} route`;
        
        const dayData = currentTripData.tripPlan.days.find(d => d.day === parseInt(selectedDay));
        if (dayData && dayData.activities) {
            const dayLocations = dayData.activities.map(a => a.location);
            displayRoute(currentTripData.city, dayLocations, selectedDay);
        }
    }
}

function displayPackingList(packingList) {
    if (!packingList.categories || packingList.categories.length === 0) {
        document.getElementById('packingContent').innerHTML = '<div class="empty-state"><p>No packing list available</p></div>';
        return;
    }
    
    packingListData = {};
    packingList.categories.forEach(category => {
        packingListData[category.name] = category.items || [];
    });
    
    let html = '';
    
    packingList.categories.forEach(category => {
        html += `
            <div class="packing-category" data-category="${category.name}">
                <div class="category-header">
                    <h4>${category.name}</h4>
                    <button class="btn-add-item" onclick="addPackingItem('${category.name}')">+ Add Item</button>
                </div>
                <div class="packing-list" id="packing-${category.name.replace(/\s+/g, '-')}">`;
        
        if (category.items && category.items.length > 0) {
            category.items.forEach((item, index) => {
                html += createPackingItemHTML(category.name, item, index);
            });
        }
        
        html += `</div></div>`;
    });
    
    document.getElementById('packingContent').innerHTML = html;
}

function createPackingItemHTML(categoryName, item, index) {
    const uniqueId = `pack_${categoryName.replace(/\s+/g, '_')}_${index}`;
    return `
        <div class="packing-item">
            <input type="checkbox" id="${uniqueId}">
            <label for="${uniqueId}">${item}</label>
            <button class="btn-remove-item" onclick="removePackingItem('${categoryName}', ${index})">×</button>
        </div>`;
}

function addPackingItem(categoryName) {
    const itemName = prompt(`Add new item to ${categoryName}:`);
    if (!itemName || !itemName.trim()) return;
    
    packingListData[categoryName].push(itemName.trim());
    
    const categoryId = `packing-${categoryName.replace(/\s+/g, '-')}`;
    const container = document.getElementById(categoryId);
    
    const index = packingListData[categoryName].length - 1;
    const newItemHTML = createPackingItemHTML(categoryName, itemName.trim(), index);
    container.insertAdjacentHTML('beforeend', newItemHTML);
}

function removePackingItem(categoryName, index) {
    if (!confirm('Remove this item?')) return;
    
    packingListData[categoryName].splice(index, 1);
    
    const categoryId = `packing-${categoryName.replace(/\s+/g, '-')}`;
    const container = document.getElementById(categoryId);
    
    let html = '';
    packingListData[categoryName].forEach((item, idx) => {
        html += createPackingItemHTML(categoryName, item, idx);
    });
    
    container.innerHTML = html;
}

function displayRoute(city, locations, dayFilter) {
    if (!map || !directionsService || !directionsRenderer) {
        console.log('Google Maps not initialized');
        return;
    }

    if (!locations || locations.length < 2) {
        console.log('Not enough locations for route');
        if (locations && locations.length === 1) {
            showSingleMarker(city, locations[0]);
        }
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
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
        region: 'US',
        language: 'en'
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            console.error('Directions request failed:', status);
            showMarkersOnly(city, locations);
        }
    });
}

function showSingleMarker(city, location) {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: `${location}, ${city}` }, (results, status) => {
        if (status === 'OK' && results[0]) {
            map.setCenter(results[0].geometry.location);
            map.setZoom(15);
            new google.maps.Marker({
                map: map,
                position: results[0].geometry.location,
                title: location
            });
        }
    });
}

function showMarkersOnly(city, locations) {
    const geocoder = new google.maps.Geocoder();
    const bounds = new google.maps.LatLngBounds();
    
    locations.forEach((location, index) => {
        geocoder.geocode({ address: `${location}, ${city}` }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const marker = new google.maps.Marker({
                    map: map,
                    position: results[0].geometry.location,
                    label: (index + 1).toString(),
                    title: location
                });
                bounds.extend(results[0].geometry.location);
                map.fitBounds(bounds);
            }
        });
    });
}