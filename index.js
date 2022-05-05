
require("dotenv").config();
const { MongoClient, ClientSession } = require("mongodb");
const uri = process.env.MONGODB


const Discord = require('discord.js');
const client = new Discord.Client({
    intents: [Discord.Intents.FLAGS.GUILDS]
});

const synchronizeSlashCommands = require('discord-sync-commands');
synchronizeSlashCommands(client, [
    {
        name: 'abonner',
        description: 'Abonnez-vous à une URL de recherche',
        options: [
            {
                name: 'url',
                description: 'L\'URL de la recherche Vinted',
                type: 3,
                required: true
            },
            {
                name: 'channel',
                description: 'Le salon dans lequel vous souhaitez envoyer les notifications',
                type: 7,
                required: true
            }
        ]
    },
    {
        name: 'désabonner',
        description: 'Désabonnez-vous d\'une URL de recherche',
        options: [
            {
                name: 'id',
                description: 'L\'identifiant de l\'abonnement (/abonnements)',
                type: 3,
                required: true
            }
        ]
    },
    {
        name: 'abonnements',
        description: 'Accèdez à la liste de tous vos abonnements',
        options: []
    }
], {
    debug: false,


}).then((stats) => {
    console.log(`🔁 Commandes mises à jour ! ${stats.newCommandCount} commandes créées, ${stats.currentCommandCount} commandes existantes\n`)
});

const vinted = require('vinted-api');

let lastFetchFinished = true;

const syncSubscription = async (sub) => {
    return new Promise((resolve) => {

        vinted.search(sub.url, false, false, {
            per_page: '20'
        }).then((res) => {

            if (!res.items) {
                console.log(res)
                console.log('Search done bug got wrong response. Promise resolved.', res);
                resolve();
                return;
            }

            let isFirstSync = database.collection('is_first_sync').findOne({ id: { $exists: true } });
            isFirstSync = isFirstSync.id
            const lastItemTimestamp = sub.timestamp
            
            const items = res.items
                .sort((a, b) => b.photo.high_resolution.timestamp - a.photo.high_resolution.timestamp)
                .filter((item) => !lastItemTimestamp || item.photo.high_resolution.timestamp > lastItemTimestamp);

            if (!items.length) return void resolve();

            const newLastItemTimestamp = items[0].photo.high_resolution.timestamp;
            if (!lastItemTimestamp || newLastItemTimestamp > lastItemTimestamp) {
              database.collection('subscriptions').updateOne({ id: sub.id }, { $set: { timestamp: newLastItemTimestamp } })
            }


           
            const itemsToSend = ((lastItemTimestamp && !isFirstSync) ? items.reverse() : [items[0]]);
            
            for (let item of itemsToSend) {
               
                const embed = new Discord.MessageEmbed()
                    .setTitle(item.title)
                    .setURL(item.url)
                    .setImage(item.photo.url)
                    .setColor('#008000')
                    .setTimestamp(item.createdTimestamp)
                    .setFooter(`Article lié à la recherche : ${sub.id}`)
                    .addField('Taille', item.size_title || 'vide', true)
                    .addField('Prix', item.price || 'vide', true)
                client.channels.cache.get(sub.channelID).send({
                    embeds: [embed], components: [
                        new Discord.MessageActionRow()
                            .addComponents([
                                new Discord.MessageButton()
                                    .setLabel('Détails')
                                    .setURL(item.url)
                                    .setEmoji('🔎')
                                    .setStyle('LINK'),
                                new Discord.MessageButton()
                                    .setLabel('Acheter')
                                    .setURL(`https://www.vinted.fr/transaction/buy/new?source_screen=item&transaction%5Bitem_id%5D=${item.id}`)
                                    .setEmoji('💸')
                                    .setStyle('LINK')
                            ])
                    ]
                });
            }

            if (itemsToSend.length > 0) {
                console.log(`👕 ${itemsToSend.length} ${itemsToSend.length > 1 ? 'nouveaux articles trouvés' : 'nouvel article trouvé'} pour la recherche ${sub.id} !\n`)
            }

            resolve();
        }).catch((e) => {
            console.log(e)
            console.error('Search returned an error. Promise resolved.');
            resolve();
        });
    });
};

const sync = async () => {

    if (!lastFetchFinished) return;
    lastFetchFinished = false;

    // console.log(`🤖 Synchronisation à Vinted...\n`);

    var subscriptions = await database.collection('subscriptions').find().toArray()
    const promises = subscriptions.map((sub) => syncSubscription(sub));
    Promise.all(promises).then(() => {
        database.collection('is_first_sync').insertOne({ id: false })
        lastFetchFinished = true;
    });

};

client.on('ready', async () => {
    const clientMongo = new MongoClient(uri);
    client.application.commands.set([])
    await clientMongo.connect();
    database = clientMongo.db("Vinted")

    try {
        await database.createCollection('subscriptions')
        console.log("keywords")
    } catch (e) { }
    try {
        resultfirstSync = await database.createCollection('is_first_sync')

        if (typeof resultfirstSync.ok === 'undefined') {
            await database.collection('is_first_sync').insertOne({ id: true })
        }
        console.log("is_first_sync")
    } catch (e) { }

    console.log("Created database with success")
    console.log(`🔗 Connecté sur le compte de ${client.user.tag} !\n`);
    sync();
    setInterval(sync, 15000);


});

client.on('interactionCreate', async (interaction) => {

    if (!interaction.isCommand()) return;
    if (!process.env.ADMIN.includes(interaction.user.id)) return void interaction.reply(`:x: Vous ne disposez pas des droits pour effectuer cette action !`);


    switch (interaction.commandName) {
        case 'abonner': {
            let id = Math.random().toString(36).substring(7)
            await database.collection('subscriptions').insertOne({
                id: id,
                url: interaction.options.getString('url'),
                channelID: interaction.options.getChannel('channel').id,
                timestamp: null
            })
            interaction.reply(`:white_check_mark: Votre abonnement a été créé avec succès !\n**URL**: <${interaction.options.getString('url')}>\n**Salon**: <#${interaction.options.getChannel('channel').id}>\n**ID** : ${id}`);
            break;
        }
        case 'désabonner': {
            const subID = interaction.options.getString('id');
            array = await database.collection('subscriptions').find().toArray()

            var subscription = array.filter(function (sub) {
                if (sub.id == subID) return sub
            })[0]

            if (!subscription) {
                return void interaction.reply(':x: Aucun abonnement trouvé pour votre recherche...');
            }
            a = await database.collection('subscriptions').deleteOne({ "id": subscription.id })
          

            interaction.reply(`:white_check_mark: Abonnement supprimé avec succès !\n**URL**: <${subscription.url}>\n**Salon**: <#${subscription.channelID}>`);
            break;
        }
        case 'abonnements': {
            var subscriptions = await database.collection('subscriptions').find().toArray()

            const chunks = [];

            subscriptions.forEach((sub) => {
                const content = `**ID**: ${sub.id}\n**URL**: ${sub.url}\n**Salon**: <#${sub.channelID}>\n`;
                const lastChunk = chunks.shift() || [];
                if ((lastChunk.join('\n').length + content.length) > 1024) {
                    if (lastChunk) chunks.push(lastChunk);
                    chunks.push([content]);
                } else {
                    lastChunk.push(content);
                    chunks.push(lastChunk);
                }
            });

            interaction.reply(`:white_check_mark: **${subscriptions.length}** abonnements sont actifs !`);

            chunks.forEach((chunk) => {
                const embed = new Discord.MessageEmbed()
                    .setColor('RED')
                    .setAuthor(`Utilisez la commande /désabonner pour supprimer un abonnement !`)
                    .setDescription(chunk.join('\n'));

                interaction.channel.send({ embeds: [embed] });
            });
        }
    }
});

client.login(process.env.TOKEN);
