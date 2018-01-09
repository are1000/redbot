const Telegraf = require('telegraf')
const bot = new Telegraf(process.env.TELEGRAM_TOKEN)

module.exports = function run (db, emoji) {
  console.log(`[bot] Starting!`)

  bot.start(ctx => {
    console.log(`[bot] Joined ${ctx.from.id}`)
    return ctx.reply(`Hi folks! ${emoji.get('wave')} I'm a bot that transcribes messages from Telegram into a special website, that allows people from our community that doesn't have Telegram, to be up to date ${emoji.get('sparkles')} Please message me privately if you need any /help (or don't want your messages to be transcribed).`)
  })

  bot.command('help', ctx => {
    return ctx.replyWithMarkdown(`Hi! I'm a bot that transcribes messages from Telegram into a special website, that allows people from our community to be up to date with latest news.

  If you don't want your messages to be transcribed, you can always opt-out (although you have to remember, that this may result in incomplete logs). To do this, just message /optout. You can reverse this by messaging me /optin.

  *Please remember*, that not anyone can read the transcript - to do this you need to authenticate using GitHub.

  If you want a single message to not be recorded *at all*, just put \`[!]\` in the beginning. This will prevent me from saving it.`)
  })

  bot.command('policy', ctx => {
    let text = ctx.update.message.text.split(' ').slice(1)
    let pid = `policy.${ctx.from.id}`

    let policy = db.get(pid).value()

    if (!policy) {
      db.set(pid, [])
        .write()
    }

    policy = db.get(pid).value()

    if (text.length === 0) {
      if (policy.length) {
        return ctx.reply(`Your current policy is set to: ${policy.join(' ')}`)
      } else {
        return ctx.reply(`You have no policies set.`)
      }
    } else {
      if (text[0] === 'none') {
        db.set(pid, []).write()
      } else {
        db.set(pid, text).write()
      }
    }


    return ctx.reply(`ok`)
  })

  bot.on('message', ctx => {
    let { text } = ctx.message

    if (text && !text.startsWith('[!]')) {
      db.get('messages')
        .push(ctx.message)
        .write()
    }
  })

  bot.startPolling()
}
