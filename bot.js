require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const { keyDB, userDB } = require('./database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages
  ]
});

// Admin IDs from environment variable
const ADMIN_IDS = process.env.ADMIN_IDS.split(',').map(id => id.trim());

// Initialize REST for command registration
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Commands
const commands = [
  new SlashCommandBuilder()
    .setName('genkey')
    .setDescription('[ADMIN] Generate a new license key')
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Key duration')
        .setRequired(true)
        .addChoices(
          { name: '1 Week', value: 'week' },
          { name: '1 Month', value: 'month' },
          { name: 'Lifetime', value: 'lifetime' }
        )
    ),
  
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Register your account with a license key')
    .addStringOption(option =>
      option.setName('username')
        .setDescription('Your desired username')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('password')
        .setDescription('Your desired password')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('key')
        .setDescription('Your license key')
        .setRequired(true)
    ),
  
  new SlashCommandBuilder()
    .setName('mydetails')
    .setDescription('View your account details')
].map(command => command.toJSON());

client.once('ready', async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  client.user.setActivity('REHABS | /register', { type: 0 });

  // Register slash commands after bot is ready
  try {
    console.log('Registering slash commands...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('✅ Slash commands registered successfully!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // /genkey - Admin only, works in guilds
  if (commandName === 'genkey') {
    if (!ADMIN_IDS.includes(interaction.user.id)) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        ephemeral: true
      });
    }

    const duration = interaction.options.getString('duration');
    
    try {
      const key = keyDB.createKey(duration);
      
      const durationText = duration === 'week' ? '1 Week' : duration === 'month' ? '1 Month' : 'Lifetime';
      
      const embed = new EmbedBuilder()
        .setColor(0x888888)
        .setTitle('🔑 License Key Generated')
        .setDescription(`\`\`\`${key}\`\`\``)
        .addFields(
          { name: 'Duration', value: durationText, inline: true },
          { name: 'Status', value: 'Unused', inline: true }
        )
        .setFooter({ text: 'REHABS Key System' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ Error generating key. Please try again.',
        ephemeral: true
      });
    }
  }

  // /register - Works in DMs and servers
  if (commandName === 'register') {
    const username = interaction.options.getString('username');
    const password = interaction.options.getString('password');
    const key = interaction.options.getString('key');

    // Validation
    if (username.length < 3 || username.length > 20) {
      return interaction.reply({
        content: '❌ Username must be between 3 and 20 characters.',
        ephemeral: true
      });
    }

    if (password.length < 6) {
      return interaction.reply({
        content: '❌ Password must be at least 6 characters.',
        ephemeral: true
      });
    }

    if (!/^REHABS-/.test(key)) {
      return interaction.reply({
        content: '❌ Invalid key format.',
        ephemeral: true
      });
    }

    try {
      // Check if user already registered
      if (userDB.isDiscordIdRegistered(interaction.user.id)) {
        return interaction.reply({
          content: '❌ You have already registered an account.',
          ephemeral: true
        });
      }

      // Check if username taken
      if (userDB.usernameExists(username)) {
        return interaction.reply({
          content: '❌ Username is already taken.',
          ephemeral: true
        });
      }

      // Create user
      const result = userDB.createUser(username, password, interaction.user.id, key);
      
      const expiryDate = new Date(result.expiryDate);
      const keyInfo = keyDB.getKey(key);
      const durationText = keyInfo.duration === 'week' ? '1 Week' : keyInfo.duration === 'month' ? '1 Month' : 'Lifetime';

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Registration Successful')
        .setDescription('Your account has been created!')
        .addFields(
          { name: 'Username', value: `\`${username}\``, inline: true },
          { name: 'Subscription', value: durationText, inline: true },
          { name: 'Expires', value: keyInfo.duration === 'lifetime' ? 'Never' : `<t:${Math.floor(expiryDate.getTime() / 1000)}:R>`, inline: false }
        )
        .setFooter({ text: 'You can now login at rehabswtf.jzb4257.workers.dev' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error(error);
      if (error.message.includes('Invalid or already used key')) {
        return interaction.reply({
          content: '❌ Invalid or already used key.',
          ephemeral: true
        });
      }
      await interaction.reply({
        content: '❌ Registration failed. Please try again.',
        ephemeral: true
      });
    }
  }

  // /mydetails - Works in DMs and servers
  if (commandName === 'mydetails') {

    try {
      const user = userDB.getUserByDiscordId(interaction.user.id);
      
      if (!user) {
        return interaction.reply({
          content: '❌ You have not registered yet. Use `/register` to create an account.',
          ephemeral: true
        });
      }

      const keyInfo = keyDB.getKey(user.key_used);
      const durationText = keyInfo.duration === 'week' ? '1 Week' : keyInfo.duration === 'month' ? '1 Month' : 'Lifetime';
      const isExpired = user.expiry_date < Date.now();
      const expiryDate = new Date(user.expiry_date);
      const createdDate = new Date(user.created_at);

      const embed = new EmbedBuilder()
        .setColor(isExpired ? 0xff0000 : 0x888888)
        .setTitle('👤 Account Details')
        .addFields(
          { name: 'Username', value: `\`${user.username}\``, inline: true },
          { name: 'Subscription', value: durationText, inline: true },
          { name: 'Status', value: isExpired ? '❌ Expired' : '✅ Active', inline: true },
          { name: 'Created', value: `<t:${Math.floor(createdDate.getTime() / 1000)}:R>`, inline: true },
          { name: 'Expires', value: keyInfo.duration === 'lifetime' ? 'Never' : `<t:${Math.floor(expiryDate.getTime() / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: 'REHABS Account System' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ Error fetching account details.',
        ephemeral: true
      });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
