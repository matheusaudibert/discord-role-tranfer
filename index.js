require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const { Client, GatewayIntentBits } = require('discord.js');

const { collectMembersWithoutRole } = require('./src/getMembers');
const { assignRoleFromFile } = require('./src/addRole');

const REQUIRED_ENV_VARS = [
  'DISCORD_BOT_TOKEN',
  'SERVER_SOURCE',
  'ROLE_SOURCE',
  'SERVER_TARGET',
  'ROLE_TARGET',
];

const TEMP_FILE_PATH = path.join(__dirname, 'members-without-role.txt');
const THIRTY_MINUTES = 30 * 60 * 1000;

let isRunning = false;

function validateEnv() {
  const missingVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

async function removeTempFile() {
  try {
    await fs.unlink(TEMP_FILE_PATH);
    console.log(`[${new Date().toISOString()}] Temporary file removed: ${TEMP_FILE_PATH}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`[${new Date().toISOString()}] Failed removing temporary file ${TEMP_FILE_PATH}:`, error);
      throw error;
    }

    console.log(`[${new Date().toISOString()}] Temporary file not found (skip): ${TEMP_FILE_PATH}`);
  }
}

async function runTransfer(client) {
  if (isRunning) {
    console.log('A transfer is already running. Skipping this cycle.');
    return;
  }

  isRunning = true;

  try {
    console.log(`[${new Date().toISOString()}] Starting role transfer cycle.`);
    console.log(
      `[${new Date().toISOString()}] Cycle config - source guild: ${process.env.SERVER_SOURCE}, source role: ${process.env.ROLE_SOURCE}, target guild: ${process.env.SERVER_TARGET}, target role: ${process.env.ROLE_TARGET}.`
    );

    await removeTempFile();

    console.log(`[${new Date().toISOString()}] Fetching source and target guilds.`);
    const sourceGuild = await client.guilds.fetch(process.env.SERVER_SOURCE);
    const targetGuild = await client.guilds.fetch(process.env.SERVER_TARGET);

    console.log(
      `[${new Date().toISOString()}] Guilds fetched successfully - source: ${sourceGuild.name} (${sourceGuild.id}), target: ${targetGuild.name} (${targetGuild.id}).`
    );

    const collectedIds = await collectMembersWithoutRole({
      sourceGuild,
      sourceRoleId: process.env.ROLE_SOURCE,
      outputFilePath: TEMP_FILE_PATH,
    });

    const result = await assignRoleFromFile({
      targetGuild,
      targetRoleId: process.env.ROLE_TARGET,
      inputFilePath: TEMP_FILE_PATH,
    });

    console.log(
      `Cycle finished. Source members without role: ${collectedIds.length}. ` +
      `Members found in target: ${result.found}. Roles added: ${result.added}. Already had role: ${result.alreadyHadRole}. ` +
      `Not found in target: ${result.notFoundInTarget}. Failures: ${result.failed}.`
    );
  } catch (error) {
    console.error('Role transfer cycle failed:', error);
  } finally {
    try {
      await removeTempFile();
    } catch (cleanupError) {
      console.error('Failed to remove temporary file:', cleanupError);
    }

    isRunning = false;
    console.log(`[${new Date().toISOString()}] Role transfer cycle finalized.`);
  }
}

async function main() {
  validateEnv();
  console.log(`[${new Date().toISOString()}] Environment variables validated.`);

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  });

  client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    await runTransfer(client);

    setInterval(() => {
      runTransfer(client).catch((error) => {
        console.error('Unhandled transfer interval error:', error);
      });
    }, THIRTY_MINUTES);

    console.log(
      `[${new Date().toISOString()}] Transfer scheduler started. Interval: ${THIRTY_MINUTES / 60000} minutes.`
    );
  });

  client.on('error', (error) => {
    console.error('Discord client error:', error);
  });

  await client.login(process.env.DISCORD_BOT_TOKEN);
}

main().catch((error) => {
  console.error('Application failed to start:', error);
  process.exitCode = 1;
});
