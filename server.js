const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tripsync';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✓ MongoDB Connected'))
    .catch(err => console.error('✗ MongoDB Connection Error:', err));

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    personality: {
        destinationType: String,
        planningType: String,
        fullType: String,
        name: String,
        description: String,
        destinations: [String]
    },
    createdAt: { type: Date, default: Date.now }
});

const tripSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    city: { type: String, required: true },
    days: { type: Number, required: true },
    activities: [String],
    mustVisit: { type: String, default: '' },
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

// Generate trip plan (preview only, not saved)
app.post('/api/generate-trip', authenticateToken, async (req, res) => {
    try {
        const { city, days, activities, mustVisit } = req.body;
        console.log(`[Trip Preview] User ${req.user.email} generating ${days}-day trip for ${city}`);
        
        const tripPlan = await generateTripPlan(city, days, activities, mustVisit);
        const packingList = await generatePackingList(city, activities, days);
        
        res.json({
            tripPlan,
            packingList
        });
    } catch (error) {
        console.error('[Trip Preview] Error:', error);
        res.status(500).json({ error: 'Failed to generate trip' });
    }
});

// Save trip to database
app.post('/api/save-trip', authenticateToken, async (req, res) => {
    try {
        const { city, days, activities, mustVisit, tripPlan, packingList } = req.body;
        console.log(`[Save Trip] User ${req.user.email} saving trip to ${city}`);
        
        const trip = new Trip({
            userId: req.user.userId,
            city,
            days,
            activities,
            mustVisit: mustVisit || '',
            tripPlan,
            packingList
        });
        
        await trip.save();
        console.log('[Trip] Saved to database');
        
        res.json({
            message: 'Trip saved successfully',
            tripId: trip._id
        });
    } catch (error) {
        console.error('[Save Trip] Error:', error);
        res.status(500).json({ error: 'Failed to save trip' });
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

// Save user personality
app.post('/api/personality', authenticateToken, async (req, res) => {
    try {
        const personality = req.body;
        console.log(`[Personality] Saving for user ${req.user.email}`);
        
        await User.findByIdAndUpdate(
            req.user.userId,
            { personality },
            { new: true }
        );
        
        res.json({ message: 'Personality saved successfully' });
    } catch (error) {
        console.error('[Personality] Error:', error);
        res.status(500).json({ error: 'Failed to save personality' });
    }
});

// Get user personality
app.get('/api/personality', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('personality');
        res.json({ personality: user.personality || null });
    } catch (error) {
        console.error('[Get Personality] Error:', error);
        res.status(500).json({ error: 'Failed to fetch personality' });
    }
});

async function generateTripPlan(city, days, activities, mustVisit) {
    const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
    
    if (!GOOGLE_AI_KEY) {
        console.warn('[Trip] No AI key found, using fallback');
        return generateFallbackTrip(city, days, activities, mustVisit);
    }
    
    try {
        const mustVisitText = mustVisit ? `\n\nIMPORTANT: The traveler must visit these places: ${mustVisit}. Please include these locations in the itinerary.` : '';
        
        const prompt = `Create a ${days}-day trip itinerary for ${city}.

Activities: ${activities.join(', ')}${mustVisitText}

Return ONLY valid JSON with NO markdown formatting, NO code blocks, NO backticks:
{
    "days": [
        {
            "day": 1,
            "title": "Day title",
            "activities": [
                {
                    "time": "09:00 AM",
                    "location": "Location name",
                    "description": "Activity description"
                }
            ]
        }
    ],
    "locations": ["Location 1", "Location 2", "Location 3"]
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GOOGLE_AI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { 
                        temperature: 0.7,
                        maxOutputTokens: 4096
                    }
                })
            }
        );
        
        const data = await response.json();
        console.log('[AI Trip] API Response received');
        
        // Check for errors in response
        if (data.error) {
            console.error('[AI Trip] API Error:', data.error);
            throw new Error(`API Error: ${data.error.message}`);
        }
        
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let content = data.candidates[0].content.parts[0].text;
            console.log('[AI Trip] FULL RESPONSE:\n', content);
            
            // Remove markdown code blocks
            content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```/g, '');
            content = content.trim();
            
            // Try to find JSON object
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const result = JSON.parse(jsonMatch[0]);
                    console.log('[AI Trip] Successfully parsed trip plan');
                    return result;
                } catch (parseError) {
                    console.error('[AI Trip] JSON parse error:', parseError.message);
                    console.error('[AI Trip] Attempted to parse:', jsonMatch[0].substring(0, 500));
                }
            } else {
                console.error('[AI Trip] No JSON object found in response');
            }
        } else {
            console.error('[AI Trip] No text content in response');
            console.log('[AI Trip] Full data:', JSON.stringify(data, null, 2));
        }
        
        throw new Error('Invalid AI response format');
    } catch (error) {
        console.error('[AI Trip] Error:', error.message);
        return generateFallbackTrip(city, days, activities, mustVisit);
    }
}

async function generatePackingList(city, activities, days) {
    const GOOGLE_AI_KEY = process.env.GOOGLE_AI_KEY;
    
    if (!GOOGLE_AI_KEY) {
        console.warn('[Packing] No AI key found, using fallback');
        return generateFallbackPacking(activities, days);
    }
    
    try {
        const prompt = `Create a packing list for a ${days}-day trip to ${city}.

Activities: ${activities.join(', ')}

Return ONLY valid JSON with NO markdown formatting, NO code blocks, NO backticks:
{
    "categories": [
        {
            "name": "Essentials",
            "items": ["Passport", "Phone charger"]
        },
        {
            "name": "Clothing",
            "items": ["Shoes", "Jacket"]
        }
    ]
}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GOOGLE_AI_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { 
                        temperature: 0.7,
                        maxOutputTokens: 2048
                    }
                })
            }
        );
        
        const data = await response.json();
        console.log('[AI Packing] API Response received');
        
        // Check for errors in response
        if (data.error) {
            console.error('[AI Packing] API Error:', data.error);
            throw new Error(`API Error: ${data.error.message}`);
        }
        
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let content = data.candidates[0].content.parts[0].text;
            console.log('[AI Packing] FULL RESPONSE:\n', content);
            
            // Remove markdown code blocks
            content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/```/g, '');
            content = content.trim();
            
            // Try to find JSON object
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const result = JSON.parse(jsonMatch[0]);
                    console.log('[AI Packing] Successfully parsed packing list');
                    return result;
                } catch (parseError) {
                    console.error('[AI Packing] JSON parse error:', parseError.message);
                    console.error('[AI Packing] Attempted to parse:', jsonMatch[0].substring(0, 500));
                }
            } else {
                console.error('[AI Packing] No JSON object found in response');
            }
        } else {
            console.error('[AI Packing] No text content in response');
            console.log('[AI Packing] Full data:', JSON.stringify(data, null, 2));
        }
        
        throw new Error('Invalid AI response format');
    } catch (error) {
        console.error('[AI Packing] Error:', error.message);
        return generateFallbackPacking(activities, days);
    }
}

function generateFallbackTrip(city, days, activities, mustVisit) {
    const plans = [];
    const mustVisitLocations = mustVisit ? mustVisit.split(',').map(l => l.trim()) : [];
    
    for (let i = 1; i <= days; i++) {
        const dayActivities = [
            { 
                time: '09:00 AM', 
                location: mustVisitLocations[i - 1] || `${city} Main Attraction`, 
                description: `Start your day exploring ${mustVisitLocations[i - 1] || 'the city center'}` 
            },
            { 
                time: '12:00 PM', 
                location: 'Local Restaurant', 
                description: `Enjoy authentic local cuisine` 
            },
            { 
                time: '02:00 PM', 
                location: `${activities[0] || 'Cultural'} Site`, 
                description: `Experience ${activities[0] || 'local culture'}` 
            },
            { 
                time: '05:00 PM', 
                location: 'Shopping District', 
                description: 'Browse local markets and shops' 
            }
        ];
        
        plans.push({
            day: i,
            title: i === 1 ? `Arrival in ${city}` : i === days ? `Final Day & Departure` : `Exploring ${city}`,
            activities: dayActivities
        });
    }
    
    const locations = mustVisitLocations.length > 0 
        ? mustVisitLocations 
        : [`${city} Center`, 'Main Square', 'Cultural District', 'Market Area'];
    
    return { days: plans, locations };
}

function generateFallbackPacking(activities, days) {
    return {
        categories: [
            { name: 'Travel Documents', items: ['Passport', 'Visa (if required)', 'Travel insurance', 'Hotel confirmations', 'Flight tickets'] },
            { name: 'Essentials', items: ['Phone', 'Charger', 'Power bank', 'Credit cards', 'Cash', 'Wallet'] },
            { name: 'Clothing', items: [`T-shirts (${days})`, `Underwear (${days + 1})`, 'Pants/Shorts', 'Light jacket', 'Comfortable walking shoes', 'Socks'] },
            { name: 'Toiletries', items: ['Toothbrush', 'Toothpaste', 'Shampoo', 'Soap', 'Sunscreen', 'Deodorant'] },
            { name: 'Activity Gear', items: activities.includes('Adventure') ? ['Hiking boots', 'Backpack'] : activities.includes('Swimming') ? ['Swimsuit', 'Towel'] : ['Camera', 'Sunglasses'] },
            { name: 'Health & Safety', items: ['Medications', 'First-aid kit', 'Hand sanitizer', 'Face masks'] }
        ]
    };
}

app.listen(PORT, () => {
    console.log(`\n🚀 TripSync server running on http://localhost:${PORT}`);
    console.log('📂 Serving files from ./public directory\n');
});