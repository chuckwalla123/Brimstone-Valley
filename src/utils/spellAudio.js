export function resolveSpellSoundProfile(spellDef, lastAction = null, variant = 'primary') {
  const isSecondary = variant === 'secondary';
  const soundField = isSecondary ? 'secondarySound' : 'sound';
  const soundNameField = isSecondary ? 'secondarySoundName' : 'soundName';
  const volumeField = isSecondary ? 'secondarySoundVolume' : 'soundVolume';
  const delayField = isSecondary ? 'secondarySoundDelayMs' : 'soundDelayMs';
  const startField = isSecondary ? 'secondarySoundStartTime' : 'soundStartTime';
  const endField = isSecondary ? 'secondarySoundEndTime' : 'soundEndTime';

  const actionSound = lastAction && typeof lastAction[soundField] === 'string' ? lastAction[soundField] : null;
  const actionVolume = lastAction && typeof lastAction[volumeField] === 'number' ? Number(lastAction[volumeField]) : null;
  const actionDelayMs = lastAction && typeof lastAction[delayField] === 'number' ? Number(lastAction[delayField]) : null;
  const actionStartTime = lastAction && typeof lastAction[startField] === 'number' ? Number(lastAction[startField]) : null;
  const actionEndTime = lastAction && typeof lastAction[endField] === 'number' ? Number(lastAction[endField]) : null;

  const spellSoundName = spellDef && typeof spellDef[soundNameField] === 'string' && spellDef[soundNameField].trim()
    ? spellDef[soundNameField].trim()
    : (spellDef && typeof spellDef.name === 'string'
      ? (isSecondary
        ? (spellDef.animationSecondary ? `${spellDef.name.trim()} Secondary` : '')
        : spellDef.name.trim())
      : '');

  const soundFile = actionSound
    || (spellDef && typeof spellDef[soundField] === 'string' ? spellDef[soundField] : null)
    || (spellSoundName ? `/images/sounds/${spellSoundName}.mp3` : null);

  return {
    soundFile,
    soundVolume: actionVolume != null
      ? actionVolume
      : (spellDef && spellDef[volumeField] != null ? Number(spellDef[volumeField]) : 1),
    soundDelayMs: actionDelayMs != null
      ? actionDelayMs
      : (spellDef && spellDef[delayField] != null ? Number(spellDef[delayField]) : 0),
    soundStartTime: actionStartTime != null
      ? actionStartTime
      : (spellDef && spellDef[startField] != null ? Number(spellDef[startField]) : 0),
    soundEndTime: actionEndTime != null
      ? actionEndTime
      : (spellDef && spellDef[endField] != null ? Number(spellDef[endField]) : null)
  };
}

export default resolveSpellSoundProfile;