const express = require('express')
const router = express.Router()
const pool = require('../config/database')
const moment = require('moment-timezone')

const TOTAL_PAGES_IN_QURAN = 604 // Standard Mushaf Madinah
const TIMEZONE = 'Asia/Kuala_Lumpur'

/**
 * GET /tilawah/status
 * Get current tilawah status for user
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(400).json({ error: 'User ID required' })

    const result = await pool.query(
      `SELECT 
        t.last_page_recited,
        t.last_update_date,
        t.last_update_time,
        kg.goal_type,
        kg.target_completion_date
      FROM tilawah_tracker t
      LEFT JOIN khatam_goal kg ON t.user_id = kg.user_id
      WHERE t.user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      // Initialize if doesn't exist
      await pool.query(
        `INSERT INTO tilawah_tracker (user_id, last_page_recited, last_update_date, last_update_time)
        VALUES ($1, 1, CURRENT_DATE, NOW())
        ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      )
      
      // Also initialize khatam_goal if doesn't exist
      await pool.query(
        `INSERT INTO khatam_goal (user_id, goal_type, created_at, updated_at)
        VALUES ($1, 'once_month', NOW(), NOW())
        ON CONFLICT (user_id) DO NOTHING`,
        [userId]
      )

      return res.json({
        last_page_recited: 1,
        last_update_date: moment.tz(TIMEZONE).format('YYYY-MM-DD'),
        last_update_time: moment.tz(TIMEZONE).toISOString(),
        goal_type: 'once_month',
        target_completion_date: moment.tz(TIMEZONE).add(30, 'days').format('YYYY-MM-DD')
      })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching tilawah status:', error)
    res.status(500).json({ error: 'Failed to fetch tilawah status' })
  }
})

/**
 * POST /tilawah/update
 * Update last page recited
 */
router.post('/update', async (req, res) => {
  try {
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(400).json({ error: 'User ID required' })

    const { page_number } = req.body
    if (!page_number || page_number < 1 || page_number > TOTAL_PAGES_IN_QURAN) {
      return res.status(400).json({ error: `Page must be between 1 and ${TOTAL_PAGES_IN_QURAN}` })
    }

    const updateDate = moment.tz(TIMEZONE).format('YYYY-MM-DD')
    const updateTime = moment.tz(TIMEZONE).toISOString()

    // Reset sequence before insert
    await pool.query(`
      SELECT setval(
        'tilawah_update_log_id_seq',
        COALESCE((SELECT MAX(id) FROM tilawah_update_log), 0) + 1,
        false
      )
    `)

    // Begin transaction
    await pool.query('BEGIN')

    try {
      // Update tilawah_tracker
      await pool.query(
        `UPDATE tilawah_tracker 
        SET last_page_recited = $1, last_update_date = $2, last_update_time = $3
        WHERE user_id = $4`,
        [page_number, updateDate, updateTime, userId]
      )

      // Insert log
      await pool.query(
        `INSERT INTO tilawah_update_log (user_id, page_number, update_date, update_time)
        VALUES ($1, $2, $3, $4)`,
        [userId, page_number, updateDate, updateTime]
      )

      await pool.query('COMMIT')

      res.json({
        success: true,
        page_number,
        update_date: updateDate,
        update_time: updateTime,
        message: 'Page updated successfully'
      })
    } catch (innerError) {
      await pool.query('ROLLBACK')
      throw innerError
    }
  } catch (error) {
    console.error('Error updating tilawah:', error)
    res.status(500).json({ error: 'Failed to update page' })
  }
})

/**
 * GET /tilawah/logs
 * Get tilawah update history
 */
router.get('/logs', async (req, res) => {
  try {
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(400).json({ error: 'User ID required' })

    const { limit = 30 } = req.query

    const result = await pool.query(
      `SELECT 
        id,
        page_number,
        update_date,
        update_time,
        notes
      FROM tilawah_update_log
      WHERE user_id = $1
      ORDER BY update_time DESC
      LIMIT $2`,
      [userId, limit]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching tilawah logs:', error)
    res.status(500).json({ error: 'Failed to fetch logs' })
  }
})

/**
 * GET /tilawah/progress
 * Calculate daily target and estimated completion date
 */
router.get('/progress', async (req, res) => {
  try {
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(400).json({ error: 'User ID required' })

    const result = await pool.query(
      `SELECT 
        t.last_page_recited,
        t.last_update_date,
        kg.goal_type,
        kg.target_completion_date
      FROM tilawah_tracker t
      LEFT JOIN khatam_goal kg ON t.user_id = kg.user_id
      WHERE t.user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tilawah data not found' })
    }

    const { last_page_recited, last_update_date, goal_type, target_completion_date } = result.rows[0]
    const today = moment.tz(TIMEZONE).format('YYYY-MM-DD')
    const remaining_pages = TOTAL_PAGES_IN_QURAN - last_page_recited

    let daily_target = 20
    let goal_days = 30
    let estimated_completion = moment.tz(TIMEZONE)

    if (goal_type === 'once_month') {
      daily_target = Math.ceil(TOTAL_PAGES_IN_QURAN / 30)
      goal_days = 30
    } else if (goal_type === 'once_two_months') {
      daily_target = Math.ceil(TOTAL_PAGES_IN_QURAN / 60)
      goal_days = 60
    } else if (goal_type === 'free') {
      // Calculate pace based on last 7 days
      const logsResult = await pool.query(
        `SELECT COUNT(*) as log_count, MIN(page_number) as min_page, MAX(page_number) as max_page
        FROM tilawah_update_log
        WHERE user_id = $1 AND update_date >= CURRENT_DATE - INTERVAL '7 days'`,
        [userId]
      )

      const logs = logsResult.rows[0]
      if (logs.log_count > 0 && logs.max_page && logs.min_page) {
        const pagesIn7Days = Math.max(0, logs.max_page - logs.min_page)
        const dailyPaceFrom7Days = pagesIn7Days / 7
        daily_target = Math.ceil(dailyPaceFrom7Days) || 20

        // Calculate based on current pace
        if (daily_target > 0 && remaining_pages > 0) {
          const daysNeeded = Math.ceil(remaining_pages / daily_target)
          estimated_completion = moment.tz(TIMEZONE).add(daysNeeded, 'days')
        }
      }
    }

    // If not free goal, calculate completion date
    if (goal_type !== 'free') {
      estimated_completion = moment.tz(TIMEZONE).add(goal_days, 'days')
    }

    const pages_to_complete_today = remaining_pages > 0 ? Math.min(daily_target, remaining_pages) : 0

    res.json({
      last_page_recited,
      remaining_pages,
      daily_target,
      pages_to_complete_today,
      estimated_completion_date: estimated_completion.format('YYYY-MM-DD'),
      estimated_completion_day: estimated_completion.format('dddd'),
      goal_type,
      current_date: today
    })
  } catch (error) {
    console.error('Error calculating progress:', error)
    res.status(500).json({ error: 'Failed to calculate progress' })
  }
})

/**
 * POST /tilawah/set-khatam-goal
 * Set or update khatam goal
 */
router.post('/set-khatam-goal', async (req, res) => {
  try {
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(400).json({ error: 'User ID required' })

    const { goal_type } = req.body
    if (!['once_month', 'once_two_months', 'free'].includes(goal_type)) {
      return res.status(400).json({ error: 'Invalid goal type' })
    }

    const targetDate = moment.tz(TIMEZONE)
      .add(goal_type === 'once_month' ? 30 : goal_type === 'once_two_months' ? 60 : 0, 'days')
      .format('YYYY-MM-DD')

    const result = await pool.query(
      `INSERT INTO khatam_goal (user_id, goal_type, target_completion_date, created_at, updated_at)
      VALUES ($1, $2, $3, NOW(), NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET goal_type = $2, target_completion_date = $3, updated_at = NOW()
      RETURNING id, user_id, goal_type, target_completion_date`,
      [userId, goal_type, goal_type !== 'free' ? targetDate : null]
    )

    res.json({
      success: true,
      goal: result.rows[0]
    })
  } catch (error) {
    console.error('Error setting khatam goal:', error)
    res.status(500).json({ error: 'Failed to set goal' })
  }
})

/**
 * GET /tilawah/khatam-info
 * Get khatam completion information
 */
router.get('/khatam-info', async (req, res) => {
  try {
    const userId = req.headers['x-user-id']
    if (!userId) return res.status(400).json({ error: 'User ID required' })

    const result = await pool.query(
      `SELECT 
        kg.goal_type,
        kg.target_completion_date,
        kg.created_at,
        kg.updated_at,
        t.last_page_recited
      FROM khatam_goal kg
      LEFT JOIN tilawah_tracker t ON kg.user_id = t.user_id
      WHERE kg.user_id = $1`,
      [userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Khatam goal not found' })
    }

    const { goal_type, target_completion_date, last_page_recited } = result.rows[0]
    const pages_completed_percentage = Math.round((last_page_recited / TOTAL_PAGES_IN_QURAN) * 100)
    const remaining_pages = TOTAL_PAGES_IN_QURAN - last_page_recited

    res.json({
      goal_type,
      target_completion_date,
      pages_completed: last_page_recited,
      pages_remaining: remaining_pages,
      completion_percentage: pages_completed_percentage,
      total_pages: TOTAL_PAGES_IN_QURAN
    })
  } catch (error) {
    console.error('Error fetching khatam info:', error)
    res.status(500).json({ error: 'Failed to fetch khatam info' })
  }
})

module.exports = router
