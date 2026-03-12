const fs = require('node:fs/promises');

const MAX_ADDITIONS_PER_CYCLE = 1;

async function assignRoleFromFile({ targetGuild, targetRoleId, inputFilePath }) {
  console.log(`[${new Date().toISOString()}] [assignRoleFromFile] Reading member IDs from ${inputFilePath}.`);
  const content = await fs.readFile(inputFilePath, 'utf8');
  const memberIds = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  console.log(
    `[${new Date().toISOString()}] [assignRoleFromFile] Loaded ${memberIds.length} member IDs. Max additions this cycle: ${MAX_ADDITIONS_PER_CYCLE}.`
  );

  console.log(`[${new Date().toISOString()}] [assignRoleFromFile] Fetching target guild: ${targetGuild.id}`);
  const fullGuild = await targetGuild.fetch();

  let found = 0;
  let added = 0;
  let alreadyHadRole = 0;
  let notFoundInTarget = 0;
  let failed = 0;

  for (const memberId of memberIds) {
    if (added >= MAX_ADDITIONS_PER_CYCLE) {
      console.log(
        `[${new Date().toISOString()}] [assignRoleFromFile] Addition limit reached (${MAX_ADDITIONS_PER_CYCLE}). Stopping cycle.`
      );
      break;
    }

    let member;

    try {
      console.log(`[${new Date().toISOString()}] [assignRoleFromFile] Fetching member ${memberId} in target guild.`);
      member = await fullGuild.members.fetch(memberId);
    } catch (error) {
      if (error.code === 10007) {
        notFoundInTarget += 1;
        console.warn(
          `[${new Date().toISOString()}] [assignRoleFromFile] Member ${memberId} not found in target guild (code 10007).`
        );
        continue;
      }

      failed += 1;
      console.error(
        `[${new Date().toISOString()}] [assignRoleFromFile] Failed to fetch member ${memberId}:`,
        error
      );
      continue;
    }

    if (!member) {
      notFoundInTarget += 1;
      console.warn(`[${new Date().toISOString()}] [assignRoleFromFile] Member ${memberId} returned empty response.`);
      continue;
    }

    found += 1;

    if (member.roles.cache.has(targetRoleId)) {
      alreadyHadRole += 1;
      console.log(
        `[${new Date().toISOString()}] [assignRoleFromFile] Member ${member.user.tag} (${member.id}) already has role ${targetRoleId}.`
      );
      continue;
    }

    try {
      console.log(
        `[${new Date().toISOString()}] [assignRoleFromFile] Adding role ${targetRoleId} to member ${member.user.tag} (${member.id}).`
      );
      await member.roles.add(targetRoleId);
      added += 1;
      console.log(
        `[${new Date().toISOString()}] [assignRoleFromFile] Role ${targetRoleId} added to member ${member.user.tag} (${member.id}).`
      );
    } catch (error) {
      failed += 1;
      console.error(
        `[${new Date().toISOString()}] [assignRoleFromFile] Failed to add role ${targetRoleId} to member ${member.user.tag} (${member.id}):`,
        error
      );
    }
  }

  console.log(
    `[${new Date().toISOString()}] [assignRoleFromFile] Cycle summary: found=${found}, added=${added}, alreadyHadRole=${alreadyHadRole}, notFoundInTarget=${notFoundInTarget}, failed=${failed}.`
  );

  return {
    found,
    added,
    alreadyHadRole,
    notFoundInTarget,
    failed,
  };
}

module.exports = {
  assignRoleFromFile,
};
