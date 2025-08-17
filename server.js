require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const { pool, testConnection } = require('./utils/database');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/logger');

const stationsRouter = require('./routes/stations');
const flowsRouter = require('./routes/flows');
const statsRouter = require('./routes/stats');
const streamRouter = require('./routes/stream');

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WEBSOCKET_PORT || 8080;

app.use(cors({
    origin: process.env.NODE_ENV === 'development' ? '*' : 'https://yourdomain.com',
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get('/health', async (req, res) => {
    try {
        const dbResult = await pool.query('SELECT NOW()');
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

app.use('/api/stations', stationsRouter);
app.use('/api/flows', flowsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/stream', streamRouter);

app.use('/*all', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `${req.method} ${req.originalUrl} does not exist`,
        availableEndpoints: [
            'GET /health',
            'GET /api/stations',
            'GET /api/flows/:hour',
            'GET /api/stats',
            'GET /api/stream/trips/:hour'
        ]
    });
});

app.use(errorHandler);

async function startServer() {
    try {
        await testConnection();

        app.listen(PORT, () => {
            console.log(`Citi Bike API server running on port ${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`API base URL: http://localhost:${PORT}/api`);
        });
        
        startWebSocketServer();
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

function startWebSocketServer() {
    const wss = new WebSocket.Server({ 
        port: WS_PORT,
        perMessageDeflate: false 
    });
    
    console.log(`WebSocket server running on port ${WS_PORT}`);
    
    wss.on('connection', (ws) => {
        console.log('New WebSocket client connected');
        
        ws.send(JSON.stringify({
            type: 'connection',
            message: 'Connected to Citi Bike real-time stream',
            timestamp: new Date().toISOString()
        }));

        let isStreaming = false;
        let interval = null;
        let tripRows = [];
        let tripIdx = 0;
        let speed = 1;

        ws.on('message', async (msg) => {
            let parsed;
            try { parsed = JSON.parse(msg); } catch { return; }
            if (parsed.type === 'start_simulation') {
                if (isStreaming) return;
                isStreaming = true;
                if (!tripRows.length) {
                    const result = await pool.query('SELECT * FROM trips ORDER BY started_at LIMIT 10000');
                    tripRows = result.rows;
                    tripIdx = 0;
                }
                ws.send(JSON.stringify({ type: 'simulation_started', data: { totalTrips: tripRows.length } }));
                interval = setInterval(() => {
                    if (!isStreaming || tripIdx >= tripRows.length) return;
                    const batch = [];
                    for (let i = 0; i < Math.floor(Math.random()*3)+2 && tripIdx < tripRows.length; i++) {
                        batch.push({ ...tripRows[tripIdx], trip_id: `live_${tripRows[tripIdx].trip_id}_${tripIdx}` });
                        tripIdx++;
                    }
                    ws.send(JSON.stringify({
                        type: "new_trips",
                        data: batch,
                        progress: {
                            current: tripIdx,
                            total: tripRows.length,
                            percentage: Math.round((tripIdx / tripRows.length) * 100)
                        }
                    }));
                }, 800/speed);
            }
            if (parsed.type === 'pause_simulation') {
                isStreaming = false;
                clearInterval(interval);
                ws.send(JSON.stringify({ type: "simulation_paused" }));
            }
            if (parsed.type === 'stop_simulation' || parsed.type === 'reset_simulation') {
                isStreaming = false;
                clearInterval(interval);
                tripIdx = 0;
                ws.send(JSON.stringify({ type: "simulation_stopped" }));
            }
            if (parsed.type === 'set_speed' && typeof parsed.data?.speed === 'number') {
                speed = parsed.data.speed;
                clearInterval(interval);
                if (isStreaming) {
                    interval = setInterval(() => {
                        if (!isStreaming || tripIdx >= tripRows.length) return;
                        const batch = [];
                        for (let i = 0; i < Math.floor(Math.random()*3)+2 && tripIdx < tripRows.length; i++) {
                            batch.push({ ...tripRows[tripIdx], trip_id: `live_${tripRows[tripIdx].trip_id}_${tripIdx}` });
                            tripIdx++;
                        }
                        ws.send(JSON.stringify({
                            type: "new_trips",
                            data: batch,
                            progress: {
                                current: tripIdx,
                                total: tripRows.length,
                                percentage: Math.round((tripIdx / tripRows.length) * 100)
                            }
                        }));
                    }, 800/speed);
                }
                ws.send(JSON.stringify({ type: 'speed_changed', data: { speed } }));
            }
        });
        
        ws.on('close', () => {
            isStreaming = false;
            clearInterval(interval);
            console.log('WebSocket client disconnected');
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    app.locals.wss = wss;
}


process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    pool.end(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    pool.end(() => {
        process.exit(0);
    });
});

startServer();