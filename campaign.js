const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String },
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true 
    },
    niches: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Niche',
        required: true 
    }],
    platforms: [{ 
        type: String, 
        enum: ['instagram', 'tiktok', 'facebook', 'twitter', 'youtube', 'whatsapp'],
        required: true
    }],
    budget: { type: Number, required: true },
    budgetRange: {
        min: { type: Number },
        max: { type: Number }
    },
    applicants: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    acceptedInfluencers: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    status: { 
        type: String, 
        enum: ['draft', 'active', 'completed', 'cancelled'],
        default: 'active'
    },
    startDate: { type: Date },
    endDate: { type: Date },
    requirements: { type: String },
    deliverables: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);