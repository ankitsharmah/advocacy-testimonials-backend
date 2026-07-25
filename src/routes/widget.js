const express = require('express');
const cors = require('cors');
const router = express.Router();
const { getWidgetTestimonials } = require('../controllers/widgetController');

// Completely open CORS for widget — must work on third-party sites
router.use(cors({ origin: '*' }));

router.get('/testimonials', getWidgetTestimonials);

module.exports = router;