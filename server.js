// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/adfluence', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Models
const User = require('./models/User');
const Campaign = require('./models/Campaign');
const Niche = require('./models/Niche');

// File Upload Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

// Authentication Middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded._id, 'tokens.token': token });

        if (!user) {
            throw new Error();
        }

        req.token = token;
        req.user = user;
        next();
    } catch (err) {
        res.status(401).send({ error: 'Please authenticate.' });
    }
};

// Routes

// User Registration
app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password, accountType } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already in use' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            name,
            email,
            password: hashedPassword,
            accountType,
            niches: accountType === 'influencer' ? [] : undefined,
            socialMedia: accountType === 'influencer' ? [] : undefined
        });

        await user.save();

        // Generate auth token
        const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET);
        user.tokens = user.tokens.concat({ token });
        await user.save();

        res.status(201).json({ user, token });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// User Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET);
        user.tokens = user.tokens.concat({ token });
        await user.save();

        res.json({ user, token });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// User Logout
app.post('/api/logout', auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter(token => token.token !== req.token);
        await req.user.save();
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get current user
app.get('/api/me', auth, async (req, res) => {
    res.json(req.user);
});

// Niches
app.get('/api/niches', async (req, res) => {
    try {
        const niches = await Niche.find();
        res.json(niches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Campaigns
app.post('/api/campaigns', auth, upload.single('image'), async (req, res) => {
    try {
        if (req.user.accountType !== 'brand' && req.user.accountType !== 'agency') {
            return res.status(403).json({ error: 'Only brands and agencies can create campaigns' });
        }

        const campaign = new Campaign({
            ...req.body,
            createdBy: req.user._id,
            image: req.file ? req.file.path : undefined
        });

        await campaign.save();
        res.status(201).json(campaign);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/campaigns', async (req, res) => {
    try {
        const { niche, platform, minBudget, maxBudget } = req.query;
        const filters = {};

        if (niche) filters.niches = niche;
        if (platform) filters.platforms = platform;
        if (minBudget || maxBudget) {
            filters.budget = {};
            if (minBudget) filters.budget.$gte = parseInt(minBudget);
            if (maxBudget) filters.budget.$lte = parseInt(maxBudget);
        }

        const campaigns = await Campaign.find(filters).populate('createdBy', 'name');
        res.json(campaigns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Apply to campaign
app.post('/api/campaigns/:id/apply', auth, async (req, res) => {
    try {
        if (req.user.accountType !== 'influencer') {
            return res.status(403).json({ error: 'Only influencers can apply to campaigns' });
        }

        const campaign = await Campaign.findById(req.params.id);
        if (!campaign) {
            return res.status(404).json({ error: 'Campaign not found' });
        }

        if (campaign.applicants.includes(req.user._id)) {
            return res.status(400).json({ error: 'You have already applied to this campaign' });
        }

        campaign.applicants.push(req.user._id);
        await campaign.save();

        res.json({ message: 'Application submitted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Influencer Dashboard Data
app.get('/api/dashboard/influencer', auth, async (req, res) => {
    try {
        if (req.user.accountType !== 'influencer') {
            return res.status(403).json({ error: 'Only influencers can access this dashboard' });
        }

        const appliedCampaigns = await Campaign.find({ applicants: req.user._id }).populate('createdBy', 'name');
        const activeCampaigns = await Campaign.find({ acceptedInfluencers: req.user._id, status: 'active' }).populate('createdBy', 'name');
        const completedCampaigns = await Campaign.find({ acceptedInfluencers: req.user._id, status: 'completed' }).populate('createdBy', 'name');

        // Calculate earnings (simplified - in a real app this would be more complex)
        const earnings = completedCampaigns.reduce((total, campaign) => total + (campaign.budget / campaign.acceptedInfluencers.length), 0);

        res.json({
            stats: {
                earnings,
                activeCampaigns: activeCampaigns.length,
                applications: appliedCampaigns.length,
                completionRate: completedCampaigns.length / (completedCampaigns.length + activeCampaigns.length) * 100 || 0
            },
            campaigns: {
                applied: appliedCampaigns,
                active: activeCampaigns,
                completed: completedCampaigns
            },
            user: req.user
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Brand Dashboard Data
app.get('/api/dashboard/brand', auth, async (req, res) => {
    try {
        if (req.user.accountType !== 'brand' && req.user.accountType !== 'agency') {
            return res.status(403).json({ error: 'Only brands and agencies can access this dashboard' });
        }

        const campaigns = await Campaign.find({ createdBy: req.user._id })
            .populate('applicants', 'name profileImage followers')
            .populate('acceptedInfluencers', 'name profileImage followers');

        res.json({
            campaigns,
            user: req.user
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});