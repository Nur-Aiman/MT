const { google } = require('googleapis')
const moment = require('moment-timezone')

class GoogleCalendarService {
  constructor() {
    this.calendar = null
    this.calendarId = null
    this.initialized = false
  }

  /**
   * Initialize Google Calendar with service account credentials from environment variable
   */
  async initialize() {
    try {
      if (this.initialized) return

      if (!process.env.GOOGLE_CREDENTIALS) {
        throw new Error(
          'GOOGLE_CREDENTIALS environment variable not set. ' +
            'Please set it with the service account JSON credentials.'
        )
      }

      let credentials
      try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)
      } catch (e) {
        throw new Error('GOOGLE_CREDENTIALS is not valid JSON: ' + e.message)
      }

      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      })

      this.calendar = google.calendar({ version: 'v3', auth })
      this.calendarId = await this.getCalendarIdByName(process.env.GOOGLE_CALENDAR_NAME || 'qk79io4u5ku7apiok8btsajc5k@group.calendar.google.com')

      this.initialized = true
      console.log('✅ Google Calendar initialized successfully')
    } catch (error) {
      console.error('❌ Error initializing Google Calendar:', error.message)
      throw error
    }
  }

  /**
   * Find calendar ID by name or validate direct calendar ID
   */
  async getCalendarIdByName(calendarName) {
    try {
      // If it looks like a calendar ID (ends with @group.calendar.google.com), use it directly
      if (calendarName.includes('@group.calendar.google.com') || calendarName.includes('@calendar.google.com')) {
        console.log(`✅ Using calendar ID directly: ${calendarName}`)
        return calendarName
      }

      if (!process.env.GOOGLE_CREDENTIALS) {
        throw new Error('GOOGLE_CREDENTIALS not set')
      }

      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS)

      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/calendar'],
      })

      const service = google.calendar({ version: 'v3', auth })
      const calendarList = await service.calendarList.list()

      const calendar = calendarList.data.items.find(
        (cal) => cal.summary === calendarName || cal.id === calendarName
      )

      if (!calendar) {
        throw new Error(`Calendar "${calendarName}" not found. Available calendars: ${calendarList.data.items.map((c) => c.summary).join(', ')}`)
      }

      return calendar.id
    } catch (error) {
      console.error('❌ Error finding calendar:', error.message)
      throw error
    }
  }

  /**
   * Create or update a murajaah event for a specific date
   * @param {number} userId - User ID
   * @param {string} eventDate - Date in YYYY-MM-DD format
   * @param {array} surahIds - Array of surah IDs reviewed
   * @param {array} surahDetails - Array of surah details {id, chapter_name, verse_memorized, total_verse}
   * @returns {object} - Event ID and event details
   */
  async createOrUpdateMurajaahEvent(userId, eventDate, surahIds, surahDetails) {
    try {
      if (!this.initialized) await this.initialize()

      // Check if event already exists for this date
      const existingEventId = await this.findExistingEventForDate(eventDate, userId, 'murajaah')

      // Build event description
      const description = this.buildEventDescription(surahDetails)

      // Calculate total verses for the summary
      let totalVerses = 0
      surahDetails.forEach((surah) => {
        totalVerses += surah.verse_memorized || 0
      })

      // Create event object with enhanced summary
      const event = {
        summary: `✅Murajaah - ${surahIds.length} surah(s) | ${totalVerses} verse(s)`,
        description: description,
        start: {
          date: eventDate, // All-day event
        },
        end: {
          date: moment(eventDate).add(1, 'day').format('YYYY-MM-DD'), // Google Calendar needs end date for all-day
        },
        transparency: 'transparent', // Don't block calendar time
        visibility: 'private',
        extendedProperties: {
          private: {
            userId: String(userId),
            eventType: 'murajaah',
            surahIds: surahIds.join(','),
            murajaahType: 'daily_revision',
          },
        },
      }

      let result
      if (existingEventId) {
        // Update existing event
        result = await this.calendar.events.update({
          calendarId: this.calendarId,
          eventId: existingEventId,
          requestBody: event,
        })
        console.log(`✅ Calendar event updated: ${existingEventId}`)
      } else {
        // Create new event
        result = await this.calendar.events.insert({
          calendarId: this.calendarId,
          requestBody: event,
        })
        console.log(`✅ Calendar event created: ${result.data.id}`)
      }

      return {
        eventId: result.data.id,
        eventLink: result.data.htmlLink,
        eventDate: eventDate,
      }
    } catch (error) {
      console.error('❌ Error creating/updating calendar event:', error.message)
      throw error
    }
  }

  /**
   * Create or update the user's daily Sabaq event.
   */
  async createOrUpdateSabaqEvent(userId, eventDate, sabaqRecords) {
    try {
      if (!this.initialized) await this.initialize()

      const existingEventId = await this.findExistingEventForDate(eventDate, userId, 'sabaq')
      const event = {
        summary: `Sabaq - ${sabaqRecords.length} portion(s)`,
        description: this.buildSabaqEventDescription(sabaqRecords),
        start: { date: eventDate },
        end: { date: moment(eventDate).add(1, 'day').format('YYYY-MM-DD') },
        transparency: 'transparent',
        visibility: 'private',
        extendedProperties: {
          private: {
            userId: String(userId),
            eventType: 'sabaq',
            recordCount: String(sabaqRecords.length),
          },
        },
      }

      return this.upsertDailyEvent(existingEventId, event, eventDate)
    } catch (error) {
      console.error('Error creating/updating Sabaq calendar event:', error.message)
      throw error
    }
  }

  /**
   * Create or update the user's daily Tilawah event.
   */
  async createOrUpdateTilawahEvent(userId, eventDate, tilawahDetails) {
    try {
      if (!this.initialized) await this.initialize()

      const existingEventId = await this.findExistingEventForDate(eventDate, userId, 'tilawah')
      const currentPage = Number(tilawahDetails.currentPage) || 1
      const event = {
        summary: `Tilawah - Page ${currentPage} / 604`,
        description: this.buildTilawahEventDescription(tilawahDetails),
        start: { date: eventDate },
        end: { date: moment(eventDate).add(1, 'day').format('YYYY-MM-DD') },
        transparency: 'transparent',
        visibility: 'private',
        extendedProperties: {
          private: {
            userId: String(userId),
            eventType: 'tilawah',
            currentPage: String(currentPage),
          },
        },
      }

      return this.upsertDailyEvent(existingEventId, event, eventDate)
    } catch (error) {
      console.error('Error creating/updating Tilawah calendar event:', error.message)
      throw error
    }
  }

  async upsertDailyEvent(existingEventId, event, eventDate) {
    let result
    if (existingEventId) {
      result = await this.calendar.events.update({
        calendarId: this.calendarId,
        eventId: existingEventId,
        requestBody: event,
      })
      console.log(`Calendar event updated: ${existingEventId}`)
    } else {
      result = await this.calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
      })
      console.log(`Calendar event created: ${result.data.id}`)
    }

    return {
      eventId: result.data.id,
      eventLink: result.data.htmlLink,
      eventDate,
    }
  }

  /**
   * Find existing event for a specific date
   */
  async findExistingEventForDate(eventDate, userId, eventType) {
    try {
      const timeMin = moment.tz(eventDate, 'Asia/Kuala_Lumpur').startOf('day').toISOString()
      const timeMax = moment.tz(eventDate, 'Asia/Kuala_Lumpur').endOf('day').toISOString()
      const propertyQueries = [
        [`userId=${userId}`, `eventType=${eventType}`],
      ]

      // Events created by the original Murajaah integration did not have eventType.
      if (eventType === 'murajaah') {
        propertyQueries.push([`userId=${userId}`, 'murajaahType=daily_revision'])
      }

      for (const privateExtendedProperty of propertyQueries) {
        const response = await this.calendar.events.list({
          calendarId: this.calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          privateExtendedProperty,
        })

        if (response.data.items && response.data.items.length > 0) {
          return response.data.items[0].id
        }
      }

      return null
    } catch (error) {
      console.error('❌ Error finding existing event:', error.message)
      throw error
    }
  }

  /**
   * Build descriptive text for the calendar event with Juz grouping
   */
  buildEventDescription(surahDetails) {
    if (!Array.isArray(surahDetails) || surahDetails.length === 0) {
      return 'Daily Quranic revision (Murajaah) completed.'
    }

    // Calculate total verses
    let totalVerses = 0
    surahDetails.forEach((surah) => {
      totalVerses += surah.verse_memorized || 0
    })

    // Group surahs by Juz from database
    const surahsByJuz = {}
    surahDetails.forEach((surah) => {
      const juz = surah.juz || 30 // Use juz from database, fallback to 30
      if (!surahsByJuz[juz]) {
        surahsByJuz[juz] = []
      }
      surahsByJuz[juz].push(surah)
    })

    // Build description
    let description = 'Murajaah :\n'

    // Add each Juz section
    Object.keys(surahsByJuz)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((juz) => {
        description += `\nJuz ${juz} :\n`
        // Sort surahs within each Juz by ID in ascending order
        surahsByJuz[juz]
          .sort((a, b) => a.id - b.id)
          .forEach((surah) => {
            const verses = surah.verse_memorized || 0
            const totalVerse = surah.total_verse || 0
            description += `${surah.id}) ${surah.chapter_name || `Surah ${surah.id}`} (Verses: ${verses} / ${totalVerse})\n`
          })
      })

    description += '\n' + '═'.repeat(50) + '\n'
    description += `Total Surahs: ${surahDetails.length}\n`
    description += `Total Verses: ${totalVerses}\n`

    return description
  }

  buildSabaqEventDescription(sabaqRecords) {
    if (!Array.isArray(sabaqRecords) || sabaqRecords.length === 0) {
      return 'Sabaq memorization activity completed.'
    }

    let description = 'Sabaq:\n'
    sabaqRecords.forEach((record, index) => {
      description += `\n${index + 1}. Surah ${record.chapter_number} - ${record.chapter_name}\n`
      description += `Page: ${record.page || '-'}\n`
      description += `Section(s): ${record.section || '-'}\n`
      description += `Verses: ${record.verse || '-'}\n`
      description += `Readings: ${Number(record.number_of_readings) || 0}\n`
      description += `Memorization complete: ${record.complete_memorization ? 'Yes' : 'No'}\n`
      description += `Murajaah repetitions: ${Number(record.murajaah_20_times) || 0} / 20\n`
    })

    return description.trim()
  }

  buildTilawahEventDescription(tilawahDetails) {
    const currentPage = Number(tilawahDetails.currentPage) || 1
    const previousPage = Number(tilawahDetails.previousPage) || 1
    const pagesProgressed = Math.max(0, currentPage - previousPage)
    const goalLabels = {
      once_month: 'Once a month',
      once_two_months: 'Every two months',
      free: 'Free pace',
    }

    let description = 'Tilawah:\n'
    description += `Current page: ${currentPage} / 604\n`
    description += `Starting page for the day: ${previousPage}\n`
    description += `Pages progressed today: ${pagesProgressed}\n`
    description += `Khatam goal: ${goalLabels[tilawahDetails.goalType] || 'Not set'}\n`

    if (Array.isArray(tilawahDetails.updates) && tilawahDetails.updates.length > 0) {
      description += '\nUpdates today:\n'
      tilawahDetails.updates.forEach((update) => {
        const time = moment(update.update_time).tz('Asia/Kuala_Lumpur').format('HH:mm')
        description += `- Page ${update.page_number} at ${time}\n`
      })
    }

    return description.trim()
  }
  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId) {
    try {
      if (!this.initialized) await this.initialize()

      await this.calendar.events.delete({
        calendarId: this.calendarId,
        eventId: eventId,
      })

      console.log(`✅ Calendar event deleted: ${eventId}`)
      return true
    } catch (error) {
      console.error('❌ Error deleting calendar event:', error.message)
      return false
    }
  }

  /**
   * Get event details
   */
  async getEvent(eventId) {
    try {
      if (!this.initialized) await this.initialize()

      const result = await this.calendar.events.get({
        calendarId: this.calendarId,
        eventId: eventId,
      })

      return result.data
    } catch (error) {
      console.error('❌ Error fetching calendar event:', error.message)
      return null
    }
  }
}

// Export singleton instance
module.exports = new GoogleCalendarService()
