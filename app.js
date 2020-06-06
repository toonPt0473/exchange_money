const Koa = require('koa')
const KoaRouter = require('koa-router')
const json = require('koa-json')
const bodyParser = require('koa-bodyparser')
// const request = require('request')
const axios = require('axios')
const _ = require('lodash')
require('dotenv').config()

const app = new Koa()
const router = new KoaRouter()

app.use(json())
app.use(bodyParser())

let rates = {}
let expireCache = null

router.post('/webhook', async ctx => {
  const replyToken = _.get(ctx, 'request.body.events[0].replyToken')
  if (Date.now() > expireCache) {
    const exchangeData = await axios.get(`http://data.fixer.io/api/latest?access_key=${process.env.API_EXCHANGE_KEY}`)
    rates = exchangeData.data.rates
    expireCache = Date.now() + (1000 * 60 * 10)
  }
  let message = _.get(ctx, 'request.body.events[0].message.text')
  message = message.toUpperCase().trim()
  const [inputCurrency, outputCurrency, amount] = formatMessage(message)
  const outputMessage = convertCurrency(inputCurrency, outputCurrency, amount)
  reply(replyToken, outputMessage)
  return ctx.status = 200
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(5555)

const formatMessage = (message) => {
  let inputCurrency = 'USD'
  let outputCurrency = 'THB'
  const isNumber = (text) => {
    return /^\d+$/.test(text)
  }
  if (isNumber(message)) {
    return [inputCurrency, outputCurrency, message]
  }
  const joinRates = `(${Object.keys(rates).join('|')})`
  const regexPattern = new RegExp(joinRates)
  const execMessage = regexPattern.exec(message)
  if (execMessage) {
    const restMessage = message.replace(/\s/gi, '').replace(execMessage[0], '')
    if (isNumber(restMessage)) {
      return [execMessage[0], outputCurrency, restMessage]
    }
    return [inputCurrency, outputCurrency, null]
  }
  return [inputCurrency, outputCurrency, null]
}

async function reply(reply_token, msg) {
  let headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`
  }
  let body = {
      replyToken: reply_token,
      messages: [{
          type: 'text',
          text: msg
      }]
  }
  axios.post('https://api.line.me/v2/bot/message/reply', body, {
      headers: headers
  })
}


function convertCurrency (input, output, amount) {
  if (rates[input] && amount) {
    const perEUR = rates[input]
    const EUR = +amount / perEUR
    return `${amount} ${input} = ${(rates[output] * EUR).toFixed(2)} บาท`
  }
  return 'ไม่สามารถแปลงค่าได้'
}