const express = require('express');
const { pool } = require('../utils/database');
const router = express.Router();

router.get('/trips/:hour', async (req, res, next) => {
    try {
        const { hour } = req.params;
        const { limit = 500 } = req.query;
        
        const hourNum = parseInt(hour);
        if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
            return res.status(400).json({
                error: 'Invalid hour parameter'
            });
        }
        
        const query = `
            SELECT 
                ride_id,
                started_at,
                ended_at,
                start_station_id,
                end_station_id,
                start_station_name,
                end_station_name,
                ROUND(start_lat::numeric, 6) as start_lat,
                ROUND(start_lng::numeric, 6) as start_lng,
                ROUND(end_lat::numeric, 6) as end_lat,
                ROUND(end_lng::numeric, 6) as end_lng,
                rideable_type,
                member_casual,
                trip_duration_min
            FROM trips 
            WHERE trip_hour = $1 
            ORDER BY started_at 
            LIMIT $2
        `;
        
        const result = await pool.query(query, [hourNum, limit]);
        
        res.json({
            hour: hourNum,
            trips: result.rows,
            metadata: {
                count: result.rows.length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        next(error);
    }
});


router.post('/start', async (req, res, next) => {
    try {
        const { hour = 8, speed = 1 } = req.body;
        const wss = req.app.locals.wss;
        
        if (!wss) {
            return res.status(503).json({
                error: 'WebSocket server not available'
            });
        }
        

        const query = `
            SELECT 
                ride_id,
                started_at,
                start_station_id,
                end_station_id,
                start_station_name,
                end_station_name,
                start_lat,
                start_lng,
                end_lat,
                end_lng,
                trip_duration_min
            FROM trips 
            WHERE trip_hour = $1 
            ORDER BY started_at 
            LIMIT 200
        `;
        
        const result = await pool.query(query, [hour]);
        const trips = result.rows;
        
        let index = 0;
        const interval = setInterval(() => {
            if (index >= trips.length) {
                clearInterval(interval);
                return;
            }
            
            const batch = trips.slice(index, index + 5);
            
            wss.clients.forEach(client => {
                if (client.readyState === client.OPEN) {
                    client.send(JSON.stringify({
                        type: 'trip_batch',
                        data: batch,
                        timestamp: new Date().toISOString()
                    }));
                }
            });
            
            index += 5;
        }, 1000 / speed);
        
        res.json({
            message: 'Simulation started',
            hour: hour,
            speed: speed,
            total_trips: trips.length
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;