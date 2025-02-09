const express = require('express');
const router = express.Router();
const axios = require('axios');
const moment = require('moment-timezone');
const nodemailer = require('nodemailer');
const cron = require('node-cron'); 


const sendMurajaahEmail = async () => {
  try {

    const highlightedSurahsResponse = await fetch(`${process.env.HOST}/murajaah/highlightedsurahs`);
    const highlightedSurahs = await highlightedSurahsResponse.json();

  
    console.log('🔹 Highlighted Surahs:', highlightedSurahs);


    const topSurahs = highlightedSurahs.slice(0, 2);

 
    const surahMessage = topSurahs.length > 0
      ? `Rak’ah 1: ${topSurahs[0]?.chapter_name || "No Surah Available"}\nRak’ah 2: ${topSurahs[1]?.chapter_name || "No Surah Available"}`
      : "No highlighted Surahs available.";


    const finalMessage = `
Muraja’ah Reminder

${surahMessage}

Please recite the Surahs above in your next Fard prayer.

Once you have completed the recitation, kindly update your status in the Muraja’ah Tracker.

Murajaah Tracker : https://murajaah-tracker.onrender.com/
    `;


    let transporter = nodemailer.createTransport({
      host: 'smtp.mail.yahoo.com',
      port: 465, 
      secure: true,
      auth: {
        user: process.env.YAHOO_MAIL,                   
        pass: process.env.YAHOO_APP_PASSWORD            
      },
    });


    const mailOptions = {
      from: '"Muraja’ah Reminder" <nur_aiman71099@yahoo.com>',
      to: 'nur_aiman71099@yahoo.com',
      subject: 'Muraja’ah Reminder for Your Next Prayer',
      text: finalMessage, 
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Scheduled Email Sent:', info.messageId);
  } catch (error) {
    console.error('❌ Error fetching Surahs or sending email:', error);
  }
};


const getPrayerTimes = async () => {
  try {
    const response = await axios.get('https://api.aladhan.com/v1/timingsByCity?city=Kuala%20Lumpur&country=Malaysia&method=3');
    const prayerTimes = response.data.data.timings;

    return {
      fajr: prayerTimes.Fajr.split(':')[0] + ":" + prayerTimes.Fajr.split(':')[1],    
      dhuhr: prayerTimes.Dhuhr.split(':')[0] + ":" + prayerTimes.Dhuhr.split(':')[1],  
      asr: prayerTimes.Asr.split(':')[0] + ":" + prayerTimes.Asr.split(':')[1],     
      maghrib: prayerTimes.Maghrib.split(':')[0] + ":" + prayerTimes.Maghrib.split(':')[1], 
      isha: prayerTimes.Isha.split(':')[0] + ":" + prayerTimes.Isha.split(':')[1]   
    };
  } catch (error) {
    console.error("❌ Error fetching prayer times:", error);
    return null;
  }
};


const schedulePrayerEmails = async () => {
  const prayerTimes = await getPrayerTimes();
  if (!prayerTimes) return;

  const { fajr, dhuhr, asr, maghrib, isha } = prayerTimes;

  console.log(`🕌 Scheduled Muraja’ah Reminder Emails at Prayer Times (Malaysia/Kuala Lumpur):`);
  console.log(`🕋 Fajr: ${fajr}`);
  console.log(`🕋 Dhuhr: ${dhuhr}`);
  console.log(`🕋 Asr: ${asr}`);
  console.log(`🕋 Maghrib: ${maghrib}`);
  console.log(`🕋 Isha: ${isha}`);

 
  cron.schedule(`0 ${fajr.split(':')[1]} ${fajr.split(':')[0]} * * *`, sendMurajaahEmail, { timezone: 'Asia/Kuala_Lumpur' });
  cron.schedule(`0 ${dhuhr.split(':')[1]} ${dhuhr.split(':')[0]} * * *`, sendMurajaahEmail, { timezone: 'Asia/Kuala_Lumpur' });
  cron.schedule(`0 ${asr.split(':')[1]} ${asr.split(':')[0]} * * *`, sendMurajaahEmail, { timezone: 'Asia/Kuala_Lumpur' });
  cron.schedule(`0 ${maghrib.split(':')[1]} ${maghrib.split(':')[0]} * * *`, sendMurajaahEmail, { timezone: 'Asia/Kuala_Lumpur' });
  cron.schedule(`0 ${isha.split(':')[1]} ${isha.split(':')[0]} * * *`, sendMurajaahEmail, { timezone: 'Asia/Kuala_Lumpur' });
};


schedulePrayerEmails();

// @desc Trigger email manually via API
// @route POST /sendtext
// @access public
router.post('/sendtext', async (req, res) => {
  try {
    await sendMurajaahEmail();
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
