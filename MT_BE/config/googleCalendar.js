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
      const existingEventId = await this.findExistingEventForDate(eventDate)

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
   * Find existing event for a specific date
   */
  async findExistingEventForDate(eventDate) {
    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: moment(eventDate).startOf('day').toISOString(),
        timeMax: moment(eventDate).endOf('day').toISOString(),
        q: 'Murajaah',
      })

      if (response.data.items && response.data.items.length > 0) {
        const murajaahEvent = response.data.items.find((event) =>
          event.summary.includes('Murajaah')
        )
        return murajaahEvent ? murajaahEvent.id : null
      }

      return null
    } catch (error) {
      console.error('❌ Error finding existing event:', error.message)
      return null
    }
  }

  /**
   * Get the Juz number for a surah (1-30)
   * Based on traditional Juz divisions of the Quran
   */
  getJuzForSurah(surahId) {
    // Complete mapping of surah IDs to Juz numbers
    const surahToJuz = {
      1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 9,
      11: 11, 12: 12, 13: 13, 14: 13, 15: 14, 16: 14, 17: 15, 18: 16, 19: 16, 20: 16,
      21: 17, 22: 17, 23: 18, 24: 18, 25: 18, 26: 19, 27: 19, 28: 20, 29: 20, 30: 20,
      31: 21, 32: 21, 33: 21, 34: 21, 35: 22, 36: 22, 37: 22, 38: 23, 39: 23, 40: 24,
      41: 24, 42: 25, 43: 25, 44: 25, 45: 25, 46: 26, 47: 26, 48: 26, 49: 26, 50: 26,
      51: 26, 52: 27, 53: 27, 54: 27, 55: 27, 56: 27, 57: 27, 58: 28, 59: 28, 60: 28,
      61: 28, 62: 28, 63: 28, 64: 28, 65: 28, 66: 28, 67: 29, 68: 29, 69: 29, 70: 29,
      71: 29, 72: 29, 73: 29, 74: 29, 75: 29, 76: 29, 77: 29, 78: 30, 79: 30, 80: 30,
      81: 30, 82: 30, 83: 30, 84: 30, 85: 30, 86: 30, 87: 30, 88: 30, 89: 30, 90: 30,
      91: 30, 92: 30, 93: 30, 94: 30, 95: 30, 96: 30, 97: 30, 98: 30, 99: 30, 100: 30,
      101: 30, 102: 30, 103: 30, 104: 30, 105: 30, 106: 30, 107: 30, 108: 30, 109: 30, 110: 30,
      111: 30, 112: 30, 113: 30, 114: 30
    }
    
    return surahToJuz[surahId] || 30 // Default to Juz 30 if not found
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

    // Group surahs by Juz
    const surahsByJuz = {}
    surahDetails.forEach((surah) => {
      const juz = this.getJuzForSurah(surah.id)
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
