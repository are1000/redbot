require('dotenv').config()

const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const path = require('path')
const fs = require('fs')
const util = require('util')

const emoji = require('node-emoji')
const adapter = new FileSync('db.json')
const db = low(adapter)

db.defaults({ messages: [], policy: {}, logins: [] }).write()

const Koa = require('koa')
const Router = require('koa-router')
const bodyParser = require('koa-bodyparser')
const ejs = require('ejs')
const fetch = require('node-fetch')
const session = require('koa-session')

const runBot = require('./bot.js')

const readFile = util.promisify(fs.readFile)

const app = new Koa()
const router = new Router()

app.use(async (ctx, next) => {
  try {
    await next()
  } catch (err) {
    console.log(err)
    ctx.body = err.message
  }
})

app.use(async (ctx, next) => {
  ctx.render = async function (template, data) {
    let dtemp = await readFile(path.join(__dirname, `views/${template}.html`), 'utf8')
    let temp = await readFile(path.join(__dirname, `views/template.html`), 'utf8')
    let d = ejs.render(dtemp, Object.assign({ emoji: emoji }, data))
    let t = ejs.render(temp, { body: d, session: ctx.session, client_id: process.env.GITHUB_CLIENT_ID, emoji: emoji })

    ctx.body = t

    return t
  }

  ctx.db = db

  await next()
})

app.use(bodyParser())

app.keys = [ process.env.SERVER_SECRET ]

app.use(session({
  key: 'redbot:sess'
}, app))

router.get('/', async ctx => {
  if (ctx.session.user) {
    let messages = db.get('messages').sort('date').filter(message => {
      if (message.chat.type === "private") {
        return false
      }


      return true
    })

    await ctx.render('transcript', {
      username: ctx.session.user.login,
      messages: messages.groupBy('chat.id').value(),
      groups: messages.map('chat').uniqBy('id').value()
    })
  } else {
    await ctx.render('index', { client_id: process.env.GITHUB_CLIENT_ID })
  }
})

router.get('/logout', async ctx => {
  ctx.session = null

  ctx.redirect('/')
})

router.get('/help', async ctx => {
  await ctx.render('help')
})

router.get('/github', async ctx => {
  let result = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code: ctx.query.code
    }),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  })

  let data = await result.json()

  if (data.error) {
    await ctx.render('error', { error: data.error_description })
    return
  }

  let userResult = await fetch('https://api.github.com/user?access_token=' + data.access_token)
  let user = await userResult.json()

  if (user.error) {
    await ctx.render('error', { error: user.error_description })
    return
  }

  ctx.session.user = user

  db.get('logins')
    .push(Object.assign(user, { _loggedInAt: Date.now() }))
    .write()

  ctx.redirect('/')
})

app.use(router.routes())
app.use(router.allowedMethods())

app.listen(8083)

runBot(db, emoji)
