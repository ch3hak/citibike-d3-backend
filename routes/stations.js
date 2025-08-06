const express = require('express');
const { pool } = require('../utils/database');
const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const { limit = 50, sort = 'total_trips' } = req.query;
        
        const validSorts = ['total_trips', 'total_departures', 'total_arrivals', 'station_name'];
        const sortColumn = validSorts.includes(sort) ? sort : 'total_trips';
        const limitNum = Math.min(parseInt(limit) || 50, 100);
        
        const query = `
            SELECT 
                station_id,
                station_name,
                ROUND(lat::numeric, 6) as lat,
                ROUND(lng::numeric, 6) as lng,
                total_departures,
                total_arrivals,
                total_departures + total_arrivals as total_trips,
                ROUND(avg_trip_duration_min::numeric, 1) as avg_duration_min
            FROM station_summary 
            WHERE total_departures > 0 
            ORDER BY ${sortColumn} DESC 
            LIMIT $1
        `;
        
        const result = await pool.query(query, [limitNum]);
        
        res.json({
            stations: result.rows,
            metadata: {
                count: result.rows.length,
                sort: sortColumn,
                limit: limitNum,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        next(error);
    }
});

router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        if (!id) {
            return res.status(400).json({
                error: 'Station ID is required'
            });
        }
        
        const query = `
            SELECT 
                station_id,
                station_name,
                ROUND(lat::numeric, 6) as lat,
                ROUND(lng::numeric, 6) as lng,
                total_departures,
                total_arrivals,
                total_departures + total_arrivals as total_trips,
                ROUND(avg_trip_duration_min::numeric, 1) as avg_duration_min
            FROM station_summary 
            WHERE station_id = $1
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Station not found',
                station_id: id
            });
        }
        
        res.json({
            station: result.rows[0],
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;