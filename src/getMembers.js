const fs = require('node:fs/promises');

async function collectMembersWithoutRole({ sourceGuild, sourceRoleId, outputFilePath }) {
  console.log(`[${new Date().toISOString()}] [collectMembersWithoutRole] Fetching source guild: ${sourceGuild.id}`);
  const fullGuild = await sourceGuild.fetch();

  console.log(`[${new Date().toISOString()}] [collectMembersWithoutRole] Fetching all members from source guild.`);
  const members = await fullGuild.members.fetch();

  console.log(
    `[${new Date().toISOString()}] [collectMembersWithoutRole] Members fetched: ${members.size}. Filtering bots and members that already have role ${sourceRoleId}.`
  );

  const memberIds = members
    .filter((member) => !member.user.bot && !member.roles.cache.has(sourceRoleId))
    .map((member) => member.id);

  console.log(
    `[${new Date().toISOString()}] [collectMembersWithoutRole] Members without source role: ${memberIds.length}. Writing IDs to ${outputFilePath}.`
  );

  await fs.writeFile(outputFilePath, memberIds.join('\n'), 'utf8');

  console.log(`[${new Date().toISOString()}] [collectMembersWithoutRole] Output file saved successfully.`);

  return memberIds;
}

module.exports = {
  collectMembersWithoutRole,
};
