'use strict';

const util = require('util');

let bot;

exports.resolve = async (username) => {
    username = username.replace(/^@/, '').toLowerCase();
    const result = await bot.db.hget('usernames', username);
    if (result) {
        return JSON.parse(result);
    }
};

exports.registerChat = (chat) => {
    if (chat.type === 'private' || !chat.username) {
        return;
    }
    return bot.db.hset(
        'usernames',
        chat.username.toLowerCase(),
        JSON.stringify(chat)
    );
};

exports.registerUser = (user) => {
    if (!user.username) {
        return;
    }
    if (user.type && user.type !== 'private') {
        throw new Error;
    }
    user.type = "private"
    return bot.db.hset(
        'usernames',
        user.username.toLowerCase(),
        JSON.stringify(user)
    );
};

exports.registerMsg = (msg) => Promise.all([
    exports.registerChat(msg.chat),
    exports.registerUser(msg.from),
]);


exports.toUserId = async (username) => {
    const result = await exports.resolve(username);
    if (result && result.type === 'private') {
        return result.id;
    }
};

exports.toUser = async (username) => {;
    const result = await exports.resolve(username);
    if (result && result.type === 'private') {
        return result;
    }
};

exports.toId = async (username) => {
    const result = await exports.resolve(username);
    if (result) {
        return result.id;
    }
};

exports.getTarget = async (msg) => {
    if (msg.entities[1] && msg.entities[1].type === 'text_mention') {
        return msg.entities[1].user;
    } else if(msg.args) {
        if (/^-?\d+$/.test(msg.args)) {
            return {id: msg.args};
        } else {
            const target = await exports.resolve(msg.args);
            if (target) {
                return target;
            } else {
                throw new Error('Failed to resolve.');
            }
        }
    } else if (msg.reply_to_message) {
        return msg.reply_to_message.from;
    }
};

exports.init = (bot_, prefs) => {
    bot = bot_
    bot.api.on('text', exports.registerMsg)
    bot.register.command('id', {
        fn: async (msg) => {
            try {
                var target = (await exports.getTarget(msg)) || msg.chat;
            } catch (e) {
                msg.reply.text(e.message);
            }
            if (Object.keys(target).length === 1) {
                try {
                    target = (await bot.api.getChat(target.id)).result;
                } catch (e) {
                    msg.reply.text("I couldn't obtain any info about chat with this id.");
                    return;
                }
            }
            delete target.photo;
            msg.reply.text(util.format(target));
        }
    });
};
