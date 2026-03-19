import { Telegraf } from 'telegraf';

const BOT_TOKEN = process.env.BOT_TOKEN;
// Use the same URL variable naming as the web app envs when possible.
// This prevents “Играть” from pointing to a stale localhost when only VITE_BASE_URL is set.
const BASE_URL = (process.env.VITE_BASE_URL || process.env.BASE_URL || 'http://localhost:5173').replace(/\/$/, '');

if (!BOT_TOKEN) {
  console.error('Set BOT_TOKEN in .env');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  const startPayload = ctx.startPayload?.trim(); // deep link: t.me/bot?start=inv_XXXX
  const appUrl = startPayload
    ? `${BASE_URL}?invite=${encodeURIComponent(startPayload)}`
    : BASE_URL;
  return ctx.reply('Игровой хаб', {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: startPayload ? 'Присоединиться к игре' : 'Играть',
            web_app: { url: appUrl },
          },
        ],
      ],
    },
  });
});

bot.launch().then(() => console.log('Bot running'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
