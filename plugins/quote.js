'use strict';

const id = require('./id');

exports.init = (bot, prefs) => {
    const deleteAndRetry = [
        "Bad Request: message to forward not found",
        "Forbidden: bot was kicked from the supergroup chat",
    ];

    bot.register.command('savequote', {
        help: [
            "Reply to a message to save it as quote. It may then randomly appear when /quote is used.",
        ].join('\n'),
        fn: (msg) => {
            if (!msg.reply_to_message) {
                return "Reply to a message you'd like to save";
            }
            if (msg.from.id === msg.reply_to_message.from.id) {
                return "You cannot save your own message, someone else must find it worthwhile";
            }
            const entry = JSON.stringify({
                chat: msg.chat.id,
                msg: msg.reply_to_message.message_id,
            })
            bot.db.sadd(`chat${msg.chat.id}:quotes`, entry);
            bot.db.sadd(`chat${msg.reply_to_message.from.id}:quotes`, entry);
            return `Quote saved. Use /quote to retrieve a random quote.`;
        }
    });
    bot.register.command('quote', {
        help: [
            "Get a random quote of person specified as argument (by id or username), replied-to person, or someone random from this chat.",
            "Reply to message with /savequote to save it as possible quote.",
        ].join('\n'),
        fn: async msg => {
            let target = (await id.getTarget(msg) || msg.chat).id;

            while (true) {
                const rawEntry = await bot.db.srandmember(`chat${target}:quotes`);
                if (rawEntry) {
                    const entry = JSON.parse(rawEntry);
                    try {
                        return await bot.api.forwardMessage(msg.chat.id, entry.chat, entry.msg);
                    } catch (e) {
                        if (deleteAndRetry.includes(e.description)) {
                            await bot.db.srem(`chat${target}:quotes`, rawEntry);
                        } else {
                            throw e;
                        }
                    }
                } else {
                    return msg.reply.text('No quotes. Reply to a message with /savequote first.');
                }
            }
        }
    });
};
