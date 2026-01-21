// routes/login.js
const express = require('express')
const router = express.Router()
const { pool } = require('../config/database')

// POST /login
// body: { user: "Aiman", pin: "1234" }
router.post('/', async (req, res) => {
  try {
    const { user, pin } = req.body || {}

    // basic validation
    if (!user || typeof user !== 'string') {
      return res.status(400).json({ ok: false, message: 'User is required.' })
    }
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return res
        .status(400)
        .json({ ok: false, message: 'PIN must be exactly 4 digits.' })
    }

    // NOTE: "user" is reserved word, so table/column are quoted
    const q = 'SELECT id, "user" FROM "user" WHERE "user" = $1 AND pin = $2 LIMIT 1'
    const result = await pool.query(q, [user, pin])

    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, message: 'Invalid user or PIN.' })
    }

    const row = result.rows[0]
    return res.status(200).json({
      ok: true,
      id: row.id,
      user: row.user,
    })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ ok: false, message: 'Server Error' })
  }
})

module.exports = router
