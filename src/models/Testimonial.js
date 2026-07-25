const mongoose = require("mongoose");

const testimonialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, "Company name cannot exceed 100 characters"],
      default: "",
    },
    text: {
      type: String,
      required: [true, "Testimonial text is required"],
      trim: true,
      minlength: [10, "Testimonial must be at least 10 characters"],
      maxlength: [1000, "Testimonial cannot exceed 1000 characters"],
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // AI-generated sentiment analysis
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative", null],
      default: null,
    },
    sentimentScore: {
      type: Number,
      default: null,
    },
    aiTags: {
      type: [String],
      default: [],
    },
    aiSummary: {
      type: String,
      default: "",
    },
    // Fingerprint for duplicate detection
    fingerprint: {
      type: String,
      index: true,
    },
    // Track rejection/approval
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewNote: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound index to prevent exact duplicates (same email + same text)
testimonialSchema.index({ email: 1, fingerprint: 1 }, { unique: true });

// Index for common queries
testimonialSchema.index({ status: 1, createdAt: -1 });

const Testimonial = mongoose.model("Testimonial", testimonialSchema);

module.exports = Testimonial;
