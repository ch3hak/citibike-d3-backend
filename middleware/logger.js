const requestLogger = (req, res, next) => {
    const start = Date.now();
    

    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        const statusColor = status >= 400 ? '🔴' : status >= 300 ? '🟡' : '🟢';
        
        console.log(`${statusColor} ${req.method} ${req.path} - ${status} - ${duration}ms`);
    });
    
    next();
};

module.exports = requestLogger;
