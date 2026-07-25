const Testimonial = require('../models/Testimonial');

// GET /api/widget/testimonials — for embeddable widget (CORS open)
const getWidgetTestimonials = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 20);
    const accentColor = req.query.accentColor || '6366f1';
    const layout = req.query.layout || 'grid'; // grid | carousel | list

    const testimonials = await Testimonial.find({ status: 'approved' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('name company text rating photoUrl createdAt sentiment')
      .lean();

    res.json({
      success: true,
      data: testimonials,
      config: {
        accentColor: `#${accentColor.replace('#', '')}`,
        layout,
      },
    });
  } catch (error) {
    console.error('getWidgetTestimonials error:', error);
    res.status(500).json({ success: false, message: 'Failed to load widget data' });
  }
};

module.exports = { getWidgetTestimonials };