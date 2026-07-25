const express = require("express");
const { body } = require("express-validator");
const router = express.Router();
const {
  submitTestimonial,
  getAllTestimonials,
  getApprovedTestimonials,
  updateStatus,
  deleteTestimonial,
  getStats,
} = require("../controllers/testimonialController");

// Validation rules for submission
const submitValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Please enter a valid email address"),
  body("company")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Company name cannot exceed 100 characters"),
  body("text")
    .trim()
    .notEmpty()
    .withMessage("Testimonial text is required")
    .isLength({ min: 10 })
    .withMessage("Testimonial must be at least 10 characters")
    .isLength({ max: 1000 })
    .withMessage("Testimonial cannot exceed 1000 characters"),
  body("rating")
    .notEmpty()
    .withMessage("Rating is required")
    .isInt({ min: 1, max: 5 })
    .withMessage("Rating must be between 1 and 5"),
];

// Public routes
router.post("/", submitValidation, submitTestimonial);
router.get("/approved", getApprovedTestimonials);

// Dashboard routes (unprotected per spec — no auth required)
router.get("/stats", getStats);
router.get("/", getAllTestimonials);
router.patch("/:id/status", updateStatus);
router.delete("/:id", deleteTestimonial);

module.exports = router;
