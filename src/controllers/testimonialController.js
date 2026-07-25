const { validationResult } = require("express-validator");
const Testimonial = require("../models/Testimonial");
const { createFingerprint } = require("../utils/fingerprint");
const { analyzeWithGemini } = require("../utils/geminiAnalysis");

// POST /api/testimonials — submit a testimonial
const submitTestimonial = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, email, company, text, rating } = req.body;

    // Duplicate detection
    const fingerprint = createFingerprint(email, text);
    const existing = await Testimonial.findOne({ fingerprint });
    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "A similar testimonial from this email already exists. Thank you for your feedback!",
      });
    }

    // AI analysis via Gemini
    const { sentiment, sentimentScore, tags, summary } =
      await analyzeWithGemini(text, parseInt(rating));
    console.log("sentiiment ", sentiment);
    const testimonial = await Testimonial.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company ? company.trim() : "",
      text: text.trim(),
      rating: parseInt(rating),
      sentiment,
      sentimentScore,
      aiTags: tags,
      aiSummary: summary,
      fingerprint,
    });

    res.status(201).json({
      success: true,
      message:
        "Thank you! Your testimonial has been submitted and is pending review.",
      data: {
        id: testimonial._id,
        name: testimonial.name,
        status: testimonial.status,
      },
    });
  } catch (error) {
    console.error("submitTestimonial error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to submit testimonial" });
  }
};

// GET /api/testimonials — list all (dashboard, with pagination)
const getAllTestimonials = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || "";
    const skip = (page - 1) * limit;

    const filter = {};
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      filter.status = status;
    }

    const [testimonials, total] = await Promise.all([
      Testimonial.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Testimonial.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: testimonials,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("getAllTestimonials error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch testimonials" });
  }
};

// GET /api/testimonials/approved — public approved testimonials
const getApprovedTestimonials = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const sortBy = ["createdAt", "rating"].includes(req.query.sortBy)
      ? req.query.sortBy
      : "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

    const [testimonials, total] = await Promise.all([
      Testimonial.find({ status: "approved" })
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .select("-email -fingerprint -reviewNote -sentimentScore")
        .lean(),
      Testimonial.countDocuments({ status: "approved" }),
    ]);

    res.json({
      success: true,
      data: testimonials,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("getApprovedTestimonials error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch testimonials" });
  }
};

// PATCH /api/testimonials/:id/status — approve or reject
const updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;

    if (!["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be "approved", "rejected" or "pending"',
      });
    }

    const testimonial = await Testimonial.findByIdAndUpdate(
      id,
      {
        status,
        reviewNote: reviewNote || "",
        reviewedAt: new Date(),
      },
      { new: true, runValidators: true },
    );

    if (!testimonial) {
      return res
        .status(404)
        .json({ success: false, message: "Testimonial not found" });
    }

    res.json({
      success: true,
      message: `Testimonial ${status} successfully`,
      data: testimonial,
    });
  } catch (error) {
    console.error("updateStatus error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update status" });
  }
};

// DELETE /api/testimonials/:id — delete a testimonial
const deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) {
      return res
        .status(404)
        .json({ success: false, message: "Testimonial not found" });
    }
    res.json({ success: true, message: "Testimonial deleted successfully" });
  } catch (error) {
    console.error("deleteTestimonial error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete testimonial" });
  }
};

// GET /api/testimonials/stats — dashboard stats
const getStats = async (req, res) => {
  try {
    const [total, pending, approved, rejected] = await Promise.all([
      Testimonial.countDocuments(),
      Testimonial.countDocuments({ status: "pending" }),
      Testimonial.countDocuments({ status: "approved" }),
      Testimonial.countDocuments({ status: "rejected" }),
    ]);

    const avgRating = await Testimonial.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        averageRating: avgRating[0]
          ? Math.round(avgRating[0].avg * 10) / 10
          : 0,
      },
    });
  } catch (error) {
    console.error("getStats error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
};

module.exports = {
  submitTestimonial,
  getAllTestimonials,
  getApprovedTestimonials,
  updateStatus,
  deleteTestimonial,
  getStats,
};
