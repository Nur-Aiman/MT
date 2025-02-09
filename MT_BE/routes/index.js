var express = require('express')
var router = express.Router()

/* GET home page. */

router.get('/', function checkStatus(req, res) {
  res.status(200).json({ status: 'murajaah tracker apps status : OK' })
})

module.exports = router
