'use strict'

/* plugin manager */

const path = require('path')
const emoji = require('../emoji')
const coreSymbols = require('../core-symbols')
const Rq = require('./requirements')

let pluginList
let pluginSet
let bot

exports.disable = async (chatid, names) => {
    if (typeof names === 'string') {
        names = [names]
    }
    names = names.map(name => name.toLowerCase())
    for (var name of names) {
        if (name === 'plugins') {
            throw new Error("I won't disable myself")
        }
        if (!pluginSet.has(name)) {
            throw new Error(`Unknown plugin: ${name}`)
        }
    }
    return bot.db.sadd(`chat${chatid}:disabledPlugins`, names)
}

exports.enable = async (chatid, names) => {
    if (typeof names === 'string') {
        names = [names]
    }
    names = names.map(name => name.toLowerCase())
    for (var name of names) {
        if (!pluginSet.has(name)) {
            throw new Error(`Unknown plugin: ${name}`)
        }
    }
    return bot.db.srem(`chat${chatid}:disabledPlugins`, names)
}


exports.isDisabled = (chatid, name) => bot.db.sismember(`chat${chatid}:disabledPlugins`, name.toLowerCase())

exports.pathToName = (path_) => path.basename(path_, path.extname(path_))

exports.init = (bot_, prefs) => {
    bot = bot_

    // because some plugins might not have been initialized yet
    setImmediate(() => {
        const failedList = bot.control.config.plugins
            .filter(plugin => plugin[coreSymbols.error])
            .map(plugin => exports.pathToName(plugin.path))

        exports.failed = new Set(failedList)

        Object.freeze(exports)
    })


    pluginList = exports.list = bot.control.config.plugins
        .filter(plugin => !plugin.essential)
        .map(plugin => exports.pathToName(plugin.path))
        .filter(name => name != 'plugins')
        .sort()

    pluginSet = exports.set = new Set(pluginList)

    bot.register.command('plugins', {
        help: [
            `Lists configurable plugins and their status in this chat:`,
            ``,
            `${emoji.get('white_check_mark')} -- enabled`,
            `${emoji.get('x')} -- disabled`,
            `${emoji.get('warning')} -- failed to load. It's our fault, not yours.`,
        ].join('\n'),
        fn: msg => {
            bot.db.pipeline(
                pluginList.map(name => ['sismember', `chat${msg.chat.id}:disabledPlugins`, name])
            ).exec()
            .map(([, disabled], i) => (
                disabled
                    ? emoji.get('x')
                : exports.failed.has(pluginList[i])
                    ? emoji.get('warning')
                    : emoji.get('white_check_mark')
                ) + ' ' + pluginList[i]
            )
            .then(array => msg.reply.text(array.join('\n')))
        }
    })


    bot.register.command('disable', {
        fn: Rq.wrap(Rq.callerHasPermission('can_change_info'), msg => {
            if (!msg.args) {
                return 'Give me name of a plugin to disable.'
            }
            const plugins = msg.args.split(/\s+/g)
            exports.disable(msg.chat.id, plugins)
                .then((number) => `${number} plugins disabled.`)
                .catch(e => e.message)
                .then(msg.reply.text)
            })
    })

    bot.register.command('enable', {
        fn: Rq.wrap(Rq.callerHasPermission('can_change_info'), msg => {
            if (!msg.args) {
                return 'Give me name of a plugin to enable.'
            }
            const plugins = msg.args.split(/\s+/g)
            exports.enable(msg.chat.id, plugins)
                .then((number) => `${number} plugins enabled.`)
                .catch(e => e.message)
                .then(msg.reply.text)
            })
    })
}
