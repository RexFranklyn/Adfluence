const mongoose = require('mongoose');

const nicheSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    category: { 
        type: String, 
        required: true,
        enum: ['lifestyle', 'fashion', 'beauty', 'fitness', 'food', 'music', 'movie', 'entertainment', 'technology', 'gaming', 'travel', 'business'] 
    },
    description: { type: String },
    influencerCount: { type: Number, default: 0 },
    campaignCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('Niche', nicheSchema);