const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    accountType: { 
        type: String, 
        required: true,
        enum: ['brand', 'agency', 'influencer', 'individual'] 
    },
    profileImage: { type: String },
    companyName: { type: String },
    bio: { type: String },
    niches: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Niche' 
    }],
    socialMedia: [{
        platform: { type: String, enum: ['instagram', 'tiktok', 'facebook', 'twitter', 'youtube', 'whatsapp'] },
        username: { type: String },
        followers: { type: Number },
        verified: { type: Boolean, default: false }
    }],
    tokens: [{
        token: { type: String, required: true }
    }]
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

// Generate auth token
userSchema.methods.generateAuthToken = async function() {
    const token = jwt.sign({ _id: this._id.toString() }, process.env.JWT_SECRET);
    this.tokens = this.tokens.concat({ token });
    await this.save();
    return token;
};

// Hide sensitive data
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.tokens;
    return user;
};

module.exports = mongoose.model('User', userSchema);