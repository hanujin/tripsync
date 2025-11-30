// server.js - Backend with MongoDB

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tripsync';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✓ MongoDB Connected'))
    .catch(err => console.error('✗ MongoDB Connection Error:', err));

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const tripSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    city: { type: String, required: true },
    days: { type: Number, required: true },
    activities: [String],
    tripPlan: {
        days: [{
            day: Number,
            title: String,
            activities: [{
                time: String,
                location: String,
                description: String
            }]
        }],
        locations: [String]
    },
    packingList: {
        categories: [{
            name: String,
            items: [String]
        }]
    },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Trip = mongoose.model('Trip', tripSchema);

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
};

app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const user = new User({
            name,
            email,
            password: hashedPassword
        });
        
        await user.save();
        
        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET);
        
        res.json({
            message: 'User created successfully',
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('[Signup] Error:', error);
        res.status(500).json({ error: 'Signup failed' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET);
        
        res.json({
            message: 'Login successful',
            token,
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('[Login] Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.post('/api/generate-trip', authenticateToken, async (req, res) => {
    try {
        const { city, days, activities } = req.body;
        console.log(`[Trip] User ${req.user.email} generating ${days}-day trip for ${city}`);
        
        const tripPlan = await generateTripPlan(city, days, activities);
        const packingList = await generatePackingList(city, activities, days);
        
        const trip = new Trip({
            userId: req.user.userId,
            city,
            days,
            activities,
            tripPlan,
            packingList
        });
        
        await trip.save();
        console.log('[Trip] Saved to database');
        
        res.json({
            tripId: trip._id,
            tripPlan,
            packingList
        });
    } catch (error) {
        console.error('[Trip] Error:', error);
        res.status(500).json({ error: 'Failed to generate trip' });
    }
});

app.get('/api/trips', authenticateToken, async (req, res) => {
    try {
        const trips = await Trip.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .select('-__v');
        
        res.json({ trips });
    } catch (error) {
        console.error('[Get Trips] Error:', error);
        res.status(500).json({ error: 'Failed to fetch trips' });
    }
});

app.get('/api/trips/:id', authenticateToken, async (req, res) => {
    try {
        const trip = await Trip.findOne({ 
            _id: req.params.id, 
            userId: req.user.userId 
        });
        
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        
        res.json({ trip });
    } catch (error) {
        console.error('[Get Trip] Error:', error);
        res.status(500).json({ error: 'Failed to fetch trip' });
    }
});

app.delete('/api/trips/:id', authenticateToken, async (req, res) => {
    try {
        const trip = await Trip.findOneAndDelete({ 
            _id: req.params.id, 
            userId: req.user.userId 
        });
        
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        
        res.json({ message: 'Trip deleted successfully' });
    } catch (error) {
        console.error('[Delete Trip] Error:', error);
        res.status(500).json({ error: 'Failed to delete trip' });
    }
});

app.get('/api/maps-key', (req, res) => {
    res.json({ 
        key: process.env.GOOGLE_MAPS_API_KEY || '',
        available: !!process.env.GOOGLE_MAPS_API_KEY
    });
});

async function generateTripPlan(city, days, activities) {
    const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
    
    if (!GOOGLE_AI_KEY) {
        console.warn('[Trip] Using fallback');
        return generateFallbackTrip(city, days, activities);
    }
    
    try {
        const prompt = `Create a detailed ${days}-day trip itinerary for ${city}. 

Traveler preferences: ${activities.join(', ')}

Provide day-by-day itinerary with specific locations, times, and descriptions.

Return ONLY valid JSON in this exact format:
{
    "days": [
        {
            "day": 1,
            "title": "Day title",
            "activities": [
                {
                    "time": "09:00 AM",
                    "location": "Location name",
                    "description": "What to do"
                }
            ]
        }
    ],
    "locations": ["Location 1", "Location 2", "Location 3"]
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
                })
            }
        );
        
        const data = await response.json();
        
        if (data.candidates?.[0]) {
            const content = data.candidates[0].content.parts[0].text;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        
        throw new Error('Invalid AI response');
    } catch (error) {
        console.error('[AI Trip] Error:', error.message);
        return generateFallbackTrip(city, days, activities);
    }
}

async function generatePackingList(city, activities, days) {
    const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
    
    if (!GOOGLE_AI_KEY) {
        console.warn('[Packing] Using fallback');
        return generateFallbackPacking(activities, days);
    }
    
    try {
        const prompt = `Create a packing list for a ${days}-day trip to ${city}.

Activities: ${activities.join(', ')}

Return ONLY valid JSON in this format:
{
    "categories": [
        {
            "name": "Category name",
            "items": ["item1", "item2"]
        }
    ]
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_AI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
                })
            }
        );
        
        const data = await response.json();
        
        if (data.candidates?.[0]) {
            const content = data.candidates[0].content.parts[0].text;
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        
        throw new Error('Invalid AI response');
    } catch (error) {
        console.error('[AI Packing] Error:', error.message);
        return generateFallbackPacking(activities, days);
    }
}

function generateFallbackTrip(city, days, activities) {
    const plans = [];
    for (let i = 1; i <= days; i++) {
        plans.push({
            day: i,
            title: i === 1 ? `Arrival in ${city}` : i === days ? `Departure` : `Exploring ${city}`,
            activities: [
                { time: '09:00 AM', location: `${city} Attraction`, description: `Enjoy ${activities[0] || 'sightseeing'}` },
                { time: '01:00 PM', location: 'Local Restaurant', description: 'Lunch' },
                { time: '03:00 PM', location: 'Cultural Site', description: 'Explore local culture' }
            ]
        });
    }
    return { days: plans, locations: [`${city} Center`, 'Main Square', 'Market'] };
}

function generateFallbackPacking(activities, days) {
    return {
        categories: [
            { name: 'Essentials', items: ['Passport', 'Tickets', 'Phone', 'Charger', 'Money'] },
            { name: 'Clothing', items: [`T-shirts (${days})`, 'Pants', 'Jacket', 'Shoes', 'Socks'] },
            { name: 'Toiletries', items: ['Toothbrush', 'Soap', 'Shampoo', 'Sunscreen'] }
        ]
    };
}

app.listen(PORT, () => {
    console.log(`\n🚀 TripSync server running on http://localhost:${PORT}`);
    console.log('📂 Serving files from ./public directory\n');
});


/* ==========================================
   package.json
   ========================================== */
/*
{
  "name": "tripsync",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "mongoose": "^8.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
*/


/* ==========================================
   .env
   ========================================== */
/*
MONGODB_URI=mongodb://localhost:27017/tripsync
JWT_SECRET=your-super-secret-jwt-key-change-this
GOOGLE_AI_KEY=your_google_ai_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_key_here
PORT=3000
*/