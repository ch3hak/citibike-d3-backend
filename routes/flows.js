const express = require('express');
const { pool } = require('../utils/database');
const router = express.Router();

router.get('/:hour', async (req, res, next) => {
    try {
        const { hour } = req.params;
        const { limit = 100, min_trips = 1 } = req.query;
        
        const hourNum = parseInt(hour);
        if (isNaN(hourNum) || hourNum < 0 || hourNum > 23) {
            return res.status(400).json({
                error: 'Invalid hour parameter',
                message: 'Hour must be between 0 and 23'
            });
        }
        
        const limitNum = Math.min(parseInt(limit) || 100, 200);
        const minTrips = Math.max(parseInt(min_trips) || 1, 1);
        
        const query = `
            SELECT 
                start_station_id,
                end_station_id,
                start_station_name,
                end_station_name,
                trip_count,
                ROUND(start_lat::numeric, 6) as start_lat,
                ROUND(start_lng::numeric, 6) as start_lng,
                ROUND(end_lat::numeric, 6) as end_lat,
                ROUND(end_lng::numeric, 6) as end_lng
            FROM hourly_station_flows 
            WHERE hour = $1 
              AND trip_count >= $2
            ORDER BY trip_count DESC 
            LIMIT $3
        `;
        
        const result = await pool.query(query, [hourNum, minTrips, limitNum]);
        
        res.json({
            hour: hourNum,
            flows: result.rows,
            metadata: {
                count: result.rows.length,
                min_trips: minTrips,
                limit: limitNum,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        next(error);
    }
});

router.get('/', async (req, res, next) => {
    try {
        const query = `
            SELECT 
                hour,
                COUNT(*) as unique_flows,
                SUM(trip_count) as total_trips,
                ROUND(AVG(trip_count), 1) as avg_trips_per_flow,
                MAX(trip_count) as max_trips_in_flow
            FROM hourly_station_flows 
            GROUP BY hour 
            ORDER BY hour
        `;
        
        const result = await pool.query(query);
        
        res.json({
            hourly_summary: result.rows,
            metadata: {
                total_hours: result.rows.length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;