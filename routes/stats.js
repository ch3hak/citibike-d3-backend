const express = require('express');
const { pool } = require('../utils/database');
const router = express.Router();

router.get('/', async (req, res, next) => {
    try {
        const query = `
            SELECT 
                total_trips,
                unique_start_stations,
                unique_end_stations,
                ROUND(avg_trip_duration_min::numeric, 1) as avg_trip_duration_min,
                first_trip,
                last_trip
            FROM summary_stats
        `;
        
        const result = await pool.query(query);
        const stats = result.rows[0];
        
        const peakHourQuery = `
            SELECT 
                hour,
                SUM(trip_count) as total_trips
            FROM hourly_station_flows 
            GROUP BY hour 
            ORDER BY total_trips DESC 
            LIMIT 1
        `;
        
        const peakResult = await pool.query(peakHourQuery);
        const peakHour = peakResult.rows[0]?.hour;
        
        const busiestStationQuery = `
            SELECT 
                station_name,
                total_departures + total_arrivals as total_trips
            FROM station_summary 
            ORDER BY total_trips DESC 
            LIMIT 1
        `;
        
        const stationResult = await pool.query(busiestStationQuery);
        const busiestStation = stationResult.rows[0];
        
        res.json({
            ...stats,
            peak_hour: peakHour,
            busiest_station: busiestStation,
            metadata: {
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;