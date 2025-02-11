const { Bot, InlineKeyboard } = require('grammy');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Variáveis de ambiente
const BOT_TOKEN = process.env.BOT_TOKEN;  // Variável de ambiente no Railway
const CHANNEL_ID = process.env.CHANNEL_ID;  // Variável de ambiente no Railway
const CATALOG_PATH = path.join(__dirname, 'catalog2.json');

// Inicializa o bot
const bot = new Bot(BOT_TOKEN);

// Carregar catálogo JSON
function loadCatalog() {
    try {
        return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    } catch (error) {
        console.error("Erro ao carregar catálogo:", error);
        return {};
    }
}

const catalog = loadCatalog();

// Função para verificar a participação do usuário no canal
async function isUserInChannel(userId) {
    try {
        const response = await bot.api.getChatMember(CHANNEL_ID, userId);
        return response.status !== 'left';  // Verifica se o usuário está no canal
    } catch (error) {
        console.error("Erro ao verificar participação no canal:", error);
        return false;
    }
}

// Função para obter a foto do perfil do canal
async function getChannelPhoto(channelId) {
    try {
        const photoPath = path.join(__dirname, `channel_photo_${channelId}.jpg`);
        await bot.api.downloadFile(channelId, photoPath);
        return photoPath;
    } catch (error) {
        console.error("Erro ao obter foto do canal:", error);
        return null;
    }
}

// Comando /start
bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    console.log(`Recebido /start de ${userId}`);

    if (!(await isUserInChannel(userId))) {
        await ctx.reply(
            "⚠️ Você não tem permissão para acessar este bot. Por favor, entre no canal para obter acesso."
        );
        return;
    }

    const categorias = catalog.Categorias || {};
    if (Object.keys(categorias).length === 0) {
        await ctx.reply("⚠️ O catálogo está vazio ou não foi carregado corretamente.");
        return;
    }

    const keyboard = new InlineKeyboard();
    Object.keys(categorias).forEach(category => {
        keyboard.text(category, `cat:${category}`);
    });

    await ctx.reply("Selecione uma categoria:", { reply_markup: keyboard });
});

// Lidar com o clique de botão de categoria
bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const userId = ctx.from.id;

    if (!(await isUserInChannel(userId))) {
        await ctx.answerCallbackQuery("⚠️ Você não tem permissão para acessar este bot.", { alert: true });
        return;
    }

    if (data.startsWith('cat:')) {
        const category = data.split(':')[1];
        const subcategories = catalog.Categorias[category] || {};

        if (Object.keys(subcategories).length === 0) {
            await ctx.answerCallbackQuery(`Nenhuma subcategoria encontrada em ${category}.`, { alert: true });
            return;
        }

        const keyboard = new InlineKeyboard();
        Object.keys(subcategories).forEach(subcategory => {
            keyboard.text(subcategory, `subcat:${category}:${subcategory}`);
        });

        keyboard.text("🔙 Voltar", "back_to_categories");
        keyboard.text("🏠 Menu", "go_to_menu");

        await ctx.editMessageText(`Selecione uma subcategoria de ${category}:`, { reply_markup: keyboard });
    } else if (data.startsWith('subcat:')) {
        const [_, category, subcategory] = data.split(':');
        const channels = catalog.Categorias[category][subcategory] || [];

        if (channels.length === 0) {
            await ctx.answerCallbackQuery(`Nenhum canal encontrado em ${subcategory}.`, { alert: true });
            return;
        }

        const keyboard = new InlineKeyboard();
        channels.forEach(channel => {
            keyboard.text(channel.name, `channel:${category}:${subcategory}:${channel.link}`);
        });

        keyboard.text("🔙 Voltar a SubCategoria", `cat:${category}`);
        keyboard.text("🏠 Menu", "go_to_menu");

        await ctx.editMessageText(`Selecione um canal de ${subcategory}:`, { reply_markup: keyboard });
    } else if (data.startsWith('channel:')) {
        const [_, category, subcategory, channelLink] = data.split(':');

        try {
            const expireDate = Math.floor(Date.now() / 1000) + 120;  // Link expira em 2 minutos
            const inviteLink = `https://t.me/${channelLink}?start=1`; // Exemplo de link de convite

            const channelPhoto = await getChannelPhoto(channelLink);

            const buttons = [
                { text: "📎 Acessar Canal", url: inviteLink },
                { text: "🔙 Voltar", callback_data: `subcat:${category}:${subcategory}` },
                { text: "🏠 Menu", callback_data: "go_to_menu" }
            ];

            if (channelPhoto) {
                await ctx.replyWithPhoto({ source: channelPhoto }, { caption: "O Link Expira em 2 minutos.", reply_markup: { inline_keyboard: buttons } });
                fs.unlinkSync(channelPhoto);  // Apaga a foto após o envio
            } else {
                await ctx.reply("O Link Expira em 2 minutos.", { reply_markup: { inline_keyboard: buttons } });
            }
        } catch (error) {
            console.error("Erro ao gerar o link de convite:", error);
            await ctx.reply("Erro ao criar o link de convite.");
        }
    } else if (data === 'back_to_categories') {
        const categorias = catalog.Categorias || {};
        const keyboard = new InlineKeyboard();
        Object.keys(categorias).forEach(category => {
            keyboard.text(category, `cat:${category}`);
        });
        await ctx.editMessageText("Selecione uma categoria:", { reply_markup: keyboard });
    } else if (data === 'go_to_menu') {
        const categorias = catalog.Categorias || {};
        const keyboard = new InlineKeyboard();
        Object.keys(categorias).forEach(category => {
            keyboard.text(category, `cat:${category}`);
        });
        await ctx.editMessageText("Selecione uma categoria:", { reply_markup: keyboard });
    }
});

// Inicia o bot
console.log("Bot está rodando...");
bot.start();
