// src/story/storyData.js
// Relic Hunt story data and connected arcs for all kingdoms.

export const STORY_META = {
  relicName: 'Heart of Brimstone',
  premise:
    'Five kingdoms converge on Brimstone Valley, where relics from old wars still burn beneath the ash.'
};

export const STORY_ARCS = {
  brave: {
    id: 'brave',
    name: 'Brave Kingdom',
    bannerHeroes: ['lancerID', 'knightID'],
    bannerPositions: [7, 6],
    prologue: [
      'In the shadowed annals of the Contract Age, the five kingdoms stand as monuments to hubris and shattered vows. What began as noble ambitions—border wars waged to secure prosperity and honor—ended in ruinous bankruptcy. The crowns, desperate to maintain their gilded thrones, auctioned off their armies like livestock at market. The professional soldiers, once the backbone of royal might, became commodities traded between mercenary lords who bought their loyalty with promises of coin and glory.',
      'The mercenary lords emerged from the chaos like carrion birds, their banners stitched from the remnants of old oaths. These were not mere bandits or opportunists; they were shrewd operators who understood that power flowed not from crowns, but from contracts. They purchased titles, land deeds, and the fealty of the last disciplined regiments. Trade caravans now traveled under private flags, their wagons guarded by hired blades rather than royal escorts. Every bridge, every forge, every granary became a toll station, priced in blood rather than coin.',
      'The common folk whispered of this new order as the Contract Age—a time when stability came at the point of a sword, and every man\'s worth was measured in the strength of his arm and the sharpness of his blade. The mercenary lords called it progress, a system where talent and ruthlessness were rewarded, not birthright or divine mandate. But beneath the veneer of order lurked a deeper truth: the kingdoms had become hollow shells, their treasuries empty, their armies fragmented, their people hungry.',
      'Brimstone Valley, that accursed stretch of ash-choked earth where ancient wars had scorched the soil and buried secrets beneath layers of volcanic residue, became the unlikely savior of this fractured world. Relics—fragments of power from a forgotten age—lay dormant in its depths, waiting to be unearthed. These were no mere artifacts; they were keys to unimaginable wealth. A single shard could awaken dormant armories, filling forges with ethereal flame and vaults with phantom gold. It could tilt the balance of treaties, erase debts too massive to repay in mere currency, or grant dominion over territories that stretched beyond the horizon.',
      'The relics became the de facto currency of the Contract Age, more valuable than gold, more coveted than land. Kingdoms that once waged war over borders now sent expeditions into the valley\'s treacherous depths. Mercenary companies, their contracts rewritten to include relic rights, became the new explorers. The valley\'s ash plains became battlegrounds where rival bands clashed not for honor, but for the promise of power that could rewrite their fortunes.',
      'The Brave Kingdom, once a bastion of steel and stone, a realm where knights rode under banners of unyielding resolve, now teetered on the brink of oblivion. Its forges had grown cold, its armories empty, its people gaunt from famine. The Crown, desperate and diminished, issued a desperate proclamation: any warband that returned with proof of relic discovery would receive land, rank, and first claim on the valley\'s treasures. It was a gamble born of necessity, a final throw of the dice in a game where the stakes were survival itself.',
      'Among the last disciplined companies still clinging to the old oaths stood the warband led by Knight and Lancer. Knight, a grizzled veteran whose armor bore the scars of countless battles, represented the fading ideals of chivalric honor. Lancer, younger but no less resolute, embodied the pragmatic steel that had once made the kingdom formidable. They did not fight merely for pay or glory; they fought for redemption. In their eyes, the relics represented the last chance to restore the kingdom to the people who had built it—the farmers tilling frostbitten fields, the smiths working with dwindling iron, the families praying for an end to the endless cycle of debt and despair.',
      'Their charter was deceptively simple: secure the Heart of Brimstone, the most coveted relic rumored to lie at the valley\'s core. But whispers among the scouts spoke of darker truths. The relics were not singular treasures to be claimed and hoarded. They were pieces of a shattered covenant, fragments of an ancient pact that bound the very fabric of power. Whoever claimed the first shard might ignite not prosperity, but a conflagration that would consume all five kingdoms in a war unlike any before.',
      'As Knight and Lancer prepared their warband for the journey, they knew the stakes extended beyond mere survival. The mercenary lords watched from their fortified manors, their agents embedded in every court and tavern. Deserted soldiers roamed the borderlands, their loyalties for sale to the highest bidder. And in Brimstone Valley itself, the ash stirred with unnatural life, as if the relics called to those who sought them.',
      'The Contract Age had transformed warriors into merchants and honor into a commodity. But deep in the valley\'s heart, where the Heart of Brimstone pulsed with forbidden power, the old ways might yet find resurrection. Knight and Lancer marched not just for a relic, but for the soul of a kingdom that refused to die quietly. Their journey would test not only their steel, but the very foundations of the world they sought to save.'
    ],
    intro: [
      'Steel once solved every crisis for the Brave Kingdom. Now the forges are cold and the vaults thin.',
      'The Crown sends a mercenary band under Lancer and Knight to retrieve a relic rumored to awaken dormant armories.',
      'But whispers say the relics are not singular. Whoever claims the first may ignite a war for the rest.'
    ],
    outro: [
      'The Iron Regent falls, and the Heart of Brimstone pulses with a new rhythm.',
      'Word spreads: the relic is only one piece of a shattered covenant. Other kingdoms are already marching.'
    ],
    map: {
      start: 'warden_pass',
      nodes: [
        {
          id: 'warden_pass',
          type: 'battle',
          title: "Warden's Pass",
          description: 'Deserters have turned the old garrison into a toll gate.',
          preBattle: [
            'The eastern trade route, once the lifeblood of the Brave Kingdom\'s commerce, now chokes under the shadow of Warden\'s Pass. The garrison that stood sentinel for generations has become a mockery of its former glory. Its stone walls, meant to repel invaders and safeguard merchants, now house deserters who have traded their oaths for greed. The royal banner hangs in tatters from the battlements, a symbol of how far the kingdom has fallen.',
            'These are not mere bandits or opportunistic raiders. They are former soldiers who once swore fealty to the Crown, men who stood in formation during the border wars that bankrupted the realm. But when the mercenary lords bought their contracts and the pay stopped flowing, they deserted their posts. Now they demand tribute from any who wish to pass—relic fragments, gold, or blood. Their toll is not just a barrier; it\'s a statement that the old order has crumbled, and survival belongs to those ruthless enough to seize it.',
            'Knight and Lancer approach the pass with heavy hearts. These deserters were comrades once, brothers-in-arms who shared the same trenches and the same dreams of a prosperous kingdom. But the Contract Age has poisoned even the bonds of loyalty. The warband must choose: pay the toll and admit defeat before the journey truly begins, or fight and risk becoming the monsters they seek to destroy. The pass represents more than a geographical obstacle; it\'s a test of resolve, a mirror reflecting the kingdom\'s fractured soul.',
            'As the warband draws near, they can hear the deserters\' laughter echoing from the walls, mingled with the clink of coin and the sharpening of blades. Scouts report that an ice mage leads the garrison now—a sorcerer who deserted the royal academy when the Crown could no longer afford his salary. His magic chills the air around the pass, making the stones slick with frost and the guards\' breath visible even in the valley\'s perpetual warmth. This is no simple toll collection; it\'s a deliberate provocation, a gauntlet thrown at any who still believe in the kingdom\'s old ideals.'
          ],
          dialogue: [
            { speaker: 'Knight', side: 'left', text: 'Look at these walls, Lancer. They were built with our sweat and blood. Now they guard thieves who wear our old colors.' },
            { speaker: 'Lancer', side: 'right', text: 'The colors mean nothing now. The Crown sold them along with the army. These men are just trying to survive in the world we helped create.' },
            { speaker: 'Knight', side: 'left', text: 'Survival doesn\'t excuse betrayal. They swore oaths, not contracts. Oaths don\'t expire when the pay runs thin.' },
            { speaker: 'Lancer', side: 'right', text: 'And what of our oaths? We march for a Crown that bankrupted the realm and sold our brothers to the highest bidder. Are we any different?' },
            { speaker: 'Knight', side: 'left', text: 'We march for the people who still till the fields and work the forges. The Crown may be broken, but the kingdom lives in them. If we don\'t fight for something beyond coin, then the mercenary lords have already won.' },
            { speaker: 'Lancer', side: 'right', text: 'Then let\'s make this pass remember what real loyalty looks like. No toll. No tribute. We take what\'s ours by right of blood and steel.' },
            { speaker: 'Knight', side: 'left', text: 'Those men up there... they were our shield-brothers once. Friends who shared our victories and our losses.' },
            { speaker: 'Lancer', side: 'right', text: 'And now they stand against us. The Contract Age turns brothers into enemies. Let their last service be a warning to every mercenary lord watching from their towers.' },
            { speaker: 'Knight', side: 'left', text: 'If we break them here, we prove that some oaths still hold weight. The kingdom needs heroes, not more deserters.' },
            { speaker: 'Lancer', side: 'right', text: 'Then let\'s show them what heroes look like. Forward, for the Brave Kingdom and the people who still believe in it.' }
          ],
          battleDialogue: [
            {
              speaker: 'Ice Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Ice Mage', image: '/images/heroes/Ice Mage Cropped.jpg' }
              ],
              text: 'The bridge is closed. The Council sold this contract to keep our towers warm. You think you can just march through with your rusty ideals?'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Ice Mage', image: '/images/heroes/Ice Mage Cropped.jpg' }
              ],
              text: 'Your Council sells winter to our farmers, then charges a toll for the thaw. You were trained in the royal academy, sworn to protect the realm.'
            },
            {
              speaker: 'Ice Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Ice Mage', image: '/images/heroes/Ice Mage Cropped.jpg' }
              ],
              text: 'The academy stopped paying my stipend. The Crown couldn\'t afford scholars or soldiers. I learned to survive, just like these men behind me.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Ice Mage', image: '/images/heroes/Ice Mage Cropped.jpg' }
              ],
              text: 'We are here for the relic, not your prejudice. The valley calls to all who seek its power, but we come with the kingdom\'s blessing.'
            },
            {
              speaker: 'Ice Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Ice Mage', image: '/images/heroes/Ice Mage Cropped.jpg' }
              ],
              text: 'Blessing? The Crown\'s blessing is worth less than the ash we stand on. I\'ve seen kingdoms fall and lords rise. Power respects strength, not parchment.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Ice Mage', image: '/images/heroes/Ice Mage Cropped.jpg' }
              ],
              text: 'Then let strength decide. We don\'t seek to destroy you, but we will not be denied passage. The relic belongs to those who can claim it.'
            },
            {
              speaker: 'Ice Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Ice Mage', image: '/images/heroes/Ice Mage Cropped.jpg' }
              ],
              text: 'Brave knights speak of honor while their Crown begs for coin. I will not let you pass. The pass is mine, bought with blood and betrayal.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Ice Mage', image: '/images/heroes/Ice Mage Cropped.jpg' }
              ],
              text: 'Then we will take it back. For the kingdom, for the people who still believe, and for the oaths you\'ve forgotten.'
            }
          ],
          enemyTeam: 'brave_warden_pass',
          next: ['ashbridge']
        },
        {
          id: 'ashbridge',
          type: 'battle',
          title: 'Ashbridge Toll',
          description: 'A mercenary company blocks the bridge. They demand proof of strength.',
          preBattle: [
            'Ashbridge spans a chasm of black water and ancient ash, a narrow ribbon of stone that has connected the kingdom\'s eastern and western provinces for centuries. But the Contract Age has transformed this vital artery into a weapon. A mercenary company, their banners a patchwork of stolen colors and forged crests, has raised a steel gate across the span. Their demands are simple: pay in relic fragments, gold, or prove your worth in combat. The bridge that once facilitated trade now strangles it.',
            'These mercenaries are not the desperate deserters of Warden\'s Pass. They are professionals, well-fed and well-armed, their equipment maintained by someone else\'s wealth. Scouts report that their leader is a fire mage, a pyromancer who defected from the royal arcane corps when the Crown could no longer afford his research stipend. His magic keeps the bridge alight with unnatural flame, making the stones hot to the touch and filling the air with the acrid scent of brimstone.',
            'The warband approaches with caution. Crossing Ashbridge is not merely a matter of geography; it\'s a statement of intent. Paying the toll would validate the mercenary system, admitting that strength and wealth are the only currencies that matter. Fighting would escalate their journey from a quest to a crusade, drawing the attention of every contract lord in the region. Yet the alternative—turning back—is unthinkable. The valley calls, and the kingdom\'s fate hangs in the balance.',
            'As they draw near, the mercenaries make their presence known. Torches flare along the bridge\'s edges, and armored figures patrol the span. The fire mage stands at the center, his robes billowing in the unnatural heat. This is no simple toll collection; it\'s a deliberate challenge, a test of whether Knight and Lancer\'s ideals can survive contact with the Contract Age\'s harsh realities. The bridge represents the kingdom\'s fractured infrastructure, now held hostage by those who profit from its division.'
          ],
          dialogue: [
            { speaker: 'Knight', side: 'left', text: 'Every bridge is a knife now. The merc lords didn\'t rebuild them; they simply collected the tolls. This span was built with kingdom gold, for kingdom trade.' },
            { speaker: 'Lancer', side: 'right', text: 'And now it serves their greed. Look at these men—they\'re well-fed, well-armed. Someone\'s paying them handsomely to strangle our own commerce.' },
            { speaker: 'Knight', side: 'left', text: 'The Crown should have seen this coming. When you sell your army, you sell your borders too. These mercenaries are just the symptom.' },
            { speaker: 'Lancer', side: 'right', text: 'Then we treat the symptom. We take this bridge back, not just for passage, but to show that some things still belong to the kingdom.' },
            { speaker: 'Knight', side: 'left', text: 'But at what cost? If we fight every toll gate between here and the valley, we\'ll arrive with an army at our backs and no strength left for the real battle.' },
            { speaker: 'Lancer', side: 'right', text: 'And if we pay every toll, we validate their system. The people watching from the riverbanks need to see that resistance is possible.' },
            { speaker: 'Knight', side: 'left', text: 'The people need food in their bellies more than symbols. But you\'re right—we can\'t let this stand. The bridge opens, or we break it.' },
            { speaker: 'Lancer', side: 'right', text: 'Then let\'s break it. For the farmers who can\'t cross with their wagons, for the merchants who pay in blood instead of coin.' },
            { speaker: 'Knight', side: 'left', text: 'And for the kingdom that built this span. Forward—we reclaim what\'s ours.' }
          ],
          battleDialogue: [
            {
              speaker: 'Fire Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Fire Mage', image: '/images/heroes/Fire Mage Cropped.jpg' }
              ],
              text: 'The bridge burns with old magic. Cross without tribute and you invite war. The flames will consume you before you reach the span.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Fire Mage', image: '/images/heroes/Fire Mage Cropped.jpg' }
              ],
              text: 'War already found us. This toll only chooses who starves. You were trained in the royal arcane corps—sworn to protect the realm, not extort it.'
            },
            {
              speaker: 'Fire Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Fire Mage', image: '/images/heroes/Fire Mage Cropped.jpg' }
              ],
              text: 'The corps stopped funding my research. The Crown couldn\'t afford scholars or spells. I learned to monetize my talents, just like these soldiers learned to sell their swords.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Fire Mage', image: '/images/heroes/Fire Mage Cropped.jpg' }
              ],
              text: 'Then you\'ve forgotten what magic was meant to serve. The arcane arts were gifts to the kingdom, not weapons for personal gain.'
            },
            {
              speaker: 'Fire Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Fire Mage', image: '/images/heroes/Fire Mage Cropped.jpg' }
              ],
              text: 'Gifts? The Crown treated us like servants, paying us in scraps while hoarding the real wealth. Now I take what I\'m owed, and this bridge is my due.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Fire Mage', image: '/images/heroes/Fire Mage Cropped.jpg' }
              ],
              text: 'Then we\'ll take it back. The kingdom built this span for trade and unity, not division and greed. Your fire won\'t stop us.'
            },
            {
              speaker: 'Fire Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Fire Mage', image: '/images/heroes/Fire Mage Cropped.jpg' }
              ],
              text: 'Then let the bridge remember your names. The flames will write your epitaph in ash and cinder.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Fire Mage', image: '/images/heroes/Fire Mage Cropped.jpg' }
              ],
              text: 'And we\'ll remember yours as the man who stood in the way of justice. The bridge falls today—for the kingdom and the people you\'ve forgotten.'
            }
          ],
          enemyTeam: 'brave_ashbridge',
          next: ['phalanx']
        },
        {
          id: 'phalanx',
          type: 'miniboss',
          title: 'The Unbroken Phalanx',
          description: 'Former royal guards now sell their oaths to the highest bidder.',
          preBattle: [
            'The Unbroken Phalanx marches with the precision of royal guards, their formation a testament to the discipline that once made the Brave Kingdom formidable. But their shields, once emblazoned with the kingdom\'s crest, now bear a layer of gold paint that cannot hide the shame beneath. These are not mercenaries hired for a season; they are the kingdom\'s own elite soldiers, the men who once protected the Crown and defended the borders.',
            'Their leader, a paladin whose faith has been corrupted by coin, commands them with the same barked orders that once held the line against invaders. But now their spears point inward, guarding not the realm but the interests of the mercenary lords who bought their loyalty. The Contract Age has turned protectors into predators, and the phalanx represents the ultimate betrayal—the kingdom\'s own strength turned against it.',
            'Knight and Lancer watch from a ridge as the formation advances, their hearts heavy with recognition. These men were comrades, brothers-in-arms who shared the same hardships and victories. But hunger and broken promises have driven them to this. The warband must decide: attempt to reason with them, appealing to the oaths they once swore, or fight and prove that some ideals cannot be purchased.',
            'As the phalanx halts and forms a defensive line, their paladin leader steps forward. His armor gleams with relic enhancements, bought with the same gold that starves the kingdom. This confrontation is more than a battle; it\'s a reckoning with the Contract Age\'s toll on the human spirit. The phalanx stands as a mirror, reflecting what Knight and Lancer might become if they lose their way in the valley\'s depths.'
          ],
          dialogue: [
            { speaker: 'Knight', side: 'left', text: 'Those were the Crown\'s sworn shields. I recognize the formation—we drilled it together in the border wars. How did it come to this?' },
            { speaker: 'Lancer', side: 'right', text: 'Oaths are brittle when hunger is sharper than steel. The Crown couldn\'t pay them, so the merc lords did. Now they guard the same vaults they once protected.' },
            { speaker: 'Knight', side: 'left', text: 'But they still wear the crest, even if it\'s painted over. If we break them here, we end the lie that honor can be purchased like a commodity.' },
            { speaker: 'Lancer', side: 'right', text: 'And if we don\'t, we validate their choice. The people need to see that some lines cannot be crossed, even for survival.' },
            { speaker: 'Knight', side: 'left', text: 'These men were our brothers. I don\'t want to kill them, but I won\'t let them block our path. The relic could restore what\'s been lost.' },
            { speaker: 'Lancer', side: 'right', text: 'Then we give them a choice: stand aside and reclaim their honor, or fall and become a lesson for every soldier watching.' },
            { speaker: 'Knight', side: 'left', text: 'The paladin leading them... he was a man of faith once. What corrupted him so thoroughly?' },
            { speaker: 'Lancer', side: 'right', text: 'The same thing that corrupts us all—the fear of watching your family starve. But fear is no excuse for betrayal.' },
            { speaker: 'Knight', side: 'left', text: 'Then let\'s remind them what real strength looks like. Forward—for the kingdom and the oaths we still honor.' }
          ],
          battleDialogue: [
            {
              speaker: 'Paladin',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Paladin', image: '/images/heroes/Paladin Cropped.jpg' }
              ],
              text: 'We held the line when the Crown sold its own army. We stood firm when the mercenaries came to collect their contracts. We will not be shamed for surviving.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Paladin', image: '/images/heroes/Paladin Cropped.jpg' }
              ],
              text: 'Survival bought with stolen oaths is not honor. You were the kingdom\'s shield, sworn to protect the people, not extort them. How did faith become a commodity?'
            },
            {
              speaker: 'Paladin',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Paladin', image: '/images/heroes/Paladin Cropped.jpg' }
              ],
              text: 'Faith? The gods abandoned us when the Crown bankrupted the temples. My prayers went unanswered when my family starved. The mercenary lords offered gold, not salvation.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Paladin', image: '/images/heroes/Paladin Cropped.jpg' }
              ],
              text: 'Stand aside. The relics are not your wage. They belong to the kingdom that built this phalanx, not the lords who bought your soul.'
            },
            {
              speaker: 'Paladin',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Paladin', image: '/images/heroes/Paladin Cropped.jpg' }
              ],
              text: 'My soul was never for sale—it was taken. The Crown took our pay, the lords took our loyalty. Now we take what we can. Prove your claim in formation, or join the ranks of the defeated.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Paladin', image: '/images/heroes/Paladin Cropped.jpg' }
              ],
              text: 'We\'ll prove it. But know this—breaking you here isn\'t victory. It\'s mercy. The Contract Age ends today, one broken oath at a time.'
            },
            {
              speaker: 'Paladin',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Paladin', image: '/images/heroes/Paladin Cropped.jpg' }
              ],
              text: 'Mercy? The Crown showed us none when they sold our contracts. Form up, brothers—these idealists come to test our resolve.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Paladin', image: '/images/heroes/Paladin Cropped.jpg' }
              ],
              text: 'Then let the formation break. For the kingdom, for the oaths you\'ve forgotten, and for the people who still believe in honor.'
            }
          ],
          enemyTeam: 'brave_phalanx',
          reward: 'relic',
          next: ['fork_of_oaths']
        },
        {
          id: 'fork_of_oaths',
          type: 'choice',
          title: 'Fork of Oaths',
          description: 'A bannered road and a shadowed path. Both lead deeper into the valley.',
          choices: [
            { id: 'warcamp', label: 'Warcamp', next: 'warcamp' },
            { id: 'watchtower', label: 'Watchtower', next: 'watchtower' }
          ]
        },
        {
          id: 'warcamp',
          type: 'battle',
          title: 'Warcamp',
          description: 'Hired blades test your resolve before granting passage.',
          preBattle: [
            'The warcamp sprawls across a scarred plateau like a predatory beast, its tents clustered around cooking fires that burn with unnatural brightness. War drums echo through the valley, keeping time not for marches but for wagers. Mercenary companies from across the kingdoms have gathered here, their banners a patchwork of stolen colors and forged crests. This is no mere encampment; it\'s a marketplace of violence, where contracts are signed in firelight and reputations are bought with blood.',
            'The camp\'s leader is a battle mage, a sorcerer who abandoned the royal academies when the Crown could no longer afford his experiments. His magic twists the air around the camp, creating illusions that make the tents seem to shift and the shadows whisper secrets. Scouts report that he commands a diverse force—deserters, opportunists, and true believers in the Contract Age—all united by the promise of relic wealth.',
            'Knight and Lancer approach cautiously, their warband\'s presence causing ripples through the camp. Mercenaries pause their games of chance, sizing up the newcomers with professional eyes. This is not a toll gate or a desperate garrison; this is a test of whether their ideals can survive in the Contract Age\'s heart. The camp represents the system at its most raw—violence commodified, loyalty auctioned, and power flowing to those ruthless enough to seize it.',
            'As they enter the camp\'s perimeter, the battle mage emerges from his command tent, his robes adorned with relic fragments that glow with stolen power. The mercenaries form a loose circle, not a formation but a crowd of predators sensing weakness. This confrontation will determine not just passage, but whether Knight and Lancer\'s quest remains a noble endeavor or becomes just another mercenary contract.'
          ],
          dialogue: [
            { speaker: 'Lancer', side: 'right', text: 'Every camp has a ledger. Every ledger has a debt. This place reeks of desperation and broken promises.' },
            { speaker: 'Knight', side: 'left', text: 'These men sold their swords to the highest bidder. Now they guard the path we need. The Contract Age has made warriors into merchants.' },
            { speaker: 'Lancer', side: 'right', text: 'And merchants into warriors. Look at them—gambling away their pay, drinking away their regrets. The merc lords promised wealth, but delivered ruin.' },
            { speaker: 'Knight', side: 'left', text: 'We could offer them a better contract. The Crown still has some gold left—enough to buy their passage.' },
            { speaker: 'Lancer', side: 'right', text: 'Pay them? That validates their system. We\'re not here to bargain; we\'re here to take what\'s ours by right.' },
            { speaker: 'Knight', side: 'left', text: 'But fighting them all would be suicide. There must be a hundred blades here, all hungry for relic wealth.' },
            { speaker: 'Lancer', side: 'right', text: 'Then we make our stand. Let this camp remember that some things still can\'t be purchased.' },
            { speaker: 'Knight', side: 'left', text: 'The battle mage leading them... his magic could tear us apart before we close. But we\'ve faced worse odds.' },
            { speaker: 'Lancer', side: 'right', text: 'And won. Forward—we show them what real strength looks like, not bought but earned.' }
          ],
          battleDialogue: [
            {
              speaker: 'Battle Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Battle Mage', image: '/images/heroes/Battle Mage Cropped.jpg' }
              ],
              text: 'You walk through my camp or you pay. That is the only law here. The drums beat for gold, not glory. What do you offer?'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Battle Mage', image: '/images/heroes/Battle Mage Cropped.jpg' }
              ],
              text: 'We offer nothing. This camp squats on kingdom land, blocking kingdom roads. The Contract Age doesn\'t give you ownership.'
            },
            {
              speaker: 'Battle Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Battle Mage', image: '/images/heroes/Battle Mage Cropped.jpg' }
              ],
              text: 'Ownership? I bought this ground with blood and broken promises. The academies cast me out when the Crown couldn\'t pay. Now I take what I\'m owed.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Battle Mage', image: '/images/heroes/Battle Mage Cropped.jpg' }
              ],
              text: 'We are not here to bargain. The relics call to those worthy of them, not those who steal passage. Stand aside or be moved.'
            },
            {
              speaker: 'Battle Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Battle Mage', image: '/images/heroes/Battle Mage Cropped.jpg' }
              ],
              text: 'Moved? I\'ve studied the ancient arts, twisted them to my will. My illusions will make you question reality itself. You think you can challenge me?'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Battle Mage', image: '/images/heroes/Battle Mage Cropped.jpg' }
              ],
              text: 'We don\'t challenge—we conquer. Your magic bought the same way as your camp. The Contract Age ends here.'
            },
            {
              speaker: 'Battle Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Battle Mage', image: '/images/heroes/Battle Mage Cropped.jpg' }
              ],
              text: 'Good. Bargains bore me. Let the camp witness your end. My mercenaries hunger for a real fight, not another negotiation.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Battle Mage', image: '/images/heroes/Battle Mage Cropped.jpg' }
              ],
              text: 'Then feed them. But know this—when we\'re done, this camp will remember that some debts can\'t be paid in gold.'
            }
          ],
          enemyTeam: 'brave_warcamp',
          reward: 'relic',
          next: ['iron_regent']
        },
        {
          id: 'watchtower',
          type: 'battle',
          title: 'Watchtower',
          description: 'A scorched tower hides a relic fragment and a stubborn defense.',
          preBattle: [
            'The watchtower leans into the perpetual wind of Brimstone Valley like a wounded sentinel, its stone blackened by siege fires from wars long past. The structure was built in a more prosperous age, when the kingdom could afford to maintain outposts along the valley\'s treacherous approaches. Now it serves as a hermit\'s refuge and a relic guardian, its upper chambers housing an arcane mage who defected from the royal academies during the bankruptcy.',
            'Inside the tower, a shard of relic power glows with a stubborn, otherworldly light, pulsing like a heartbeat in the darkness. The arcane mage has bound himself to this fragment, using its energy to maintain protective wards that make the tower impervious to casual intrusion. Scouts report that he lives as a recluse, his mind warped by years of studying forbidden relic lore, convinced that he alone understands the true nature of the valley\'s treasures.',
            'Knight and Lancer approach with reverence, recognizing the tower as one of the kingdom\'s last intact fortifications. But the arcane mage sees them as thieves, not saviors. His magic creates illusions that make the path to the tower shift and change, testing the warband\'s resolve. This is not a battle for territory, but for knowledge—the mage possesses ancient texts that could illuminate the relics\' true purpose.',
            'As they draw near, the tower\'s wards flare with defensive energy, and the arcane mage appears at a high window, his eyes glowing with relic-enhanced sight. The confrontation represents a clash of ideologies: the mage\'s solitary pursuit of knowledge versus the warband\'s mission to restore the kingdom. The relic shard within could be the key to understanding why five kingdoms now converge on the same ash-choked valley.'
          ],
          dialogue: [
            { speaker: 'Knight', side: 'left', text: 'Relics should not be guarded by hermits in ruined towers. That is the point of them—they belong to those who can use them for the greater good.' },
            { speaker: 'Lancer', side: 'right', text: 'The point now is survival. We give the shard a better home, where it can awaken armories and feed the hungry, not fuel one man\'s obsession.' },
            { speaker: 'Knight', side: 'left', text: 'This tower was kingdom-built, kingdom-funded. The arcane mage swore the same oaths as the scholars who trained him. He\'s a deserter, not a guardian.' },
            { speaker: 'Lancer', side: 'right', text: 'Deserter or devotee, he stands in our way. The valley calls, and we\'ve come too far to turn back. The shard could be the key to everything.' },
            { speaker: 'Knight', side: 'left', text: 'His magic could unravel us before we reach the door. But we\'ve faced sorcerers before—illusions break when met with steel.' },
            { speaker: 'Lancer', side: 'right', text: 'And resolve. The Contract Age has corrupted many, but some still pursue knowledge for its own sake. Perhaps we can reason with him.' },
            { speaker: 'Knight', side: 'left', text: 'Reason with a man who lives in isolation, bound to a glowing rock? He\'s beyond reason. But we\'ll try words before blades.' },
            { speaker: 'Lancer', side: 'right', text: 'And if words fail, we take what we came for. The kingdom needs that shard more than this tower needs a mad guardian.' },
            { speaker: 'Knight', side: 'left', text: 'Agreed. Forward—we claim what\'s ours, for the people who still believe in the kingdom\'s future.' }
          ],
          battleDialogue: [
            {
              speaker: 'Arcane Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Arcane Mage', image: '/images/heroes/Arcane Mage Cropped.jpg' }
              ],
              text: 'Turn back. This shard is bound by contract and by blood. I claimed it when the academies abandoned me. It speaks to me of ancient powers.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Arcane Mage', image: '/images/heroes/Arcane Mage Cropped.jpg' }
              ],
              text: 'Contracts do not bind the crown\'s oath. You were trained in the royal academies, sworn to serve the realm. This tower was built with kingdom stone and kingdom gold.'
            },
            {
              speaker: 'Arcane Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Arcane Mage', image: '/images/heroes/Arcane Mage Cropped.jpg' }
              ],
              text: 'The academies cast me out when the Crown couldn\'t pay my stipend. I found true knowledge here, in isolation. The shard shows me visions of the covenant—the ancient pact that binds all magic.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Arcane Mage', image: '/images/heroes/Arcane Mage Cropped.jpg' }
              ],
              text: 'Visions? Or madness? The relics belong to the kingdom that needs them, not the hermit who hoards them. We will carry it where it can restore what\'s been lost.'
            },
            {
              speaker: 'Arcane Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Arcane Mage', image: '/images/heroes/Arcane Mage Cropped.jpg' }
              ],
              text: 'Lost? You understand nothing. The Heart of Brimstone is one piece of five. Each kingdom pursues its shard, but only I see the pattern. The covenant was broken long ago.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Arcane Mage', image: '/images/heroes/Arcane Mage Cropped.jpg' }
              ],
              text: 'Then share your knowledge. The kingdom needs saviors, not secrets. Help us understand, and we\'ll ensure the shard serves the greater good.'
            },
            {
              speaker: 'Arcane Mage',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Arcane Mage', image: '/images/heroes/Arcane Mage Cropped.jpg' }
              ],
              text: 'Greater good? I\'ve seen what men do with power. The mercenary lords would shatter the covenant further. No—you will leave the shard here, where it belongs.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'Arcane Mage', image: '/images/heroes/Arcane Mage Cropped.jpg' }
              ],
              text: 'Then we will take it by force. Your illusions and wards won\'t stop us. The kingdom claims what\'s rightfully ours—for the people who still believe in a future beyond contracts.'
            }
          ],
          enemyTeam: 'brave_watchtower',
          reward: 'relic',
          next: ['iron_regent']
        },
        {
          id: 'iron_regent',
          type: 'boss',
          title: 'The Iron Regent',
          description: 'A knight in stolen relic-plate guards the Heart of Brimstone.',
          preBattle: [
            'The Heart of Brimstone pulses at the valley\'s core like a second sun, its power so immense that it warps the air around it and makes the ground tremble with each beat. Guarding this ultimate relic is the Iron Regent, a knight who has fused his body with relic-plate armor, becoming more machine than man. Once a loyal champion of the Crown, he was corrupted by the Heart\'s power, convinced that he alone is worthy to wield its might.',
            'The regent\'s armor drinks the light, absorbing energy from the surrounding ash and converting it into devastating power. His movements are unnaturally precise, his strikes enhanced by relic circuitry that predicts and counters attacks. Scouts who have glimpsed him speak of a being who has transcended humanity, becoming the perfect guardian for the valley\'s greatest treasure.',
            'Knight and Lancer approach the chamber with a mixture of awe and determination. The Heart represents the culmination of their journey—the key to restoring the kingdom and breaking the mercenary lords\' grip. But the Iron Regent stands as the ultimate test, a fallen hero who embodies what they might become if they claim the relic\'s power. This is not just a battle for possession, but a confrontation with the corrupting influence of absolute power.',
            'As they enter the chamber, the Heart\'s pulse synchronizes with the regent\'s armored form, creating a symphony of power that shakes the very foundations of the valley. The Iron Regent speaks with a voice distorted by relic enhancements, his words a chilling reminder that the Contract Age has claimed even the noblest souls. Victory here will not just secure the relic—it will determine whether Knight and Lancer remain heroes or become tyrants.'
          ],
          dialogue: [
            { speaker: 'Knight', side: 'left', text: 'If we take the Heart, the mercenary lords lose their leverage. The kingdom can rebuild its armories, feed its people, restore what\'s been stolen.' },
            { speaker: 'Lancer', side: 'right', text: 'And if we fail, the kingdom becomes a contract forever. The lords will own the land, the laws, and the future. We cannot turn back now.' },
            { speaker: 'Knight', side: 'left', text: 'Then we do not fail. The Heart belongs to the people who built this kingdom, not the machine that guards it.' },
            { speaker: 'Lancer', side: 'right', text: 'Look at him—he was a knight once, like you. The relic corrupted him, turned him into this... thing. We must not let it do the same to us.' },
            { speaker: 'Knight', side: 'left', text: 'We won\'t. Our oaths are stronger than any relic\'s pull. Forward—we end this and begin the restoration.' }
          ],
          battleDialogue: [
            {
              speaker: 'Iron Regent',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'You still speak of crowns and kingdoms. The era of crowns is over. I have transcended such weaknesses. The Heart showed me the truth—power is the only constant.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'The era ends when we let it. You were a knight once, sworn to protect the realm. The relic corrupted you, but it doesn\'t have to corrupt us. Step aside.'
            },
            {
              speaker: 'Iron Regent',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'Corruption? This is evolution. The Heart enhanced me, made me perfect. I see the patterns now—the five kingdoms, the shattered covenant. You are blind, clinging to outdated ideals.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'We came for the Heart. It belongs to the kingdom that needs it, not the machine that hoards it. Step aside or be broken. The people deserve a future beyond your metal cage.'
            },
            {
              speaker: 'Iron Regent',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'Broken? I am beyond breaking. The relic-plate makes me immortal, invincible. You will join the ranks of those who challenged me—ashes in the valley wind.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'Immortal? You\'re a prisoner in your own armor, a slave to the power you serve. We fight for freedom—for the kingdom and the people you\'ve forgotten.'
            },
            {
              speaker: 'Iron Regent',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'Forgotten? I remember everything. The Crown\'s betrayal, the army\'s sale, the people\'s suffering. The Heart will bring order through strength, not weakness.'
            },
            {
              speaker: 'Lancer',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'Order through tyranny? No. We\'ll take the Heart and use it to restore what was lost. For honor, for the kingdom, and for the future you\'ve denied.'
            },
            {
              speaker: 'Iron Regent',
              side: 'right',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'Then come and test the metal of your oaths. The Heart will judge you worthy or unworthy. I am its instrument—and you will break against me.'
            },
            {
              speaker: 'Knight',
              side: 'left',
              leftPortraits: [
                { name: 'Knight', image: '/images/heroes/Knight Cropped.jpg' },
                { name: 'Lancer', image: '/images/heroes/Lancer Cropped.jpg' }
              ],
              rightPortraits: [
                { name: 'King', image: '/images/heroes/King Cropped.jpg' }
              ],
              text: 'We don\'t break. We endure. For the Brave Kingdom and the people who still fight for it.'
            }
          ],
          enemyTeam: 'brave_iron_regent',
          reward: 'relic',
          next: []
        }
      ]
    }
  },
  magic: {
    id: 'magic',
    name: 'Magic Kingdom',
    bannerHeroes: ['arcaneMageID', 'elementalistID'],
    intro: [
      'The Magic Kingdom feels its archives unravel. Spells slip from the page like smoke.',
      'The Council believes the Heart of Brimstone anchors the weave of all magic.',
      'They seek it not to rule, but to keep reality from fraying.'
    ],
    outro: [
      'The relic resonates with a pattern the Council cannot yet decode.',
      'Their divinations show other shards moving under five banners.'
    ],
    map: { start: null, nodes: [] }
  },
  faith: {
    id: 'faith',
    name: 'Faith Kingdom',
    bannerHeroes: ['angelID', 'paladinID'],
    intro: [
      'The Faith Kingdom is starved of harvest and hope. Pilgrims outnumber provisions.',
      'The clergy believes the Heart can bless the land, but the relic answers to no vow.'
    ],
    outro: [
      'The relic does not speak of mercy, only of a covenant broken long ago.'
    ],
    map: { start: null, nodes: [] }
  },
  monster: {
    id: 'monster',
    name: 'Monster Kingdom',
    bannerHeroes: ['bileCreatureID', 'ironGolemID'],
    intro: [
      'The Monster Kingdom does not bargain. It consumes.',
      'Famine in the deep warrens drives the brood toward Brimstone Valley and its relics.'
    ],
    outro: [
      'The Heart burns brighter, and the monsters smell more shards in the dark.'
    ],
    map: { start: null, nodes: [] }
  },
  outcasts: {
    id: 'outcasts',
    name: 'Outcasts',
    bannerHeroes: ['jesterID', 'berserkerID'],
    intro: [
      'The Outcasts are a patchwork of broken banners and burned names.',
      'They seek the relic not for a kingdom, but for a future that does not demand surrender.'
    ],
    outro: [
      'The Heart is not a savior. It is a map to a war that never ended.'
    ],
    map: { start: null, nodes: [] }
  }
};

export function getStoryArc(kingdomId) {
  return STORY_ARCS[kingdomId] || null;
}

/*
STORYLINE OUTLINE (CONNECTED ARCS)

BRAVE KINGDOM — PART I: “ASHES OF HONOR”
Exposition (6 paragraphs)
The Brave Kingdom had once been the envy of the continent—its armies disciplined, its cities prosperous, its people proud. But when the Great Meltdown struck, the kingdom’s coffers collapsed overnight. Trade routes dried up, the royal treasury emptied, and the once-mighty legions disbanded as soldiers sought coin elsewhere. In the vacuum left behind, mercenary lords rose like weeds through cracked stone, each commanding bands of former knights, warriors, and sellswords who now fought only for relics.
Relics—strange, shimmering artifacts pulled from the depths of Brimstone Valley—had become the only stable currency. Whoever controlled the valley controlled the future. And so the five kingdoms, weakened and desperate, circled it like starving wolves. The Brave Kingdom, though proud, was no exception.
Lancer had served the royal army since he was a boy, trained in the old ways of honor and loyalty. He believed in the kingdom even as it crumbled around him. Knight, his closest friend, had a different view. Knight had seen the corruption in the royal court, the incompetence of nobles who clung to tradition while the world burned. To him, the mercenary lords represented a new order—harsh, but honest.
The two men returned to the capital after a failed expedition to Brimstone Valley, carrying only a single relic and a wounded conscience. They found the city changed. Royal banners still hung from the towers, but mercenary colors fluttered beside them. The palace guard now shared patrol routes with hired blades. The people whispered that the king had begun paying mercenaries to enforce his will.
Inside the palace, the royal family debated how to reclaim their power. Queen Aralyn feared the mercenary lords were becoming too influential. Prince Rowan believed they were necessary to survive. The Stonecased King—once a warrior of legend—had grown cold and distant, his body stiffening from a mysterious affliction that left him half-living marble. His silence forced others to speak in his stead.
And so the kingdom teetered between two futures: one clinging to the old ideals, the other embracing the ruthless pragmatism of the new age. Lancer and Knight, unaware of how deeply they were already entangled in this struggle, were summoned to the palace for a mission that would test their loyalty—and their friendship.

Character Scenes (2 scenes)
Scene 1 — The Palace War Room
Queen Aralyn: “You bring only one relic? Brimstone Valley yields dozens each day. What happened?”
Lancer: “The Monster Kingdom moved faster than expected. Their titan shattered our forward line. We barely escaped.”
Knight: “And we escaped because we weren’t weighed down by dead men’s ideals. If we had hired mercenaries—”
Prince Rowan: “Enough. The valley grows more contested by the hour. We need a foothold, not excuses.”
Queen Aralyn: “Lancer, you remain loyal to the crown. Tell me plainly—can the royal army reclaim the valley?”
Lancer: “Not without unity. Our forces are scattered. The mercenary lords answer to coin, not command.”
Knight: “Then pay them. Or let them lead. The old ways are gone, Your Majesty.”
The queen’s eyes narrowed. The prince watched Knight with interest. Lancer felt the room shift around him, as if invisible lines were being drawn.

Scene 2 — The Training Grounds
The two men sparred beneath the fading sun, steel ringing against steel.
Lancer: “You spoke boldly in the war room.”
Knight: “Someone had to. The queen clings to a kingdom that no longer exists.”
Lancer: “And you think the mercenary lords will build something better?”
Knight: “They already have. Order through strength. Payment for service. No lies about honor.”
Lancer hesitated, lowering his blade.
Lancer: “Honor isn’t a lie.”
Knight: “Maybe not. But it’s a luxury we can’t afford.”
A horn sounded from the palace walls. A messenger sprinted toward them.
Messenger: “Lancer! Knight! The queen commands your presence. A mercenary lord has seized one of our relic caravans. She wants you to take it back.”
Knight smirked.
Knight: “And so it begins.”

Battle Setup
The relic caravan had been ambushed near the border by Mercenary Lord Varric, a former Brave Kingdom captain who now commanded a ruthless band of warriors, shield maidens, and rogue outcasts. He claimed the relics as payment for “unsettled debts” owed by the crown.
The queen wanted the relics returned.
The prince wanted Varric brought into the fold.
Knight wanted to hear Varric’s offer.
Lancer wanted to uphold the kingdom’s honor.
Only one of them would get what they wanted.

Battle: “The Caravan Clash”
The battlefield is a narrow canyon road. Varric’s forces hold the high ground, guarding the stolen relic crates. Lancer and Knight lead a small strike team of warriors, shield maidens, and a tinkerer who rigs explosive traps.
The fight erupts in a storm of steel and dust. Shield maidens crash into rogue outcasts. Warriors clash with mercenary veterans. The tinkerer detonates a ridge, forcing Varric’s archers to reposition.
At the climax, Lancer confronts Varric directly.
Varric: “You should be fighting with us, boy. The crown will fall. But mercenaries? We endure.”
Lancer: “I fight for the kingdom.”
Knight (arriving): “And I fight for the future.”
The three clash in a brutal exchange. Varric is forced to retreat, but not before planting a seed of doubt in Knight’s mind—and a warning in Lancer’s.
The relics are recovered.
But the kingdom is now one step closer to civil war.

PART II: “THE MERCENARY’S BARGAIN”
Exposition (7 paragraphs)
The victory at the caravan did little to stabilize the Brave Kingdom. If anything, it exposed how fragile the royal family’s authority had become. Mercenary Lord Varric’s retreat was not a defeat—it was a message. He had tested the kingdom’s resolve and found it wanting. Rumors spread that he was gathering more relics, more soldiers, and more outcasts who believed the crown’s days were numbered.
Within the capital, the tension between the queen and the prince grew sharper. Queen Aralyn insisted on reinforcing the royal army, even if it meant rationing food and supplies. Prince Rowan argued that the kingdom should negotiate with the mercenary lords, offering them legitimacy in exchange for loyalty. The Stonecased King remained silent, his body stiffening further, his voice fading like a dying ember. His advisors whispered that soon he would be unable to move at all.
Lancer and Knight returned to the city as uneasy heroes. The people cheered them, but the cheers were hollow—born of desperation, not pride. The two men sensed the shift. The kingdom they had once served was becoming something else, something brittle and uncertain. Lancer clung to the belief that honor could still guide them. Knight saw only the cracks widening.
The relics recovered from Varric were immediately locked in the palace vaults. But the queen had a new problem: a faction of palace guards had begun accepting bribes from mercenary lords. Some openly questioned whether the royal family could protect them. Others whispered that Prince Rowan was secretly meeting with Varric’s envoys.
Meanwhile, Brimstone Valley grew more dangerous by the day. The Monster Kingdom had unleashed a new wave of creatures—werewolves, water golems, and bile beasts—to secure relic-rich zones. The Mage Kingdom erected arcane wards that scorched intruders. Even the Faith Kingdom sent spectral emissaries to claim “divinely ordained” territory.
The Brave Kingdom needed relics to survive. But every expedition risked provoking a war they could not win. And so the queen devised a plan: send a small, elite team to negotiate with a neutral mercenary lord—Lord Halbrecht, a former knight known for his strict code. If he could be convinced to side with the crown, others might follow.
Lancer was chosen for his loyalty. Knight was chosen for his pragmatism. Together, they would travel to Halbrecht’s fortress and secure an alliance… or die trying.

Character Scenes (2 scenes)
Scene 1 — The Queen’s Private Chamber
Queen Aralyn dismissed her attendants and faced the two men alone.
Queen Aralyn: “Lord Halbrecht respects strength and conviction. Lancer, that is why you will speak for us.”
Knight: “And what am I? Decoration?”
Queen Aralyn: “You are… perspective. Halbrecht distrusts idealists. He will want to hear from someone who understands the mercenary mind.”
Knight smirked, though his eyes narrowed.
Lancer: “Your Majesty, if Halbrecht refuses—”
Queen Aralyn: “He cannot refuse. Not if he wishes to survive. Varric grows bolder. The prince grows reckless. And the king…” She hesitated. “The king may not last the month.”
A heavy silence settled.
Queen Aralyn: “Bring Halbrecht to our side. Or we lose the kingdom.”

Scene 2 — On the Road to Halbrecht’s Fortress
The two men rode through the cracked plains, relic storms flickering in the distance.
Knight: “You trust her too much.”
Lancer: “She’s the queen.”
Knight: “She’s desperate. Desperate rulers make dangerous decisions.”
Lancer tightened his grip on the reins.
Lancer: “And what of you? You speak as if you’ve already chosen a side.”
Knight: “I’ve chosen survival. The crown can’t protect us anymore. Halbrecht, Varric, the mercenary lords—they’re the ones shaping the future.”
Lancer: “A future built on coin and blood.”
Knight: “Better than a past built on lies.”
The wind howled across the plains. Neither spoke for a long time.

Battle Setup
When Lancer and Knight arrive at Halbrecht’s fortress, they find it under siege.
A rogue faction of mercenaries—The Iron Wolves, led by a brutal axeman named Garruk the Red—has launched a surprise attack to force Halbrecht into joining Varric’s growing coalition.
Halbrecht’s forces are pinned behind barricades. The fortress walls are cracked. Smoke rises from the battlements.
Lancer sees an opportunity to prove the Brave Kingdom’s worth.
Knight sees an opportunity to negotiate with Halbrecht from a position of strength.
Both see that if they do nothing, Halbrecht will fall—and Varric will gain another powerful ally.

Battle: “Siege of the Iron Wolves”
The battlefield is the outer courtyard of Halbrecht’s fortress. The Iron Wolves have breached the first gate and are pushing toward the inner keep. Axemen and berserkers lead the charge, supported by rogue archers perched on the walls.
Lancer rallies Halbrecht’s defenders, forming a disciplined shield line to halt the berserkers’ advance. Knight leads a flanking maneuver, cutting through the archers and seizing control of the battlements.
At the height of the battle, Garruk the Red smashes through the shield line, roaring for Halbrecht’s surrender. Lancer intercepts him, their weapons clashing in a storm of sparks. Knight arrives moments later, striking from behind to weaken the brute.
Together, they bring Garruk to his knees.
The Iron Wolves retreat.
Halbrecht emerges from the keep, battered but alive.
Halbrecht: “You saved my fortress. Now tell me—why should I save your kingdom?”
Lancer and Knight exchange a look.
Their answers will shape the future.


BRAVE KINGDOM — PART III: “THE OATH AND THE BETRAYAL”
Exposition (7 paragraphs)
Lord Halbrecht’s fortress smoldered in the aftermath of the Iron Wolves’ assault. The courtyard was littered with broken shields, shattered arrows, and the bodies of mercenaries who had gambled on Varric’s rising power. Halbrecht’s soldiers moved among the wounded with grim efficiency, their discipline a stark contrast to the chaos that had nearly consumed them. Lancer felt a familiar sense of pride—this was what the Brave Kingdom used to be.
But Halbrecht was no longer a knight of the crown. He had abandoned the kingdom years ago, disgusted by the corruption he witnessed in the royal court. His fortress stood as a symbol of what the Brave Kingdom had lost: honor without politics, strength without ambition. And now, with Varric’s influence spreading, Halbrecht found himself cornered between two futures he did not trust.
Lancer spoke passionately of unity, of restoring the kingdom’s dignity, of resisting the mercenary lords who sought to carve the land into fiefdoms. Halbrecht listened, his expression unreadable. Knight, however, offered a different vision—one where the Brave Kingdom adapted rather than clung to dying traditions. He argued that relics, not royal decrees, now shaped power. Halbrecht respected the blunt truth in Knight’s words.
The two arguments mirrored the fracture growing within the Brave Kingdom itself. Queen Aralyn had sent Lancer to secure Halbrecht’s loyalty. Prince Rowan had quietly encouraged Knight to “keep an open mind.” And Halbrecht, caught between these competing visions, demanded time to consider his choice.
As the fortress was repaired, Halbrecht invited Lancer and Knight to stay as his guests. But the hospitality was thin. Halbrecht’s lieutenants watched them closely. Rumors spread that Varric was preparing a second assault—this time with support from the Outcast Kingdom’s rogues and assassins. Halbrecht’s neutrality was no longer sustainable.
Meanwhile, back in the capital, the queen received troubling news: a faction of palace guards had defected, joining a mercenary company loyal to Varric. Prince Rowan insisted this was proof that the kingdom needed alliances, not stubborn pride. The queen saw it as treason. And in the shadows of the palace, whispers grew that the Stonecased King’s condition had worsened.
The Brave Kingdom was running out of time. And Halbrecht’s decision—whatever it would be—could tip the balance toward salvation or collapse.

Character Scenes (3 scenes)
Scene 1 — Halbrecht’s Hall
Halbrecht stood before the great hearth, staring into the flames as Lancer and Knight waited.
Halbrecht: “You both speak of futures. But neither of you speaks of cost.”
Lancer: “The cost is worth paying if it restores the kingdom.”
Knight: “The cost is inevitable. Better to choose who collects it.”
Halbrecht turned sharply.
Halbrecht: “And what of the people? The farmers who starve while nobles hoard grain? The soldiers abandoned after the meltdown? The mercenaries who fight because they have no home?”
Lancer stepped forward.
Lancer: “We rebuild. Together.”
Knight’s voice cut through the hall.
Knight: “Or we adapt. Together.”
Halbrecht exhaled slowly.
Halbrecht: “I will give you my answer at dawn.”

Scene 2 — The Ramparts at Midnight
Knight leaned against the stone wall, staring out at the dark plains. Lancer approached quietly.
Lancer: “You spoke well today.”
Knight: “I spoke honestly.”
Lancer: “You spoke like someone who’s already chosen the mercenary lords.”
Knight didn’t look away from the horizon.
Knight: “Maybe I have. Maybe I’m tired of serving a kingdom that won’t save itself.”
Lancer: “The queen is trying.”
Knight: “The queen is drowning. And she’ll drag us down with her.”
Lancer’s jaw tightened.
Lancer: “If you betray the kingdom—”
Knight finally turned, eyes cold.
Knight: “I’m not betraying anything. I’m surviving.”

Scene 3 — Halbrecht’s Decision
Dawn broke over the fortress. Halbrecht stood before his assembled soldiers, Lancer, and Knight.
Halbrecht: “I have made my choice.”
A tense silence.
Halbrecht: “I will support the Brave Kingdom.”
Lancer exhaled in relief.
Halbrecht: “But only under one condition: the prince must come to my fortress and swear an oath of reform. No more corruption. No more blind tradition.”
Knight’s expression darkened.
Knight: “The prince will never agree to that.”
Halbrecht: “Then the kingdom will fall.”
Lancer stepped forward.
Lancer: “I will deliver your terms.”
Knight said nothing.
But his silence was louder than any protest.

Battle Setup
Before Lancer and Knight can depart, Halbrecht’s scouts return with dire news:
Varric has launched a full-scale assault on the fortress.
Not with mercenaries alone—but with Outcast assassins, rogue mages, and a blood golem bound by forbidden rituals.
Varric’s message is clear:
“Halbrecht belongs to me. Stand aside or be crushed.”
Halbrecht refuses.
Lancer prepares to defend the fortress.
Knight hesitates—caught between loyalty to Halbrecht and the growing pull of Varric’s vision.
The battle will force him to choose.

Battle: “The Blood Golem’s Advance”
The battlefield is the outer walls of Halbrecht’s fortress. Varric’s forces surge forward in coordinated waves:
- Outcast assassins scaling the walls
- Rogue mages hurling unstable relic-fire
- A towering blood golem smashing through barricades
- Varric’s elite warriors pushing toward the gate
Lancer leads Halbrecht’s knights in a disciplined countercharge, holding the line against overwhelming odds. Halbrecht himself duels a rogue mage atop the battlements.
Knight stands at the crossroads—literally and figuratively—watching Varric’s banner rise through the smoke.
When the blood golem breaches the inner gate, Knight finally moves.
But not toward Lancer.
He charges the golem from the flank, cutting deep into its binding sigils. The creature collapses in a torrent of crimson sludge.
Lancer sees Knight’s heroism.
He also sees Varric’s forces withdraw the moment Knight intervenes.
As if they expected it.
As if they were waiting for him.
The fortress is saved.
But trust is broken.



BRAVE KINGDOM — PART IV: “FRACTURES IN THE CROWN”
Exposition (8 paragraphs)
The journey back to the Brave Kingdom was colder than the wind that swept across the plains. Lancer rode ahead, carrying Halbrecht’s terms like a sacred burden. Knight followed several paces behind, silent, unreadable. The battle had changed something in him. Lancer had seen it in the way Knight fought—not for the kingdom, not for Halbrecht, but for something else. Something unspoken.
When they reached the capital, they found it transformed. The streets were lined with mercenary banners. Outcast traders openly sold relics in the market square. Palace guards wore mismatched armor—some royal, some mercenary-forged. The people whispered that Prince Rowan had begun hiring mercenary companies to “supplement” the dwindling royal forces.
Inside the palace, the tension was palpable. Queen Aralyn greeted Lancer with relief, but her eyes hardened when she saw Knight. Rumors had reached her—rumors that Knight had spoken with Varric’s envoys, that he had hesitated during the siege, that he had fought with a ferocity that seemed… opportunistic.
The Stonecased King had worsened. His skin had hardened into marble-like plates. His voice was barely a whisper. Some believed he was cursed. Others believed he was already dead, and the queen was hiding it to prevent panic. The truth was known only to a handful of palace healers—and even they were unsure.
Prince Rowan, meanwhile, had grown bold. He argued that the kingdom needed to embrace the new order. He believed relics should be traded freely, that mercenary lords should be granted noble titles, and that the Brave Kingdom should form a coalition with Varric rather than oppose him. The queen saw this as treason. Rowan saw it as survival.
When Lancer delivered Halbrecht’s terms—that the prince must swear an oath of reform—Rowan laughed. He called Halbrecht a relic of a dead age. The queen, however, saw the opportunity. She agreed to the oath immediately, desperate to secure Halbrecht’s disciplined forces.
But Rowan refused. And in refusing, he revealed something far more dangerous:
he had already been in contact with Varric.
The Brave Kingdom was no longer merely divided.
It was on the brink of tearing itself apart.

Character Scenes (3 scenes)
Scene 1 — The Queen’s Council Chamber
Queen Aralyn slammed her hand on the table.
Queen Aralyn: “You met with Varric behind my back?”
Prince Rowan: “I met with a man who understands the world as it is, not as you wish it to be.”
Lancer: “Your Highness, Varric attacked Halbrecht. He nearly destroyed him.”
Rowan: “Because Halbrecht refuses to adapt. Because he clings to old codes that no longer matter.”
Knight stepped forward.
Knight: “The prince isn’t wrong. The kingdom is dying. Varric offers strength.”
Lancer stared at him, stunned.
Lancer: “You would side with him?”
Knight: “I would side with whoever can save us.”
The queen’s voice dropped to a whisper.
Queen Aralyn: “And what if that means betraying your own kingdom?”
Knight didn’t answer.

Scene 2 — The King’s Chamber
Lancer visited the Stonecased King, hoping for guidance. The king lay motionless, his skin cracked like ancient stone.
Lancer: “My king… the kingdom is fracturing. The prince defies the queen. Knight… Knight is slipping away from me.”
The king’s eyes flickered open.
A faint whisper escaped his lips.
Stonecased King: “Trust… the one… who still bleeds.”
Lancer leaned closer.
Lancer: “What does that mean?”
But the king had already fallen silent.

Scene 3 — Knight and Rowan in the Shadows
Knight found Rowan in a secluded corridor, speaking quietly with a hooded figure. When the figure left, Rowan turned to him.
Rowan: “You hesitated during the siege. Why?”
Knight: “I was weighing my options.”
Rowan: “Good. You’re not blinded by loyalty like Lancer. I need someone like you.”
Knight crossed his arms.
Knight: “What are you planning?”
Rowan smiled—a cold, calculating smile.
Rowan: “A new order. One where the crown and the mercenary lords rule together. Varric has agreed to support my claim… if I remove certain obstacles.”
Knight’s jaw tightened.
Knight: “Obstacles like the queen.”
Rowan didn’t deny it.
Rowan: “And Halbrecht. And anyone else who refuses to adapt.”
Knight hesitated.
Then Rowan delivered the final blow.
Rowan: “Help me, and I’ll make you commander of the new army.”
Knight said nothing.
But silence was enough.

Battle Setup
The queen, fearing Rowan’s growing influence, orders Lancer to escort her to Halbrecht’s fortress so she can swear the oath personally.
Rowan cannot allow this.
He dispatches a covert strike force—rogue mercenaries, palace guards loyal to him, and a dark mage who specializes in illusions—to intercept the queen’s caravan before it reaches Halbrecht.
Knight is ordered to lead the strike force.
He accepts.
But he does not know Lancer is with the queen.
The two friends are now on a collision course.

Battle: “Ambush at Dawnfall Bridge”
The battlefield is a narrow stone bridge spanning a deep ravine. Mist rolls across the surface, conjured by the dark mage to obscure the ambush.
As the queen’s caravan crosses the bridge, illusions twist the air—phantom soldiers, false pathways, shifting shadows. Lancer senses the trap and rallies the shield maidens to form a protective ring around the queen.
Then Knight emerges from the mist.
Knight: “Lancer… stand aside.”
Lancer: “You’re with Rowan.”
Knight: “I’m with the future.”
The battle erupts.
- Rogue mercenaries clash with shield maidens
- Palace guards turn on their former comrades
- The dark mage conjures spectral blades that slice through the fog
- Lancer duels Knight in a brutal, emotional clash
At the climax, the dark mage unleashes a killing spell aimed at the queen.
Knight hesitates.
Just long enough for Lancer to intercept the spell—shattering his shield and nearly collapsing.
The queen escapes with her remaining guards.
Knight watches her flee.
He could pursue.
He doesn’t.
The ambush fails.
But the friendship is broken.




BRAVE KINGDOM — PART V: “THE SHATTERED OATH”
Exposition (8 paragraphs)
The queen’s escape from Dawnfall Bridge sent shockwaves through the Brave Kingdom. Word spread quickly: Prince Rowan had attempted to intercept her caravan. Some called it a misunderstanding. Others whispered the truth — that Rowan had tried to seize power by force. The queen, shaken but alive, pressed on toward Halbrecht’s fortress with a skeleton escort. Lancer rode at her side, wounded but unbroken.
Knight returned to the capital under Rowan’s orders. The prince praised him for “minimizing casualties,” but Knight felt no pride. The ambush had crossed a line he never intended to cross. He had not struck the queen, but he had stood among those who tried. And Lancer’s expression — that mixture of pain and disbelief — haunted him more than any wound.
In the capital, Rowan moved quickly. He summoned the nobles, claiming the queen had fled in fear of “foreign influence.” He argued that her alliance with Halbrecht threatened the kingdom’s sovereignty. Many nobles, desperate for stability, believed him. Others saw through the lies but lacked the power to oppose him. The Stonecased King, now nearly immobile, could not intervene.
Meanwhile, the queen reached Halbrecht’s fortress. The old knight received her with solemn respect. When she knelt and swore the Oath of Reform — promising to purge corruption, restore the army, and rebuild the kingdom — Halbrecht accepted. His disciplined forces now stood with the crown. But he warned her that Rowan’s ambitions would not end with an ambush.
Lancer, recovering from his injuries, trained alongside Halbrecht’s soldiers. He felt a renewed sense of purpose. The queen’s oath had rekindled his faith in the kingdom. But he could not shake the memory of Knight’s blade clashing against his own. The two had fought side by side for years. Now they stood on opposite sides of a war neither had wanted.
Knight, for his part, found himself increasingly isolated. Rowan trusted him — but only as a tool. Varric’s envoys watched him with predatory interest. The palace guards loyal to Rowan treated him with wary respect. And the people whispered that he had betrayed the queen. Knight began to realize that in choosing “the future,” he had stepped into a world where loyalty was currency and trust was a liability.
The Brave Kingdom was now split in two:
the Queen’s Loyalists, fortified at Halbrecht’s stronghold,
and Rowan’s Reformists, entrenched in the capital with mercenary support.
War was no longer a possibility.
It was inevitable.

Character Scenes (3 scenes)
Scene 1 — Halbrecht’s Strategy Chamber
Halbrecht studied a map spread across a stone table. The queen and Lancer stood beside him.
Halbrecht: “Rowan controls the capital, the treasury, and half the palace guard. But he lacks discipline. His forces are a patchwork of mercenaries.”
Queen Aralyn: “He will strike first. He must, before the nobles question him.”
Lancer: “Then we strike faster. We march on the capital.”
Halbrecht shook his head.
Halbrecht: “A siege would cost thousands of lives. Rowan will use civilians as shields.”
The queen’s voice trembled with frustration.
Queen Aralyn: “Then what do you propose?”
Halbrecht tapped a point on the map — the Relic Vault beneath the palace.
Halbrecht: “We take his power from beneath him.”

Scene 2 — Knight and Rowan in the War Room
Rowan paced before a table covered in reports.
Rowan: “The queen has Halbrecht. That old fossil commands loyalty we cannot buy.”
Knight remained silent.
Rowan: “Speak, Knight. You’ve fought beside Halbrecht’s men. What will they do?”
Knight: “They’ll fight to the last. They believe in something.”
Rowan scoffed.
Rowan: “Belief is a luxury. Relics are power. And I intend to control every relic in the kingdom.”
Knight’s eyes narrowed.
Knight: “You’re planning to seize the Relic Vault.”
Rowan smiled.
Rowan: “You’re quick. Yes. And you will lead the operation.”
Knight stiffened.
Knight: “The vault is sacred. Even the king never—”
Rowan: “The king is stone. I am the future.”
Knight felt the last remnants of loyalty crumble.

Scene 3 — Lancer and Knight, a Meeting in Secret
Knight slipped into the abandoned stables behind the palace. Lancer was already there, cloaked and hooded.
They stared at each other — two men who had once been brothers in arms.
Lancer: “Why did you come?”
Knight: “To warn you. Rowan is going after the Relic Vault.”
Lancer’s eyes widened.
Lancer: “Why tell me?”
Knight hesitated.
Knight: “Because… I don’t know what side I’m on anymore.”
Lancer stepped closer.
Lancer: “Then choose. Now.”
Knight looked away.
Knight: “I can’t. Not yet.”
Lancer’s voice hardened.
Lancer: “Then stay out of my way.”
Knight didn’t stop him as he left.
But he didn’t return to Rowan, either.

Battle Setup
The queen and Halbrecht launch a covert strike to secure the Relic Vault before Rowan can seize it.
The vault lies beneath the palace — a labyrinth of ancient stone, guarded by:
- elite palace guards loyal to Rowan
- relic-powered traps
- a specter bound centuries ago to protect the vault
- and, unknown to all, a Tethered Spirit awakened by the vault’s instability
Lancer leads the infiltration team.
Rowan sends his own strike force.
Knight is caught between them.

Battle: “The Vault of Echoes”
The battlefield is a sprawling underground complex lit by relic-fire.
Shifting walls, spectral illusions, and ancient defenses turn the vault into a living maze.
Lancer’s team advances through:
- collapsing bridges of relic energy
- palace guards wielding relic-enhanced weapons
- the bound specter, whose wails distort reality
- the Tethered Spirit, lashing out in confusion
Rowan’s strike force arrives from the opposite side.
The two groups clash in a chaotic, echoing melee.
At the center of the vault, Lancer reaches the relic core — a massive crystalline structure pulsing with unstable energy.
Knight steps out of the shadows.
Knight: “Lancer… stop. If you take the core, the vault collapses.”
Lancer: “If Rowan takes it, the kingdom collapses.”
They fight — not with hatred, but with desperation.
The specter’s shriek shatters the chamber.
The Tethered Spirit lashes out, striking Knight and sending him crashing into the relic core.
The core fractures.
Energy erupts.
The vault begins to collapse.
Lancer grabs Knight, dragging him toward the exit.
Knight, barely conscious, whispers:
Knight: “I… choose… you.”
Lancer pulls him to safety as the vault implodes behind them.
Rowan’s forces are buried.
The relic core is destroyed.
And the Brave Kingdom is forever changed.




BRAVE KINGDOM — PART VI: “THE PRINCE’S GAMBIT”
Exposition (8 paragraphs)
The collapse of the Relic Vault sent tremors through the Brave Kingdom — literal and political. The explosion shook the palace foundations, cracked the marble floors, and sent relic dust swirling through the capital like crimson snow. The people panicked, believing it a sign of divine wrath. Rowan seized the moment, claiming the queen had sabotaged the vault to weaken the kingdom. His words spread like wildfire.
But the truth was far more dangerous. The destruction of the relic core destabilized the entire relic network beneath the capital. Strange lights flickered in alleyways. Spectral echoes drifted through the streets. A Tethered Spirit was seen wandering the lower districts, its chains dragging across the cobblestones. The city was becoming unpredictable — and Rowan blamed the queen for every anomaly.
At Halbrecht’s fortress, the queen received word of the vault’s collapse. She was shaken, but not deterred. With Halbrecht’s disciplined forces and the loyalty of the remaining royalists, she began preparing for a march on the capital. Lancer, still recovering from the battle, trained relentlessly. He knew Rowan would retaliate. He also knew Knight had saved his life — and that the choice Knight made in the vault would haunt them both.
Knight, meanwhile, found himself in a precarious position. Rowan praised him publicly for “defending the kingdom’s relics,” but privately, the prince was furious. Knight had failed to secure the vault. Worse, he had returned without relics, without prisoners, and without a victory. Rowan’s trust began to erode. Varric’s envoys whispered that Knight was unreliable. The palace guards loyal to Rowan watched him with suspicion.
The Stonecased King’s condition worsened. His skin had hardened completely. His eyes no longer moved. The healers declared him alive but unreachable — a living statue. Rowan used this to his advantage, claiming the king had “entrusted him with full authority.” The queen, hearing this, knew the time for diplomacy had passed.
Halbrecht urged caution. He believed Rowan would make a desperate move — something reckless, something catastrophic. The queen agreed. She ordered Lancer to lead a scouting party toward the capital to assess Rowan’s defenses. She also sent envoys to the Mage Kingdom, hoping to secure arcane support. But the Mage Kingdom was unpredictable, and their response uncertain.
Rowan, sensing the queen’s preparations, enacted his gambit. He summoned Varric to the capital. The two men met in secret beneath the palace, in the ruins of the vault. There, Rowan made a promise that would change the fate of the Brave Kingdom:
“Help me seize the throne, and I will give you Brimstone Valley.”
Varric accepted.
The war for the Brave Kingdom had begun.

Character Scenes (3 scenes)
Scene 1 — Rowan and Varric in the Ruined Vault
The chamber was dim, lit only by the unstable glow of fractured relic shards.
Varric: “You’ve lost your vault. Your queen has Halbrecht. Why should I follow you?”
Rowan: “Because I offer something she never will — power without restraint.”
Varric smirked.
Varric: “And what do you want in return?”
Rowan: “The throne.”
Varric stepped closer, boots crunching on relic dust.
Varric: “And Brimstone Valley?”
Rowan nodded.
Rowan: “Yours. All of it.”
Varric extended his hand.
Varric: “Then let’s burn the old kingdom down.”

Scene 2 — Lancer and the Queen at Halbrecht’s Fortress
Lancer stood beside the queen as she gazed across the plains toward the distant capital.
Queen Aralyn: “Rowan has made his choice.”
Lancer: “Then we must make ours.”
Queen Aralyn: “I will not spill the blood of my people unless I must.”
Lancer: “He will spill it regardless.”
The queen closed her eyes.
Queen Aralyn: “I know.”
Halbrecht entered, armor polished, expression grim.
Halbrecht: “Rowan has allied with Varric. Scouts confirm it.”
The queen’s face hardened.
Queen Aralyn: “Then we march.”

Scene 3 — Knight Alone in the Palace Armory
Knight sat on a bench, staring at his gauntlets. The armory was silent, save for the distant hum of unstable relic energy.
A palace guard entered.
Guard: “The prince wants you. Now.”
Knight didn’t move.
Knight: “Tell him I’ll come when I’m ready.”
The guard hesitated.
Guard: “He said… if you refuse again, he’ll strip you of command.”
Knight finally stood.
Knight: “Let him try.”
As he walked toward the throne room, he passed a cracked mirror. For the first time, he didn’t recognize the man staring back.

Battle Setup
The queen’s forces march toward the capital.
Rowan and Varric prepare a counterstrike.
But before the armies clash, Rowan launches a preemptive attack to cripple the queen’s advance:
He sends a mixed force of:
- Varric’s mercenaries
- rogue outcasts
- a lightning mage hired from the Mage Kingdom
- a werewolf pack from the Monster Kingdom
Their target:
Halbrecht’s supply caravan, carrying food, medicine, and relic-stabilizing crystals.
Lancer is tasked with defending the caravan.
Knight is ordered by Rowan to lead the attack.
The two men are once again forced into conflict — but this time, Knight is no longer uncertain.
He is angry.
Conflicted.
And dangerous.

Battle: “The Lightning Road”
The battlefield is a winding mountain pass known as the Lightning Road — named for the storms that frequently strike its cliffs.
As the caravan moves through the pass:
- lightning crackles unnaturally
- the hired lightning mage amplifies the storm
- werewolves leap from the rocks
- Varric’s mercenaries charge from both sides
- outcast rogues sabotage the wagons
Lancer rallies Halbrecht’s soldiers, forming a defensive ring around the supply wagons.
The lightning mage unleashes a storm that shatters the front line.
Knight emerges through the smoke, leading the charge.
Knight: “Lancer! Stand down!”
Lancer: “Not while you stand with him!”
Their blades clash again — harder, faster, more desperate than before.
A werewolf lunges at Lancer.
Knight kills it.
Lancer stares at him, stunned.
Lancer: “You’re protecting me?”
Knight: “I’m protecting what’s left of us.”
But the lightning mage unleashes a massive bolt that strikes the cliffside, triggering a landslide.
Knight grabs Lancer and pulls him clear — but the caravan is crushed.
The supplies are lost.
Rowan’s gambit succeeds.
And the queen’s march is delayed.



BRAVE KINGDOM — PART VII: “THE SIEGE OF TWO THRONES”
Exposition (8 paragraphs)
The destruction of Halbrecht’s supply caravan forced the queen to halt her march for nearly a week. Without food, medicine, or relic-stabilizing crystals, her forces risked collapse before they ever reached the capital. Halbrecht worked tirelessly to reorganize the supply lines, but the damage was done. Rowan had bought himself precious time — and he used it well.
In the capital, Rowan declared a state of emergency. He claimed the queen had “abandoned her duties” and that he alone could protect the kingdom from the chaos unleashed by the vault’s collapse. Varric’s mercenaries patrolled the streets. Outcast assassins guarded the palace gates. The nobles, terrified of losing their estates, pledged loyalty to Rowan. The people, confused and frightened, clung to whichever authority seemed strongest.
Knight watched all of this unfold with growing unease. He had once believed Rowan represented the future — a harsh but necessary evolution. But now he saw the truth: Rowan was not building a new kingdom. He was seizing a throne. And Varric was using him as a stepping stone to Brimstone Valley. Knight found himself trapped between two ambitions, neither of which aligned with the ideals he once fought for.
Meanwhile, the queen recovered from the ambush and resumed her march. Halbrecht’s disciplined forces formed the vanguard, with Lancer at their head. The queen rode behind them, her banner restored, her resolve hardened. She knew Rowan would not surrender. She knew the capital would not open its gates. And she knew the final confrontation would decide the fate of the Brave Kingdom.
But the queen was not the only one preparing. Rowan fortified the capital walls, installed relic-powered ballistae, and stationed Varric’s elite mercenaries at key choke points. He also summoned a lightning mage — the same one who had devastated the caravan — to create a storm barrier around the city. The capital became a fortress of steel, stone, and crackling energy.
The Stonecased King, now fully petrified, was moved to the throne room. Rowan claimed it was symbolic — that the king “watched over the kingdom in its hour of need.” But many whispered that Rowan kept the king there to legitimize his rule. The queen, hearing this, felt her grief turn to fury.
As the queen’s army approached the capital, the skies darkened. Lightning arced across the battlements. Varric’s mercenaries lined the walls. Rowan stood beside the petrified king, wearing ceremonial armor forged from relic shards.
The siege of the Brave Kingdom was about to begin.

Character Scenes (3 scenes)
Scene 1 — Rowan and Knight in the Throne Room
The throne room glowed with relic light. The Stonecased King sat unmoving, a silent witness to Rowan’s rise.
Rowan: “The queen marches on us. She forces my hand.”
Knight stood at the foot of the throne.
Knight: “You forced your own hand when you allied with Varric.”
Rowan: “Varric is a means to an end.”
Knight: “And when he demands Brimstone Valley?”
Rowan smiled thinly.
Rowan: “Then I will give it to him. Once I am king, I will take it back.”
Knight’s jaw tightened.
Knight: “You’re playing with fire.”
Rowan: “No. I’m forging a new kingdom.”
Knight looked at the petrified king.
Knight: “At what cost?”
Rowan’s voice dropped.
Rowan: “Whatever it takes.”

Scene 2 — Lancer and the Queen Before the Siege
The queen stood atop a hill overlooking the capital. Lancer approached, helmet under his arm.
Lancer: “Your Majesty… once we begin, there is no turning back.”
Queen Aralyn: “There was no turning back the moment Rowan raised his hand against me.”
Lancer hesitated.
Lancer: “Knight is inside the walls.”
The queen’s expression softened.
Queen Aralyn: “He must choose his own path.”
Lancer: “He already has.”
The queen placed a hand on his shoulder.
Queen Aralyn: “Then you must choose yours.”
Lancer nodded.

Scene 3 — Knight and Varric on the Battlements
Varric leaned against the parapet, watching the queen’s army gather.
Varric: “Impressive. Halbrecht trains them well.”
Knight didn’t respond.
Varric: “You’re quiet, boy. Regretting your choices?”
Knight: “I regret nothing. I question everything.”
Varric laughed.
Varric: “Good. Questions keep you alive.”
Knight turned to him.
Knight: “What happens after Rowan wins?”
Varric’s smile was predatory.
Varric: “Rowan won’t win. He’ll bleed. And when he does, I’ll take what I’m owed.”
Knight’s hand drifted toward his sword.
Knight: “And what if I don’t let you?”
Varric’s eyes narrowed.
Varric: “Then you’ll die before the first arrow flies.”
Knight walked away.
He didn’t look back.

Battle Setup
The queen launches a full assault on the capital.
Rowan and Varric defend the walls.
Knight is ordered to lead the defense of the eastern gate — the gate Lancer is assigned to breach.
The two men will face each other again.
But this time, there is no hesitation.
No illusions.
No excuses.
Only the fate of the Brave Kingdom.

Battle: “The Siege of Two Thrones”
The battlefield is the capital’s eastern wall — a towering structure reinforced with relic energy.
The queen’s forces advance:
- Halbrecht’s knights form a shield wall
- archers fire volleys to suppress the battlements
- relic-stabilizing crystals protect the vanguard
- Lancer leads the charge with a battering ram
Rowan’s forces respond:
- Varric’s mercenaries rain arrows from above
- outcast assassins sabotage siege engines
- the lightning mage unleashes storms that tear through the ranks
- Knight commands the defenders with ruthless precision
Lancer reaches the gate.
Knight stands atop the battlements, sword raised.
Their eyes meet.
The storm rages around them.
Knight: “Turn back!”
Lancer: “Not while you stand with him!”
Knight leaps from the wall, landing in front of the gate.
The two clash in a duel that shakes the stones beneath them.
Lightning crackles.
Steel screams.
The gate buckles.
The queen’s forces surge forward.
Knight is driven back.
Lancer raises his blade for the final strike—
—but a blast of lightning from the mage knocks them both apart.
The gate collapses.
The queen’s army pours into the capital.
The siege has begun.
And the final confrontation is inevitable.



BRAVE KINGDOM — PART VIII: “THE FALL OF THE BRAVE KINGDOM”
Exposition (9 paragraphs)
The eastern gate lay in ruins, smoke curling upward like the breath of a dying beast. The queen’s forces surged into the capital, their banners snapping in the storm winds conjured by Rowan’s lightning mage. The streets echoed with the clash of steel, the roar of mercenaries, and the cries of civilians fleeing the chaos. The Brave Kingdom — once proud, once unified — was now a battlefield.
Rowan retreated to the palace, furious that the eastern gate had fallen. He blamed Varric for withholding troops, Varric blamed Rowan for poor strategy, and the two men argued openly in the throne room. The Stonecased King sat unmoving between them, a silent monument to the kingdom they were destroying. The lightning mage warned that the storm barrier was weakening. The relic shards powering it were unstable, reacting violently to the queen’s relic-stabilizing crystals.
Knight stood at the foot of the throne, watching the two men he had once believed in tear each other apart. He had defended the walls, fought Lancer, and led Rowan’s soldiers — but he no longer knew why. The ideals he once held had been twisted, the future he imagined corrupted. He felt like a blade without a wielder, sharp but directionless.
Outside the palace, Lancer led Halbrecht’s knights through the capital streets. They fought block by block, pushing back Varric’s mercenaries and securing safe routes for civilians. The queen followed behind them, refusing to hide, refusing to abandon her people. Her presence rallied the loyalists and shook the resolve of Rowan’s supporters. Many palace guards surrendered rather than face her.
Halbrecht himself led the assault on the western gate, cutting through outcast assassins with grim determination. He knew Rowan would not surrender. He knew Varric would not negotiate. And he knew the queen’s only chance was to reach the throne room before Rowan could unleash something catastrophic.
Because Rowan had one final gambit.
Deep beneath the palace, in the ruins of the Relic Vault, Rowan had discovered a relic shard unlike any other — a fragment of the core that pulsed with unstable, destructive energy. The lightning mage warned him that using it could tear the palace apart. Rowan didn’t care. If he could not rule the Brave Kingdom, he would remake it in fire and lightning.
The queen’s forces breached the palace gates. The final battle was at hand.
And at the center of it all stood Knight and Lancer — two men who had once fought side by side, now forced to decide the fate of the kingdom they both loved.

Character Scenes (3 scenes)
Scene 1 — Rowan and Knight in the Throne Room
Rowan held the unstable relic shard in his hand, its glow casting jagged shadows across the marble floor.
Rowan: “With this, I end the old kingdom. I end her. I end everything that stands in my way.”
Knight stepped forward.
Knight: “Put it down.”
Rowan: “You dare command me?”
Knight: “I’m not commanding you. I’m begging you.”
Rowan’s eyes burned with ambition.
Rowan: “You’ve grown weak. Lancer has infected you with his ideals.”
Knight’s voice cracked.
Knight: “No. You’ve lost yours.”
Rowan raised the shard.
Knight drew his sword.

Scene 2 — Lancer and the Queen Enter the Palace
The queen and Lancer pushed through the shattered palace doors. The air crackled with relic energy. The walls trembled. The Stonecased King’s petrified form could be seen through the open throne room doors.
Queen Aralyn: “Rowan… what have you done?”
Lancer stepped forward, blade drawn.
Lancer: “Knight is in there.”
Halbrecht arrived behind them, bloodied but unbowed.
Halbrecht: “Then we move now. Before Rowan destroys us all.”
The queen nodded.
Queen Aralyn: “End this. But spare who you can.”
Lancer hesitated.
He wasn’t sure he could.

Scene 3 — Knight and Lancer, One Last Time
Lancer entered the throne room first.
Knight stood between him and Rowan.
Their eyes met.
No hatred.
Only sorrow.
Lancer: “Step aside.”
Knight: “I can’t.”
Lancer: “Then you choose him.”
Knight shook his head.
Knight: “I choose the kingdom.”
He turned — and struck Rowan’s arm, knocking the relic shard from his hand.
Rowan screamed in rage.
Rowan: “TRAITOR!”
The shard hit the floor.
It began to crack.
The palace shook.
Lancer lunged forward, grabbing Knight as the relic exploded in a burst of unstable energy.

Battle Setup
The explosion unleashes:
- relic lightning arcing wildly
- spectral echoes from the shattered vault
- the Tethered Spirit, drawn to the chaos
- Varric’s mercenaries storming the throne room
- Rowan, half‑empowered by the relic, half‑consumed by it
The final battle is a chaotic, multi‑faction clash inside the throne room.
The queen, Halbrecht, Lancer, and Knight must fight together — or die.

Battle: “The Fall of the Brave Kingdom”
The throne room becomes a storm of destruction.
- Rowan unleashes bolts of unstable relic lightning
- Varric charges the queen, seeking to claim her head
- Halbrecht duels Varric in a brutal clash of steel
- the Tethered Spirit lashes out at anything that moves
- spectral echoes distort the battlefield
- Knight and Lancer fight side by side once more
Rowan, empowered by the relic, becomes a living conduit of lightning. His attacks tear through stone pillars and shatter the marble floor.
Knight confronts him.
Knight: “This ends now!”
Rowan: “Yes. With your ashes.”
Rowan unleashes a killing bolt.
Lancer intercepts it, shield raised.
The shield shatters.
Lancer falls to one knee.
Knight roars and charges, striking Rowan’s relic‑infused armor.
The queen steps forward, holding the royal sigil — a relic of pure stability.
Queen Aralyn: “Rowan. Stop.”
For a moment, Rowan hesitates.
The relic energy flickers.
The Stonecased King’s petrified hand cracks — just slightly — as if reacting to the relics’ clash.
Rowan screams and lunges at the queen.
Knight and Lancer strike together.
Their blades pierce Rowan’s armor.
The relic energy surges.
Rowan collapses.
The storm ends.
Varric, seeing Rowan fall, retreats with his surviving mercenaries.
The Tethered Spirit fades.
Silence fills the throne room.
The Brave Kingdom has fallen.
But something new can rise.

Epilogue: “A Kingdom Reborn”
The queen takes the throne — not as a monarch of old, but as a leader of a fractured land.
Halbrecht becomes her general.
Lancer becomes commander of the restored royal guard.
Knight kneels before the queen, offering his sword.
Queen Aralyn: “Rise, Knight. Your path was twisted, but your heart remained true.”
He rises.
But he does not smile.
The Brave Kingdom is saved.
But the scars remain.
And beyond its borders, the other kingdoms watch — waiting, calculating, preparing their own moves in the struggle for Brimstone Valley.
The story of the Brave Kingdom ends here.
But the war for the world has only begun.







*/








