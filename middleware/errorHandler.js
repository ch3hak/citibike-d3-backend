const errorHandler = (err, req, res, next) => {
    console.error('Error:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString()
    });

    if (err.code && err.code.startsWith('P')) {
        return res.status(500).json({
            error: 'Database error',
            message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
        });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation error',
            message: err.message
        });
    }

    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
};

module.exports = errorHandler;