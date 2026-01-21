var express = require('express')
var router = express.Router()
const axios = require('axios');
const moment = require('moment-timezone')
const { query, pool } = require('../config/database')
const nodemailer = require('nodemailer');

const getUserId = (req) => {
  const raw =
    req.headers['x-user-id'] ??
    req.query.user_id ??
    req.body.user_id;

  const userId = Number(raw);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
};


//test

router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' })
})

// @desc Add New Memorized Surah
// @route POST /murajaah/addsurah
router.post('/addsurah', (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const { id, chapter_name, total_verse, verse_memorized, juz, note } = req.body

  const q = `
    INSERT INTO memorized_surah
      (id, chapter_name, total_verse, verse_memorized, juz, note, user_id)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
  `
  pool.query(
    q,
    [id, chapter_name, total_verse, verse_memorized, juz, note, user_id],
    (err) => {
      if (err) {
        console.error(err)
        return res.status(500).send('Server Error')
      }
      res.status(201).json({ message: 'Inserted Successfully' })
    }
  )
})

// @desc Get Surah List
// @route GET /murajaah/getmemorizedsurah?user_id=1
router.get('/getmemorizedsurah', (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const q = `
    SELECT *
    FROM memorized_surah
    WHERE user_id = $1
    ORDER BY juz ASC, id ASC
  `
  pool.query(q, [user_id], (err, result) => {
    if (err) {
      console.error(err)
      return res.status(500).send('Server Error')
    }
    res.status(200).json(result.rows)
  })
})

// @desc Add New Murajaah Record
// @route POST /murajaah/addmurajaah
// @access public
router.post('/addmurajaah', async (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const { surah_id } = req.body
  if (!surah_id) return res.status(400).json({ message: 'surah_id is required' })

  try {
    const totalRes = await pool.query(
      'SELECT COUNT(*) FROM memorized_surah WHERE user_id = $1',
      [user_id]
    )
    const total_memorized = parseInt(totalRes.rows[0].count, 10) || 0
    if (total_memorized === 0) {
      return res.status(400).json({ message: 'No memorized surah found for this user.' })
    }

    const date_time = moment.tz('Asia/Kuala_Lumpur').format()
    const currentDate = moment.tz('Asia/Kuala_Lumpur').format('YYYY-MM-DD')

    // update counter (only this user)
    const upd = await pool.query(
  'UPDATE memorized_surah SET murajaah_counter = murajaah_counter + 1 WHERE id = $1 AND user_id = $2',
  [surah_id, user_id]
)
if (upd.rowCount === 0) {
  return res.status(404).json({ message: 'Surah not found for this user.' })
}


    // get latest log (only this user)
    const logResult = await pool.query(
      'SELECT * FROM murajaah_log WHERE user_id = $1 ORDER BY date_time DESC LIMIT 1',
      [user_id]
    )

    const insertNewLog = async () => {
      const surahIds = [surah_id]
      const completion_rate = (surahIds.length / total_memorized) * 100

      await pool.query(
        'INSERT INTO murajaah_log (surah_id, date_time, completion_rate, user_id) VALUES ($1, $2, $3, $4)',
        [surahIds, date_time, completion_rate, user_id]
      )
      return res.status(201).send('Inserted Successfully')
    }

    if (logResult.rows.length === 0) return insertNewLog()

    const latestLog = logResult.rows[0]
    const logDate = moment.tz(latestLog.date_time, 'Asia/Kuala_Lumpur').format('YYYY-MM-DD')

    if (logDate !== currentDate) return insertNewLog()

    // avoid duplicates
    const merged = [...(latestLog.surah_id || []), surah_id]
    const unique = Array.from(new Set(merged.map(String))).map(Number)

    const completion_rate = (unique.length / total_memorized) * 100

    await pool.query(
      'UPDATE murajaah_log SET surah_id = $1, date_time = $2, completion_rate = $3 WHERE id = $4 AND user_id = $5',
      [unique, date_time, completion_rate, latestLog.id, user_id]
    )

    res.status(200).send('Updated Successfully')
  } catch (err) {
    console.error(err)
    res.status(500).send('Server Error')
  }
})


// @desc Update Surah Details
// @route PUT /murajaah/updatesurah/:id
router.put('/updatesurah/:id', (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const { chapter_name, total_verse, verse_memorized, juz, note } = req.body
  const surahId = req.params.id

  const updateQuery = `
    UPDATE memorized_surah
    SET chapter_name = $1, total_verse = $2, verse_memorized = $3, juz = $4, note = $5
    WHERE id = $6 AND user_id = $7
  `

  pool.query(
    updateQuery,
    [chapter_name, total_verse, verse_memorized, juz, note, surahId, user_id],
    (err, result) => {
      if (err) {
        console.error(err)
        return res.status(500).send('Server Error')
      }
      res.status(200).json({ message: 'Surah Updated Successfully' })
    }
  )
})

// @desc Delete a Memorized Surah by ID
// @route DELETE /murajaah/deletesurah/:id
router.delete('/deletesurah/:id', (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const surahId = req.params.id
  const deleteQuery = 'DELETE FROM memorized_surah WHERE id = $1 AND user_id = $2'

  pool.query(deleteQuery, [surahId, user_id], (err, result) => {
    if (err) {
      console.error(err)
      return res.status(500).send('Server Error')
    }
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Surah Not Found' })
    }
    res.status(200).json({ message: 'Surah Deleted Successfully' })
  })
})

// @desc Get Murajaah Progress
// @route GET /murajaah/getmurajaahprogress?date=YYYY-MM-DD&user_id=1
router.get('/getmurajaahprogress', (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const { date } = req.query
  if (!date) return res.status(400).json({ message: 'date is required' })

  pool.query(
    'SELECT * FROM murajaah_log WHERE user_id = $1 AND DATE(date_time) = $2',
    [user_id, date],
    (err, result) => {
      if (err) {
        console.error(err)
        return res.status(500).send('Server Error')
      }
      res.status(200).json(result.rows)
    }
  )
})

// @desc Get Weekly Murajaah Progress
// @route GET /murajaah/getweeklymurajaahprogress?date=YYYY-MM-DD&user_id=1
router.get('/getweeklymurajaahprogress', (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const { date } = req.query
  if (!date) return res.status(400).send('Please provide a date to determine the week.')

  const startOfGivenWeek = moment(date).startOf('week').tz('Asia/Kuala_Lumpur')
  const endOfGivenWeek = moment(date).endOf('week').tz('Asia/Kuala_Lumpur')

  const weekData = {
    Sunday: { day: startOfGivenWeek.clone().format(), rate: '0.00' },
    Monday: { day: startOfGivenWeek.clone().add(1, 'days').format(), rate: '0.00' },
    Tuesday: { day: startOfGivenWeek.clone().add(2, 'days').format(), rate: '0.00' },
    Wednesday: { day: startOfGivenWeek.clone().add(3, 'days').format(), rate: '0.00' },
    Thursday: { day: startOfGivenWeek.clone().add(4, 'days').format(), rate: '0.00' },
    Friday: { day: startOfGivenWeek.clone().add(5, 'days').format(), rate: '0.00' },
    Saturday: { day: endOfGivenWeek.clone().format(), rate: '0.00' },
  }

  const q = `
    SELECT
      DATE(date_time) AS day,
      AVG(completion_rate) AS average_completion_rate
    FROM murajaah_log
    WHERE user_id = $1 AND DATE(date_time) BETWEEN $2 AND $3
    GROUP BY DATE(date_time)
    ORDER BY DATE(date_time) ASC
  `

  pool.query(
    q,
    [user_id, startOfGivenWeek.format('YYYY-MM-DD'), endOfGivenWeek.format('YYYY-MM-DD')],
    (err, result) => {
      if (err) {
        console.error(err)
        return res.status(500).send('Server Error')
      }

      result.rows.forEach((row) => {
        const localDate = moment.utc(row.day).tz('Asia/Kuala_Lumpur')
        const dayName = localDate.format('dddd')
        weekData[dayName].day = localDate.format()
        weekData[dayName].rate = row.average_completion_rate
      })

      res.status(200).json(weekData)
    }
  )
})

// @desc Add New Sabaq Record
// @route POST /murajaah/sabaqtracker/add
router.post('/sabaqtracker/add', (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const {
    chapter_number,
    chapter_name,
    page,
    section,
    verse,
    number_of_readings,
    complete_memorization,
    murajaah_20_times,
  } = req.body

  const currentDate = moment.tz('Asia/Kuala_Lumpur').format('YYYY-MM-DD')

  // include user_id in matching condition
  pool.query(
    `SELECT * FROM sabaq_tracker
     WHERE user_id = $1 AND date = $2
       AND chapter_number = $3 AND chapter_name = $4
       AND page = $5 AND section = $6 AND verse = $7`,
    [user_id, currentDate, chapter_number, chapter_name, page, section, verse],
    (err, result) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server Error' })
      }

      if (result.rows.length > 0) {
        pool.query(
          'UPDATE sabaq_tracker SET number_of_readings = $1, complete_memorization = $2, murajaah_20_times = $3 WHERE id = $4 AND user_id = $5',
          [number_of_readings, complete_memorization, murajaah_20_times, result.rows[0].id, user_id],
          (err) => {
            if (err) {
              console.error(err)
              return res.status(500).json({ message: 'Server Error' })
            }
            res.status(200).json({ message: 'Updated Successfully' })
          }
        )
      } else {
        pool.query(
          `INSERT INTO sabaq_tracker
            (date, chapter_number, chapter_name, page, section, verse, number_of_readings, complete_memorization, murajaah_20_times, user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            currentDate,
            chapter_number,
            chapter_name,
            page,
            section,
            verse,
            number_of_readings,
            complete_memorization,
            murajaah_20_times,
            user_id,
          ],
          (err) => {
            if (err) {
              console.error(err)
              return res.status(500).json({ message: 'Server Error' })
            }
            res.status(201).json({ message: 'Inserted Successfully' })
          }
        )
      }
    }
  )
})

// @desc Get Latest Sabaq Info
// @route GET /murajaah/sabaqtracker/latest?user_id=1
router.get('/sabaqtracker/latest', (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const q = 'SELECT * FROM sabaq_tracker WHERE user_id = $1 ORDER BY id DESC LIMIT 1'
  pool.query(q, [user_id], (err, result) => {
    if (err) {
      console.error(err)
      return res.status(500).send('Server Error')
    }
    res.status(200).json(result.rows[0] || null)
  })
})

// @desc Get verses by page from the Quran API
// @route GET /quran/versesbypage/:page
// @access public
// router.get('/quran/versesbypage/:page', async (req, res) => {
//   const page = req.params.page;
//   const apiUrl = `https://api.quran.com/api/v4/verses/by_page/${page}?language=en&words=true`;

//   try {
//     const response = await axios.get(apiUrl);
//     res.status(200).json(response.data);
//   } catch (error) {
//     console.error('Error calling Quran API', error);
//     res.status(500).send('Server Error');
//   }
// });


// Quran API pass-through (no user_id needed)
router.get('/surah/:surah', async (req, res) => {
  const { surah } = req.params
  const { edition = 'quran-uthmani', beginning, ending } = req.query

  let offset, limit
  if (beginning && ending) {
    offset = parseInt(beginning) - 1
    limit = parseInt(ending) - parseInt(beginning) + 1
  }

  let apiUrl = `http://api.alquran.cloud/v1/surah/${surah}/${edition}`
  if (offset !== undefined && limit !== undefined) {
    apiUrl += `?offset=${offset}&limit=${limit}`
  }

  try {
    const response = await axios.get(apiUrl)
    if (response.data.code === 200) return res.json(response.data)
    res.status(response.data.code).json(response.data)
  } catch (error) {
    console.error('Error calling Al Quran Cloud API:', error)
    res.status(500).send('Server Error')
  }
})

// @desc Record Tahajjud
// @route POST /murajaah/tahajjud/record
router.post('/tahajjud/record', async (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const { currentDate } = req.body
  if (!currentDate) return res.status(400).json({ message: 'No current date provided.' })

  try {
    await pool.query('BEGIN')

    const yesterday = moment(currentDate).subtract(1, 'days').format('YYYY-MM-DD')

    const latestEntryResult = await pool.query(
      'SELECT * FROM tahajjud_tracker WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [user_id]
    )

    if (latestEntryResult.rows.length > 0) {
      const latestEntry = latestEntryResult.rows[0]
      const latestDate = latestEntry.dates[latestEntry.dates.length - 1]

      if (moment(latestDate).isSame(yesterday, 'day')) {
        const updatedDates = [...latestEntry.dates, currentDate]
        const newStreakCount = latestEntry.streak_count + 1
        await pool.query(
          'UPDATE tahajjud_tracker SET dates = $1, streak_count = $2 WHERE id = $3 AND user_id = $4',
          [updatedDates, newStreakCount, latestEntry.id, user_id]
        )
      } else {
        await pool.query(
          'INSERT INTO tahajjud_tracker (dates, streak_count, user_id) VALUES ($1, $2, $3)',
          [[currentDate], 1, user_id]
        )
      }
    } else {
      await pool.query(
        'INSERT INTO tahajjud_tracker (dates, streak_count, user_id) VALUES ($1, $2, $3)',
        [[currentDate], 1, user_id]
      )
    }

    await pool.query('COMMIT')
    res.status(200).json({ message: 'Tahajjud recorded successfully' })
  } catch (err) {
    await pool.query('ROLLBACK')
    console.error('Error recording tahajjud:', err)
    res.status(500).send('Server Error')
  }
})

// @desc View Tahajjud Records (user-aware)
// @route GET /murajaah/view_tahajjud_records?user_id=1
router.get('/view_tahajjud_records', async (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  try {
    const currentYear = moment().year()
    const currentMonth = moment().month() + 1

    const highestStreakResult = await pool.query(
      'SELECT MAX(streak_count) FROM tahajjud_tracker WHERE user_id = $1',
      [user_id]
    )
    const highestStreak = highestStreakResult.rows[0].max || 0

    const currentStreakResult = await pool.query(
      'SELECT streak_count FROM tahajjud_tracker WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
      [user_id]
    )
    const currentStreak = currentStreakResult.rows.length > 0 ? currentStreakResult.rows[0].streak_count : 0

    const totalMonthStreakResult = await pool.query(
      `
      SELECT SUM(streak_count) as total_month_streak
      FROM (
        SELECT DISTINCT ON (tt.id) tt.streak_count
        FROM tahajjud_tracker tt, UNNEST(tt.dates) as d(date)
        WHERE tt.user_id = $1 AND EXTRACT(MONTH FROM d) = $2 AND EXTRACT(YEAR FROM d) = $3
      ) as distinct_month
      `,
      [user_id, currentMonth, currentYear]
    )
    const totalMonthStreak = totalMonthStreakResult.rows[0].total_month_streak || 0

    const totalYearStreakResult = await pool.query(
      `
      SELECT SUM(streak_count) as total_year_streak
      FROM (
        SELECT DISTINCT ON (tt.id) tt.streak_count
        FROM tahajjud_tracker tt, UNNEST(tt.dates) as d(date)
        WHERE tt.user_id = $1 AND EXTRACT(YEAR FROM d) = $2
      ) as distinct_year
      `,
      [user_id, currentYear]
    )
    const totalYearStreak = totalYearStreakResult.rows[0].total_year_streak || 0

    res.json({
      highestStreak,
      currentStreak,
      totalInCurrentMonth: totalMonthStreak,
      totalInCurrentYear: totalYearStreak,
    })
  } catch (err) {
    console.error('Error fetching Tahajjud records:', err)
    res.status(500).send('Server Error')
  }
})

const getWeekRange = (offset) => {
  const startOfWeek = moment().startOf('isoWeek').subtract(offset, 'weeks')
  const endOfWeek = moment(startOfWeek).endOf('isoWeek')
  return { startOfWeek, endOfWeek }
}

// @desc Get Tahajjud history for a specific week
// @route GET /murajaah/tahajjud/history/:weekOffset?user_id=1
router.get('/tahajjud/history/:weekOffset', async (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  const weekOffset = parseInt(req.params.weekOffset, 10) || 0
  const { startOfWeek, endOfWeek } = getWeekRange(weekOffset)

  try {
    const historyResult = await pool.query(
      `SELECT t.id, t.dates, t.streak_count
       FROM tahajjud_tracker t, UNNEST(t.dates) as date
       WHERE t.user_id = $1 AND date >= $2::date AND date <= $3::date`,
      [user_id, startOfWeek.format('YYYY-MM-DD'), endOfWeek.format('YYYY-MM-DD')]
    )

    const uniqueHistoryRecords = {}
    historyResult.rows.forEach((record) => {
      if (!uniqueHistoryRecords[record.id]) uniqueHistoryRecords[record.id] = record
    })

    res.json({
      message: 'Tahajjud history retrieved successfully',
      historyRecords: Object.values(uniqueHistoryRecords),
      week: { start: startOfWeek.format('YYYY-MM-DD'), end: endOfWeek.format('YYYY-MM-DD') },
    })
  } catch (error) {
    console.error('Error retrieving Tahajjud history:', error)
    res.status(500).json({ message: 'Failed to retrieve Tahajjud history', error: error.message })
  }
})

// @desc Check if Tahajjud is recorded for today
// @route GET /murajaah/tahajjud/check_today_completion?user_id=1
router.get('/tahajjud/check_today_completion', async (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  try {
    const currentDate = moment().format('YYYY-MM-DD')
    const result = await pool.query(
      'SELECT 1 FROM tahajjud_tracker WHERE user_id = $1 AND $2 = ANY(dates) LIMIT 1',
      [user_id, currentDate]
    )

    res.json({ isCompleted: result.rows.length > 0 })
  } catch (err) {
    console.error("Error checking today's Tahajjud completion:", err)
    res.status(500).json({ message: "Server error while checking today's Tahajjud completion" })
  }
})


// @desc Send reminder email
// @route POST /murajaah/sendtext
router.post('/sendtext', async (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  try {
    const highlightedSurahsResponse = await fetch(
      `${process.env.HOST}/murajaah/highlightedsurahs?user_id=${user_id}`
    )
    const highlightedSurahs = await highlightedSurahsResponse.json()
    const topSurahs = Array.isArray(highlightedSurahs) ? highlightedSurahs.slice(0, 2) : []

    const surahMessage =
      topSurahs.length > 0
        ? `Rak’ah 1: ${topSurahs[0]?.chapter_name || 'No Surah Available'}\nRak’ah 2: ${
            topSurahs[1]?.chapter_name || 'No Surah Available'
          }`
        : 'No highlighted Surahs available.'

    const finalMessage = `
Muraja’ah Reminder

${surahMessage}

Please recite the Surahs above in your next Fard prayer.

Once you have completed the recitation, kindly update your status in the Muraja’ah Tracker.
    `.trim()

    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_MAIL,
      port: process.env.SMTP_PORT,
      secure: true,
      auth: {
        user: process.env.YAHOO_MAIL,
        pass: process.env.YAHOO_APP_PASSWORD,
      },
    })

    const mailOptions = {
      from: '"Muraja’ah Reminder" <nur_aiman71099@yahoo.com>',
      to: 'nur_aiman71099@yahoo.com',
      subject: 'Muraja’ah Reminder for Your Next Prayer',
      text: finalMessage,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('✅ Message sent:', info.messageId)

    res.status(200).json({ message: 'Email sent successfully', highlightedSurahs })
  } catch (error) {
    console.error('❌ Error fetching Surahs or sending email:', error)
    res.status(500).json({ message: 'Server Error' })
  }
})


// @desc Get highlighted Surahs
// @route GET /murajaah/highlightedsurahs?user_id=1
router.get('/highlightedsurahs', async (req, res) => {
  const user_id = getUserId(req)
  if (!user_id) return res.status(400).json({ message: 'user_id is required' })

  try {
    const result = await pool.query('SELECT * FROM memorized_surah WHERE user_id = $1', [user_id])
    const surahs = result.rows

    if (!surahs.length) return res.status(200).json([])

    const maxMurajaahCount = Math.max(...surahs.map((s) => s.murajaah_counter || 0))

    const highlightedSurahs = surahs
      .filter((s) => (s.murajaah_counter || 0) < maxMurajaahCount && s.id !== 2 && s.id !== 18)
      .sort((a, b) => a.id - b.id)

    res.status(200).json(highlightedSurahs)
  } catch (error) {
    console.error('Error fetching highlighted Surahs:', error)
    res.status(500).json({ message: 'Server Error' })
  }
})

module.exports = router
