var express = require('express')
var router = express.Router()
const { query, pool } = require('../config/database')

router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' })
})

// @desc Add New Memorized Surah
// @route POST /murajaah/addsurah
// @access public
router.post('/addsurah', (req, res) => {
  const { id, chapter_name, total_verse, verse_memorized, juz } = req.body

  const query =
    'INSERT INTO memorized_surah (id, chapter_name, total_verse, verse_memorized, juz) VALUES ($1, $2, $3, $4, $5)'
  pool.query(
    query,
    [id, chapter_name, total_verse, verse_memorized, juz],
    (err, result) => {
      if (err) {
        console.error(err)
        res.status(500).send('Server Error')
      } else {
        res.status(201).json({ message: 'Inserted Successfully' })
      }
    }
  )
})

// @desc Get Surah List
// @route POST /murajaah/getmemorizedsurah
// @access public
router.get('/getmemorizedsurah', (req, res) => {
  const query = 'SELECT * FROM memorized_surah ORDER BY juz ASC, id ASC'
  pool.query(query, (err, result) => {
    if (err) {
      console.error(err)
      res.status(500).send('Server Error')
    } else {
      res.status(200).json(result.rows)
    }
  })
})

// @desc Add New Murajaah Record
// @route POST /murajaah/addmurajaah
// @access public
router.post('/addmurajaah', (req, res) => {
  const { surah_id } = req.body

  // Get the total number of memorized Surahs
  pool.query('SELECT COUNT(*) FROM memorized_surah', (err, countResult) => {
    if (err) {
      console.error(err)
      return res.status(500).send('Server Error')
    }

    const total_memorized = parseInt(countResult.rows[0].count)

    // Get the latest murajaah log
    pool.query(
      'SELECT * FROM murajaah_log ORDER BY date_time DESC LIMIT 1',
      (err, logResult) => {
        if (err) {
          console.error(err)
          return res.status(500).send('Server Error')
        }

        // Get current date and time
        const date_time = new Date().toISOString()

        let updatedSurahIds, completion_rate

        // If there is an existing log for today
        if (
          logResult.rows.length > 0 &&
          new Date(logResult.rows[0].date_time).toDateString() ===
            new Date(date_time).toDateString()
        ) {
          updatedSurahIds = [...logResult.rows[0].surah_id, surah_id]
          completion_rate = (updatedSurahIds.length / total_memorized) * 100

          // Update the existing log
          pool.query(
            'UPDATE murajaah_log SET surah_id = $1, date_time = $2, completion_rate = $3 WHERE id = $4',
            [updatedSurahIds, date_time, completion_rate, logResult.rows[0].id],
            (err) => {
              if (err) {
                console.error(err)
                return res.status(500).send('Server Error')
              }
              res.status(200).send('Updated Successfully')
            }
          )
        } else {
          updatedSurahIds = [surah_id]
          completion_rate = (updatedSurahIds.length / total_memorized) * 100

          // Insert a new log
          pool.query(
            'INSERT INTO murajaah_log (surah_id, date_time, completion_rate) VALUES ($1, $2, $3)',
            [updatedSurahIds, date_time, completion_rate],
            (err) => {
              if (err) {
                console.error(err)
                return res.status(500).send('Server Error')
              }
              res.status(201).send('Inserted Successfully')
            }
          )
        }
      }
    )
  })
})

// @desc Update Surah Details
// @route PUT /murajaah/updatesurah/:id
// @access public
router.put('/updatesurah/:id', (req, res) => {
  const { id, chapter_name, total_verse, verse_memorized, juz } = req.body
  const surahId = req.params.id

  const updateQuery = `
    UPDATE memorized_surah
    SET chapter_name = $1, total_verse = $2, verse_memorized = $3, juz = $4
    WHERE id = $5
  `

  pool.query(
    updateQuery,
    [chapter_name, total_verse, verse_memorized, juz, surahId],
    (err, result) => {
      if (err) {
        console.error(err)
        res.status(500).send('Server Error')
      } else {
        res.status(200).json({ message: 'Surah Updated Successfully' })
      }
    }
  )
})

// @desc Delete a Memorized Surah by ID
// @route DELETE /murajaah/deletesurah/:id
// @access public
router.delete('/deletesurah/:id', (req, res) => {
  const surahId = req.params.id

  const deleteQuery = 'DELETE FROM memorized_surah WHERE id = $1'

  pool.query(deleteQuery, [surahId], (err, result) => {
    if (err) {
      console.error(err)
      res.status(500).send('Server Error')
    } else {
      if (result.rowCount === 0) {
        res.status(404).json({ message: 'Surah Not Found' })
      } else {
        res.status(200).json({ message: 'Surah Deleted Successfully' })
      }
    }
  })
})

// @desc Get Murajaah Progress
// @route GET /murajaah/getmurajaahprogress
// @access public
router.get('/getmurajaahprogress', (req, res) => {
  const { date } = req.query
  console.log(date)

  pool.query(
    'SELECT * FROM murajaah_log WHERE DATE(date_time) = $1',
    [date],
    (err, result) => {
      if (err) {
        console.error(err)
        res.status(500).send('Server Error')
      } else {
        res.status(200).json(result.rows)
      }
    }
  )
})

module.exports = router
