# Brimstone Valley Spell SFX Spec

This is a production-facing sound brief for spell audio generation. The goal is consistency first: short, readable combat sounds with enough personality to separate spell families without turning the mix into noise.

## Mix Rules

- Keep most one-shot spell sounds in the `0.35s` to `1.2s` range.
- Favor a clear transient plus a short identity tail; avoid long cinematic washes.
- Distinguish `cast`, `travel`, and `impact` in stronger spells.
- Buffs and utility spells should stay lighter and less bass-heavy than damage spells.
- Summons, corpse, and boss magic can carry longer tails, but still keep battlefield readability.
- Default export target: `48 kHz`, `24-bit`, mono or narrow stereo.

## Family Palette

- `Steel / Physical`: leather whoosh, blade hiss, armor tick, meaty impact, short grit tail.
- `Fire`: ember whoosh, gas flare, crackle burst, low boom, ash tail.
- `Arcane`: airy charge, glassy shimmer, rune pulse, clean energy pop, shimmer decay.
- `Lightning`: charge crackle, voltage snap, forked zap, electric fizz tail.
- `Poison / Acid`: wet spit, corrosive sizzle, bubble pop, toxic hiss, sticky decay.
- `Holy / Light`: bell, choir breath, radiant bloom, warm chime, soft sparkle tail.
- `Shadow / Necro`: reverse inhale, whisper bed, hollow hit, void pulse, cold decay.
- `Nature`: vine whip, wood creak, leaf rush, seed burst, pollen or sap tail.
- `Earth / Stone`: rumble, debris scatter, rock drag, blunt thud, dust tail.
- `Ice / Water`: liquid sweep, crystalline snap, frosty hiss, brittle crack, cold tail.
- `Blood / Lifesteal`: wet pulse, vein suction, flesh hit, low heartbeat throb.
- `Tech / Trap`: ratchet click, metal deploy, spring pop, compact detonation.

## AI Prompt Template

Use this structure in external SFX tools:

```text
Create a short game sound effect for "[SPELL NAME]".
Style: stylized fantasy combat, readable in a busy auto-battler mix, not cinematic trailer audio.
Elements: [cast] [travel] [impact] [tail].
Material palette: [family palette].
Length: [target duration].
Avoid: vocals, copyrighted motifs, UI beeps unless requested, excessive reverb, muddy bass.
```

## Base Spell Briefs

### Acid / Poison / Toxic

- `acid`: corrosive spit cast, wet glob travel, sharp splat hit, long chemical sizzle tail.
- `armorMelt`: acidic spray over metal, corrosion fizz, tiny armor crack ticks, nasty lingering hiss.
- `acidPool`: broad toxic splash, bubbling surface wash, caustic steam tail.
- `poison`: needle-like toxic strike, light puncture, venom fizz tail.
- `poisonDagger`: fast dagger slice layered with venom spit, compact toxic after-hiss.
- `venomStrike`: harder melee slash than `poisonDagger`, with a thicker poison bloom on impact.
- `poisonExplosion`: unstable toxic swell, swollen bubble burst, wet explosive splat.
- `poisonBreath`: reptilian inhale, toxic cone exhale, sizzling mist bed.
- `poisonedHairpin`: tiny metal flick, elegant sting, poisonous sparkle hiss.
- `blowDart`: hollow blowpipe puff, light dart tick, restrained venom tail.
- `experimentalToxin`: alchemy vial rattle, unstable inject hit, weird bubbling tail.
- `toads`: gross wet plops, swampy croak accents, poison splatter impacts.
- `corruptingTongue`: slimy lash, corrupt spit layer, sticky cursed sizzle.
- `viciousBite`: beast bite crunch with venom drip tail.

### Fire / Heat / Explosion

- `fireBomb`: ignition swell, flaming projectile travel, explosive fire pop, crackling tail.
- `fireBolt`: tight flame cast, fast fire streak, focused burn hit.
- `consumedByFlames`: hungry ignition inhale, burst of fire on target, aggressive crackle sustain.
- `heatingUp`: low furnace rise, buff shimmer made from ember crackles, no hard impact.
- `consumeBurn`: suction pull on existing flames, fire collapse pop, brief healing shimmer.
- `meteor`: distant falling roar, descending flame rush, heavy fiery impact with sub thud.
- `wildfireTrap`: deploy clack, ember priming hiss, small trap flare accent.
- `pyreBlast`: columnar flame blast, medium body, crunchy burn tail.
- `wildFire`: loose chaotic flame spread, hotter and wider than `fireBolt`.
- `conflagration`: engulfing multi-target burn wash, layered crackle and boom.
- `flameThrower`: sustained pressurized flame burst, noisy but controlled midrange.
- `fireBreath`: dragon inhale, broad fire cone release, regal low-end heat.
- `moltenPour`: viscous lava pour, heavy sizzling contact, slow glowing decay.
- `bombToss`: fuse spit, lob travel, dirty explosive pop with debris.

### Arcane / Force / Cosmic

- `forceBlast`: compressed magic charge, blunt arcane shove impact, clean end.
- `lightPillar`: radiant vertical surge with magical lift and clean holy-arcane crash.
- `arcaneExplosion`: dense mana swell, center detonation, crystalline arcane shards.
- `arcaneBolt`: precise magic shot, glassy streak, crisp impact.
- `arcaneBlast`: heavier mana cannon version of `arcaneBolt`, wider hit and more bass.
- `energyWave`: smooth magical wave sweep, broad impactless push, bright tail.
- `energyBlast`: condensed energy sphere, dense pop, short ionized decay.
- `timeWarp`: reversed shimmer, time-bend wobble, soft reality snap.
- `etherium`: ethereal materialization hum, otherworldly gleam, thin spectral tail.
- `copyCat`: mimic shimmer, duplicated attack flicker, playful magical echo.
- `oops`: comic magical misfire, unstable fizz, harmless pop.
- `enchantDexterity`: nimble buff cue, airy chime and quick footwork shimmer.
- `enchantStamina`: sturdier buff cue, low warm pulse with restrained shine.
- `enchantStrength`: denser power-up sting, muscular weight with short forge-like tail.

### Lightning / Storm

- `forkedLightning`: branching charge snap, split-bolt crack, sizzling multi-hit tail.
- `lightningBolt`: fast vertical strike, bright transient, electric crackle bed.
- `zeusWrath`: divine storm buildup, massive bolt impact, thunder layer underneath.
- `staticShock`: very short electric pop for secondary proc or status tick.

### Holy / Light / Cleansing / Healing

- `prayer`: soft breath, upward chime cluster, reverent glow tail.
- `dualityStrike`: holy-dark hybrid spear hit, bright front with darker undertone, light heal shimmer.
- `lifeForALife`: severe holy judgment hit, then restrained healing release.
- `lightAndDark`: two-tone split, bright chime and dark pulse, balanced dual finish.
- `searingLight`: radiant beam hit with a hot holy edge, less soft than a heal spell.
- `enrage`: primal power-up surge with heartbeat and ember-like aggression, heavier than `rage`.
- `justice`: solemn strike, bright metallic judgment ring.
- `holyFervor`: incense burst, radiant battle cry energy, uplifting but forceful.
- `purify`: sharp holy dispel flash, positive effect strip sound, clean chime tail.
- `cleanse`: gentler dispel than `purify`, watery bell and soft lift.
- `clericHeal`: warm bloom, close-range heal pulse, no aggressive transient.
- `massHeal`: layered choir bloom, wider healing wash, controlled sparkle tail.
- `healingWater`: liquid holy pour, soothing splash, clean ring.
- `cleansingWater`: fuller watery sweep than `healingWater`, dispel sparkle mixed in.
- `revive`: hushed pause, rising soul tone, bright return pulse.
- `benevolence`: soft blessing cast, luminous buff sheen.
- `honor`: noble metallic ring, banner-like uplift, disciplined tail.
- `retribution`: delayed holy strike, bright condemn hit, slight reverb bloom.
- `exorcism`: holy repel burst, sharp hiss on expulsion, no warmth.
- `brimberryLeaves`: herbal heal rustle, small nature sparkle, comforting finish.
- `herbs`: mortar-and-leaf rustle, quick restorative chime.
- `offerARoom`: hospitable support cue, gentle door-softness metaphor, cozy magic bloom.
- `helpingHand`: light assist pulse, encouraging sparkle, very readable support sound.
- `vitalityPotion`: glass clink, liquid swish, instant health swell.

### Shadow / Curse / Necro / Void

- `soulLink`: low spectral bind tone, thread-like tether shimmer, ominous sustain.
- `consumeCorpse`: corpse draw-in suction, necrotic gulp, short heal undertone.
- `corpseExplosion`: corpse swell, wet rupture, dirty blast with gore-light debris.
- `raiseDead`: grave stir rumble, bone assemble clicks, eerie rise tone.
- `soulDrain`: soul siphon inhale, void impact, healing exhale on return.
- `deathPact`: blood-void contract pulse, severe occult accent, heavy consequence feel.
- `siphon`: clean shadow suck, dark impact, energy drain tick.
- `curse`: whisper cast, black pulse impact, draining magical decay.
- `spook`: thin ghostly scare sting, airy tail.
- `hex`: witchy snap, brittle curse sparkle, unpleasant decay.
- `affliction`: diseased magical pulse, dull impact, unhealthy sustain.
- `ritual`: low chant bed, occult pulse, lingering circle hum.
- `leech`: wet necro suction, small flesh impact, health-steal return ping.
- `drain`: darker, broader `leech`, more void than blood.
- `darkBolt`: shadow projectile with hollow crack and cold tail.
- `darkSlash`: smoky blade sweep, void-laced cut, fading whisper.
- `darkPillar`: deep vertical void surge, heavy occult crash.
- `soulCrush`: compression of spectral energy, crushing pulse hit, sharp release.
- `treachery`: subtle sinister charm sound, whispering turncoat shimmer.
- `decreeOfHatred`: authoritarian dark proclamation hit, cursed resonance.
- `reclaimThrone`: dark regality, throne-room reverb feel, usurpation pulse.
- `usurp`: sharper, more aggressive seize-power sound than `reclaimThrone`.
- `subjugation`: oppressive magical clamp, chain-like undertone, status effect finish.
- `tyranny`: wide oppressive field pulse with dark authority.
- `queensWrath`: elegant but lethal dark strike, regal sting on impact.
- `truth`: exposed weakness sound, piercing holy-arcane ping with harsh finish.
- `malign`: corruptive pulse, creeping tail, lightly organic.
- `humble`: soft debuff tap, power-lowering bell in minor key.
- `humility`: more severe version of `humble`, longer drain tail.

### Blood / Lifesteal / Flesh

- `bloodDrain`: arterial siphon, fleshy hit, low heartbeat tail.
- `transfusion`: medical-occult blood transfer, suction plus heal bloom.
- `bloodyFangs`: savage puncture, wet rip, predatory sustain.
- `bloodLust`: aggressive heartbeat rise, feral buff surge.

### Nature / Wood / Beast

- `entanglingRoots`: ground split, vine whip, root constriction creak.
- `naturesBlessing`: airy leaf swirl, warm druidic glow, soft wood resonance.
- `protectiveGrowth`: bark rise, leafy shield bloom, gentle woody tail.
- `spores`: powdery puff, fungal burst, dry organic decay.
- `naturesWrath`: stormy druid surge, branch whip, broader natural impact.
- `fruitOfTheVine`: vine pop, nourishing sap glimmer, fruity magical pluck.
- `rejuvenate`: quiet leaf swirl, restorative sap pulse.
- `gale`: wind-up sweep, cutting air push, no heavy impact.
- `howl`: beast howl accent, aura buff layer, broad outdoor feel.
- `bite`: small beast bite snap, wet crunch.
- `claw`: quick animal rake, dry flesh tear.
- `bearSwipe`: wide heavy claw sweep with fur and weight.
- `wolfClaw`: faster, leaner beast slash than `bearSwipe`.
- `dragonFangs`: draconic maul hit, fire undertone, brutal bite finish.
- `dragonsClaw`: dragon slash with heat edge and scale scrape.
- `dragonsBreath`: larger, more mythic breath sound than `fireBreath`, with wind pressure.
- `tailWhip`: reptilian body swing, thick whip crack, body-weight impact.
- `viciousBite`: reinforced beast bite with poison tint if desired.

### Water / Ice / Cold

- `tidalWave`: broad water surge, rushing body, forceful splash wall.
- `coneOfCold`: icy exhale burst, frost crackle, brittle finish.
- `iceBolt`: precise frost shot, crystal snap impact, cold hiss tail.
- `blizzard`: layered wind and ice particles, wide area chill bed.

### Earth / Stone / Gravity

- `mudSling`: sticky throw, wet dirt splat, gritty residue.
- `mudArmor`: heavy clay coat-up, damp earth buff sound, no sharp transient.
- `quicksand`: sucking sand pull, muffled drag, ominous sink tail.
- `barrelSmash`: wood crack, blunt slam, debris scatter.
- `stomp`: heavy foot impact, small quake ripple, dust burst.
- `throwBoulder`: stone heft, lob whoosh, rock impact chunk.
- `rockSmash`: sharp stone break, rocky burst, rubble scatter.
- `trample`: repeated heavy impacts, dirt churn, beast-force feel.
- `tableTilt`: comedic heavy furniture scrape and slam, still readable in combat.
- `avalanche`: mass stone slide, debris cascade, low-end rumble.
- `gravity`: downward pressure swell, crushing hit, compressed air release.
- `clubSmash`: wood-and-bone blunt hit, chunky low mids.

### Steel / Martial / Weapon Arts

- `basicAttack`: ultra-short neutral strike, simple whoosh and hit.
- `minionAttack`: lighter, scrappier version of `basicAttack`.
- `brutalSmash`: oversized blunt weapon hit, weight first, detail second.
- `monstrousClaws`: broad savage rake with flesh-tear texture.
- `berserk`: self-hype gruntless feral rush into impact.
- `roar`: beast vocal surge replaced with non-vocal intimidation wave if you want a clean library.
- `shieldBash`: shield rush, metal thump, slight stun tick.
- `charge`: fast armored rush, rising whoosh, impact stop.
- `counter`: quick steel catch, instant retaliatory slash.
- `shieldMaidenSkirmish`: disciplined shield-and-blade exchange, lighter than `duel`.
- `shieldMaidenShieldBash`: stronger female-knight identity via polished shield ring.
- `shieldMaidenLoyalty`: noble protection cue, banner-metal shimmer.
- `guardUp`: compact protective armor rise, plated buff click.
- `bulwarkField`: board-wide shield aura, layered metal glints.
- `hamstring`: slicing cut with tendon-like snap, short bleed tail.
- `staffFinisher`: hardwood sweep, magic-tipped bonk, confident finish.
- `battle`: generic melee projectile or battle order strike, steel-forward and neutral.
- `blackArrows`: darker bow release, sinister arrow hiss, cursed puncture.
- `engage`: rush cue, formation collision, tactical aggression.
- `flank`: side-step whoosh, fast strike, tactical emphasis rather than brute force.
- `slash`: standard sword sweep, clean cut, short impact.
- `ironHand`: metal gauntlet punch, dense armored hit.
- `magnetize`: metal drag-in scrape, arcane-metal clack, control tail.
- `bodySlam`: body weight rush, padded thud, brief rumble.
- `masamune`: high-end katana draw shimmer, ultra-clean cut.
- `harakiri`: ritual blade draw, severe slash, tragic short ring.
- `superiority`: confident martial buff sting, polished military tone.
- `reapersHarvest`: scythe sweep with spectral edge, wider than `reap`.
- `reap`: tighter scythe cut, cleaner and faster than `reapersHarvest`.
- `cleave`: broad blade arc, heavier air movement, multi-target contact.
- `armorBreakStrike`: hard metal crack layered onto melee hit.
- `duel`: tense duel lunge, sharper steel personality, single-target focus.
- `armorBearer`: armor grant cue, plated rise, low movement.
- `battleFormation`: rank-settle clacks, shield and weapon readiness aura.
- `deadlyFist`: martial punch with explosive knuckle hit.
- `wildPunch`: sloppy but forceful punch, more tavern than trained fighter.
- `specialBrew`: bottle slosh, cork pop, rowdy buff sting.
- `pierce`: thin penetrating stab, minimal body, sharp exit.
- `javelin`: thrown spear whistle, hard puncture, slight shaft rattle.
- `defend`: shield raise, soft brace, no attack transient.
- `throwRock`: smaller, cheaper cousin to `throwBoulder`.
- `demoralizingBlow`: melee impact with morale-lowering dark ring.
- `stab`: close steel thrust, compact puncture.
- `pilfer`: sneaky snatch cue, light stab or slap, coin-like flick accent.
- `coup`: elegant finisher thrust, crisp finality.
- `hardFall`: body drop, gear clatter, brief low thud.
- `flex`: short comedic muscle buff cue, leather and body movement.
- `rage`: aggressive internal power-up, heartbeat and weapon rattle.
- `hammer`: warhammer swing, dense metal-crush impact.
- `armorUp`: armor layering cue, metallic gain sparkle.
- `ironForge`: forge ring, heat-metal buff pulse, smithing identity.
- `multishot`: quick bow volley, multiple arrow hisses, clustered punctures.
- `lieInWait`: stealth prep cue, held breath tension, no loud impact.
- `shadowStrike`: stealth slice with dark afterimage, assassin-fast.
- `fade`: vanish shimmer, smoke-wisp exit, low presence.
- `smokeBomb`: muffled pop, smoke bloom, stealthy vanish tail.
- `combo`: chained light hits with increasing intensity and fast cadence.
- `spear`: straightforward spear thrust or throw, disciplined and clean.
- `arrow`: neutral arrow release, flight hiss, crisp puncture.
- `deadEye`: focused draw, sharpened release, fatal puncture emphasis.
- `assassinate`: brief silence into lethal impact, premium finisher sound.
- `priorityTarget`: target-mark ping with hunter tension, then compact shot cue.
- `arrest`: capture strike, chain or restraint accent, nonlethal force feel.
- `shackle`: magical restraint clamp, chain-rattle undertone, binding finish.
- `sneakAttack`: covert step, hidden stab, small dirty impact.
- `trackDown`: hunter pursuit cue, quick lunge or shot, predatory finish.
- `cut`: simple blade slice with slight blood edge.
- `batSwarm`: leathery flutter burst, swarm hiss, multi-hit chatter.
- `shuriken`: sharp spin throw, metallic whirr, tiny puncture tick.
- `fan`: elegant blade-fan flourish, airy slash with style.
- `slap`: comedic open-hand hit, light sting.
- `chop`: axe-heavy downward cut, woody-meaty hit blend.
- `axeThrow`: spinning axe whistle, chunkier impact than `javelin`.
- `sharpenAxe`: grind scrape, metallic edge shimmer, prep cue.
- `execute`: executioner wind-up, brutal decisive chop.
- `guillotine`: mechanical drop, blade slam, grim finality.
- `chainWhip`: chain swing, metallic lash, rattling tail.
- `vengefulSlash`: revenge-powered slash with extra emotional weight and tail.

### Buffs / Utility / Control / Tech

- `counter`: keep very short and reactive; it should not mask the incoming hit.
- `copyCat`: playful mimic shimmer with slight doubled echo.
- `giveAQuest`: light parchment or sigil cue, upbeat utility tone.
- `elixir`: generic potion buff, glass and magical sparkle.
- `releaseInmates`: prison gate burst, chaotic rush release, multi-body scuffle energy.
- `summonerSummonAlly`: portal open, allied materialize pulse, short arrival thump.
- `summonerSummonMinion`: smaller, scrappier summon than `summonerSummonAlly`.
- `summonerSupportMinion`: minion empowerment cue, tiny swarm-ready pulse.
- `voidShield`: dark shield envelope, hollow protective hum.
- `swiftness`: airy upward flick, speed shimmer, no bass.
- `landMine`: arm click, spring tension, dangerous short beep-free ready hiss.
- `tinkererTurretAttack`: mechanical fire pop, bolt shot, compact metal recoil.
- `buildTurret`: wrench-click deploy, mechanical unfold, ready chime.
- `fieldUpgrade`: tech-magic calibration pulse, clean upgrade sting.
- `haste`: faster, brighter cousin to `swiftness`, with sharper onset.
- `trollRegeneration`: chunky organic heal pulse, swampy vitality swell, stubborn recovery tail.
- `payTheToll`: punitive contract strike, coin-metal undertone, dark payment feel.
- `payTheTollTrigger`: lighter proc version of `payTheToll`, same identity without full impact.

## Boss Variant Direction

- `level5Curse` / `Greater Curse`: use `curse` base, add heavier low-end pulse and harsher drain tail.
- `level5FireBolt` / `Searing Bolt`: use `fireBolt` base, make the ignition brighter and hotter.
- `level5ConsumedByFlames` / `Inferno Feast`: use `consumedByFlames` base, add greedier flame suction before impact.
- `level5PoisonDagger` / `Lethal Dagger`: use `poisonDagger` base, deepen the toxin tail and puncture.
- `level10LightningBolt` / `Thunder Strike`: use `lightningBolt` base, add thunder layer and more sub.
- `level10Cut` / `Savage Cut`: use `cut` base, add nastier bleed rip texture.
- `level15BrutalSmash` / `Devastating Smash`: use `brutalSmash` base, more low-end and rock-like weight.
- `level20ArcaneBlast` / `Arcane Annihilation`: use `arcaneBlast` base, longer charge and more violent crystalline burst.
- `level20EntanglingRoots`: use `entanglingRoots` base, add heavier ground crack before the vine bind.
- `level25Gravity` / `Crushing Gravity`: use `gravity` base, stronger compression and board-wide pressure feel.
- `level30Truth` / `Absolute Truth`: use `truth` base, brighter, harsher, more exposing.
- `level30SanctifiedPurify`: use `purify` base, stronger dispel rip and bigger holy flash.
- `level30CenserStorm`: blend `holyFervor` incense bloom with wider area strike impact.
- `level30FinalAbsolution` / `Null Rite`: harsher holy-dark single-target judgment with energy drain tick.
- `level30GraveCurse` / `Grave Curse`: blend `curse` and necro void, darker and more terminal.
- `level30SoulHarvest`: use `truth` plus `soulDrain` return shimmer.
- `level30DragonFangs` / `Rending Fangs`: use `dragonFangs` base with burning tear tail.
- `level30SkyRend`: use `dragonsClaw` base, brighter air cut and hotter burn residue.
- `level30Worldfire`: use `fireBreath` base, scale wider and deeper, then add brief self-heal glint.
- `level35AstralLance`: use `dualityStrike` base, cleaner cosmic spear tone and premium heal return.
- `level35BloodEdict`: use `lifeForALife` base, add legalistic dark command tone and conditional heal flourish.
- `level35JudgmentOfTwilight`: split bright divine burst and dark undercurrent equally.
- `level40Overrule` / `Double Strike`: elite boss strike, premium martial transient, ghostly afterimage acceptable.
- `level40WarMandate` / `Tremor`: board-wide quake, rubble cascade, command-like authority layer.
- `level40Kingslaw` / `Dark Energy`: pre-cast shadow charge, dense dark projectile, oppressive impact.
- `level40PhantomOverrule` / `Ghostly Attack`: spectral slash, lighter body and colder tail than `slash`.
- `level40HauntingMandate` / `Ultimate Devastation`: catastrophic spectral meteor with void-laced boom.
- `level40NetherKingslaw` / `Whirlwind`: ghost cyclone, circular whoosh bed, energy-drain crackle.

## Fast Next Pass

If you want higher quality results from external generators, generate these first as reusable stems and then recombine them per spell:

- `fire_cast`, `fire_hit`, `fire_aoe`
- `arcane_cast`, `arcane_hit`, `arcane_burst`
- `holy_heal`, `holy_judgment`, `holy_dispel`
- `shadow_cast`, `shadow_drain`, `shadow_hit`
- `poison_sting`, `poison_burst`, `acid_sizzle`
- `steel_slash`, `steel_stab`, `blunt_hit`
- `earth_quake`, `rock_throw`, `vine_bind`
- `ice_shot`, `ice_burst`, `water_wave`
- `lightning_cast`, `lightning_hit`, `storm_finisher`