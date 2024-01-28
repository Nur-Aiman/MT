var express = require('express')
var router = express.Router()
const moment = require('moment-timezone')
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
  const { surah_id } = req.body;

  // Get the total number of memorized Surahs
  pool.query('SELECT COUNT(*) FROM memorized_surah', (err, countResult) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Server Error');
    }

    const total_memorized = parseInt(countResult.rows[0].count);
    const date_time = moment.tz('Asia/Kuala_Lumpur').format();
    const currentDate = moment.tz('Asia/Kuala_Lumpur').format('YYYY-MM-DD');

    // Update murajaah_counter
    pool.query(
      'UPDATE memorized_surah SET murajaah_counter = murajaah_counter + 1 WHERE id = $1',
      [surah_id],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Error updating murajaah counter');
        }

        // Get the latest murajaah log
        pool.query(
          'SELECT * FROM murajaah_log ORDER BY date_time DESC LIMIT 1',
          (err, logResult) => {
            if (err) {
              console.error(err);
              return res.status(500).send('Server Error');
            }

            let updatedSurahIds, completion_rate;

            // If there is an existing log for today
            if (logResult.rows.length > 0) {
              const logDate = moment
                .tz(logResult.rows[0].date_time, 'Asia/Kuala_Lumpur')
                .format('YYYY-MM-DD');

              if (logDate === currentDate) {
                updatedSurahIds = [...logResult.rows[0].surah_id, surah_id];
                completion_rate = (updatedSurahIds.length / total_memorized) * 100;

                // Update the existing log
                pool.query(
                  'UPDATE murajaah_log SET surah_id = $1, date_time = $2, completion_rate = $3 WHERE id = $4',
                  [
                    updatedSurahIds,
                    date_time,
                    completion_rate,
                    logResult.rows[0].id,
                  ],
                  (err) => {
                    if (err) {
                      console.error(err);
                      return res.status(500).send('Server Error');
                    }
                    res.status(200).send('Updated Successfully');
                  }
                );
              } else {
                insertNewLog();
              }
            } else {
              insertNewLog();
            }

            function insertNewLog() {
              updatedSurahIds = [surah_id];
              completion_rate = (updatedSurahIds.length / total_memorized) * 100;

              // Insert a new log
              pool.query(
                'INSERT INTO murajaah_log (surah_id, date_time, completion_rate) VALUES ($1, $2, $3)',
                [updatedSurahIds, date_time, completion_rate],
                (err) => {
                  if (err) {
                    console.error(err);
                    return res.status(500).send('Server Error');
                  }
                  res.status(201).send('Inserted Successfully');
                }
              );
            }
          }
        );
      }
    );
  });
});

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

// @desc Get Weekly Murajaah Progress
// @route GET /murajaah/getweeklymurajaahprogress
// @access public
router.get('/getweeklymurajaahprogress', (req, res) => {
  const { date } = req.query

  if (!date) {
    return res.status(400).send('Please provide a date to determine the week.')
  }

  const startOfGivenWeek = moment(date).startOf('week').tz('Asia/Kuala_Lumpur')
  const endOfGivenWeek = moment(date).endOf('week').tz('Asia/Kuala_Lumpur')

  const weekData = {
    Sunday: { day: startOfGivenWeek.clone().format(), rate: '0.00' },
    Monday: {
      day: startOfGivenWeek.clone().add(1, 'days').format(),
      rate: '0.00',
    },
    Tuesday: {
      day: startOfGivenWeek.clone().add(2, 'days').format(),
      rate: '0.00',
    },
    Wednesday: {
      day: startOfGivenWeek.clone().add(3, 'days').format(),
      rate: '0.00',
    },
    Thursday: {
      day: startOfGivenWeek.clone().add(4, 'days').format(),
      rate: '0.00',
    },
    Friday: {
      day: startOfGivenWeek.clone().add(5, 'days').format(),
      rate: '0.00',
    },
    Saturday: { day: endOfGivenWeek.clone().format(), rate: '0.00' },
  }

  const query = `
      SELECT 
          DATE(date_time) AS day, 
          AVG(completion_rate) AS average_completion_rate
      FROM murajaah_log 
      WHERE DATE(date_time) BETWEEN $1 AND $2
      GROUP BY DATE(date_time)
      ORDER BY DATE(date_time) ASC
  `

  pool.query(
    query,
    [
      startOfGivenWeek.format('YYYY-MM-DD'),
      endOfGivenWeek.format('YYYY-MM-DD'),
    ],
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
// @route POST /sabaqtracker/add
// @access public
router.post('/sabaqtracker/add', (req, res) => {
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

  // Check if an entry with the same values exists for the current day
  pool.query(
    'SELECT * FROM sabaq_tracker WHERE date = $1 AND chapter_number = $2 AND chapter_name = $3 AND page = $4 AND section = $5 AND verse = $6',
    [currentDate, chapter_number, chapter_name, page, section, verse],
    (err, result) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ message: 'Server Error' })
      }

      if (result.rows.length > 0) {
        // Update the existing row
        pool.query(
          'UPDATE sabaq_tracker SET number_of_readings = $1, complete_memorization = $2, murajaah_20_times = $3 WHERE id = $4',
          [
            number_of_readings,
            complete_memorization,
            murajaah_20_times,
            result.rows[0].id,
          ],
          (err) => {
            if (err) {
              console.error(err)
              return res.status(500).json({ message: 'Server Error' })
            }
            res.status(200).json({ message: 'Updated Successfully' })
          }
        )
      } else {
        // Insert a new row
        pool.query(
          'INSERT INTO sabaq_tracker (date, chapter_number, chapter_name, page, section, verse, number_of_readings, complete_memorization, murajaah_20_times) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
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
// @route GET /sabaqtracker/latest
// @access public
router.get('/sabaqtracker/latest', (req, res) => {
  const query = 'SELECT * FROM sabaq_tracker ORDER BY id DESC LIMIT 1'

  pool.query(query, (err, result) => {
    if (err) {
      console.error(err)
      res.status(500).send('Server Error')
    } else {
      res.status(200).json(result.rows[0])
    }
  })
})

module.exports = router
