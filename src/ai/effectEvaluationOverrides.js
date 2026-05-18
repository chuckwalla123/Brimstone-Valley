export const EFFECT_EVALUATION_OVERRIDES = {
  "Poison": 12,
  "Marked": 1.5,
  "Burn": 6,
  "Wildfire": 15,
  "Heating Up": 15,
  "Acid": 18,
  "Armor Melt": 9,
  "Slowed": 3.75,
  "Time Warp": 7.5,
  "Dragon Scales": -2,
  "Dragon Year": 15.683286333517808,
  "Haste": 7.5,
  "Speed up": 3.75,
  "Quickness": 9.75,
  "Regen": 6,
  "Spores": 12,
  "Protective Growth": 6,
  "Dexterity": 7.433286333517808,
  "Dexterity II": 14.584089890007993,
  "Bleed": 6,
  "Leech": 18,
  "Elixir": 13.433286333517808,
  "Lie In Wait": 1,
  "Fade": 15,
  "Taunt": 6,
  "Loyalty": 6,
  "Defend": 3.683286333517808,
  "Subjugation": 6,
  "Iron Forge": 9.683286333517808,
  "Iron Forge II": 19.084089890007995,
  "Give A Quest": 9,
  "Turret": 18,
  "Field Upgrade": 15,
  "Minion": 12,
  "Armor Up": 7.084089890007993,
  "Armor Down": 4.149110640673518,
  "Armor Break": 5.649110640673518,
  "Armor": 3.683286333517808,
  "Armor Bearer": 10.289978273912256,
  "Overencumbered": 0,
  "Hard Fall": 6,
  "Monster Slayer": 0.5,
  "Strength": 6,
  "Bounty": 3,
  "Accept Contract": 0,
  "Smolder": 9,
  "Pay The Toll": 12,
  "Ghost": 3,
  "Awaken": 0,
  "Link": 12,
  "Void Shield": 9,
  "Frenzy": 9,
  "Lifesteal": 9,
  "Blood Suck": 4.800000000000001,
  "Undying Rage": 3,
  "Crumble": -2,
  "Mud Armor": 10.289978273912256,
  "Regeloop": 16,
  "Rejuvenate": 12,
  "Healing Water": 12,
  "Reap": 12,
  "Treachery": 6,
  "Prayer": 15,
  "Prayer II": 30,
  "Death Pact": 10,
  "Curse": 6,
  "Counter": 12,
  "Static Shock": 12,
  "Power": 12,
  "Enraged": 10,
  "Soul Link": 3,
  "Shackle": 3,
  "Retribution": 18
};

export const EFFECT_EVALUATION_OVERRIDE_DIAGNOSTICS = [
  {
    "effect_key": "Poison",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "Marked",
    "status": "numeric",
    "source": "1.5",
    "resolved": 1.5
  },
  {
    "effect_key": "Burn",
    "status": "expression",
    "source": "Target_expected_turns_alive*1",
    "normalized": "Target_expected_turns_alive*1",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "Wildfire",
    "status": "expression",
    "source": "Target_expected_turns_alive*2.5",
    "normalized": "Target_expected_turns_alive*2.5",
    "resolved": 15,
    "unknown": ""
  },
  {
    "effect_key": "HeatingUp",
    "status": "expression",
    "source": "Target_expected_turns_alive*2.5",
    "normalized": "Target_expected_turns_alive*2.5",
    "resolved": 15,
    "unknown": ""
  },
  {
    "effect_key": "Acid",
    "status": "expression",
    "source": "Target_expected_turns_alive*3",
    "normalized": "Target_expected_turns_alive*3",
    "resolved": 18,
    "unknown": ""
  },
  {
    "effect_key": "ArmorMelt",
    "status": "expression",
    "source": "Total_Target_expected_turns_alive*1.5",
    "normalized": "Target_expected_turns_alive*1.5",
    "resolved": 9,
    "unknown": ""
  },
  {
    "effect_key": "Slowed",
    "status": "expression",
    "source": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "resolved": 3.75,
    "unknown": ""
  },
  {
    "effect_key": "TimeWarp",
    "status": "expression",
    "source": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "resolved": 7.5,
    "unknown": ""
  },
  {
    "effect_key": "DragonScales",
    "status": "numeric",
    "source": "-2",
    "resolved": -2
  },
  {
    "effect_key": "DragonYear",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 15.683286333517808,
    "unknown": ""
  },
  {
    "effect_key": "Haste",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 7.5,
    "unknown": ""
  },
  {
    "effect_key": "SpeedUp",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 3.75,
    "unknown": ""
  },
  {
    "effect_key": "Quickness",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 9.75,
    "unknown": ""
  },
  {
    "effect_key": "Regen",
    "status": "expression",
    "source": "Target_expected_turns_alive*1",
    "normalized": "Target_expected_turns_alive*1",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "Spores",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "ProtectiveGrowth",
    "status": "expression",
    "source": "Target_expected_turns_alive*1",
    "normalized": "Target_expected_turns_alive*1",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "Dexterity",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 7.433286333517808,
    "unknown": ""
  },
  {
    "effect_key": "DexterityII",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 14.584089890007993,
    "unknown": ""
  },
  {
    "effect_key": "Bleed",
    "status": "expression",
    "source": "Target_expected_turns_alive*1",
    "normalized": "Target_expected_turns_alive*1",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "Leech",
    "status": "expression",
    "source": "Target_expected_turns_alive*3",
    "normalized": "Target_expected_turns_alive*3",
    "resolved": 18,
    "unknown": ""
  },
  {
    "effect_key": "Elixir",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 13.433286333517808,
    "unknown": ""
  },
  {
    "effect_key": "LieInWait",
    "status": "expression",
    "source": "Target_expected_turns_alive*3",
    "normalized": "Target_expected_turns_alive*3",
    "resolved": 15,
    "unknown": ""
  },
  {
    "effect_key": "LieInWaitLevel5",
    "status": "expression",
    "source": "Target_expected_turns_alive*1",
    "normalized": "Target_expected_turns_alive*1",
    "resolved": 1,
    "unknown": ""
  },
  {
    "effect_key": "Fade",
    "status": "expression",
    "source": "Target_expected_turns_alive*3",
    "normalized": "Target_expected_turns_alive*3",
    "resolved": 15,
    "unknown": ""
  },
  {
    "effect_key": "Taunt",
    "status": "expression",
    "source": "Target_expected_turns_alive*1",
    "normalized": "Target_expected_turns_alive*1",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "Loyalty",
    "status": "expression",
    "source": "Caster_expected_turns_alive*1",
    "normalized": "Caster_expected_turns_alive*1",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "Defend",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 3.683286333517808,
    "unknown": ""
  },
  {
    "effect_key": "Subjugation",
    "status": "expression",
    "source": "Target_expected_turns_alive*1",
    "normalized": "Target_expected_turns_alive*1",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "IronForge",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 9.683286333517808,
    "unknown": ""
  },
  {
    "effect_key": "IronForgeII",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 19.084089890007995,
    "unknown": ""
  },
  {
    "effect_key": "GiveAQuest",
    "status": "expression",
    "source": "Target_expected_turns_alive*1.5",
    "normalized": "Target_expected_turns_alive*1.5",
    "resolved": 9,
    "unknown": ""
  },
  {
    "effect_key": "Turret",
    "status": "expression",
    "source": "Target_expected_turns_alive*3",
    "normalized": "Target_expected_turns_alive*3",
    "resolved": 18,
    "unknown": ""
  },
  {
    "effect_key": "FieldUpgrade",
    "status": "expression",
    "source": "Target_expected_turns_alive*2.5",
    "normalized": "Target_expected_turns_alive*2.5",
    "resolved": 15,
    "unknown": ""
  },
  {
    "effect_key": "Minion",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "ArmorUp",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 7.084089890007993,
    "unknown": ""
  },
  {
    "effect_key": "ArmorDown",
    "status": "expression",
    "source": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "resolved": 4.149110640673518,
    "unknown": ""
  },
  {
    "effect_key": "ArmorBreak",
    "status": "expression",
    "source": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "resolved": 5.649110640673518,
    "unknown": ""
  },
  {
    "effect_key": "Armor",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 3.683286333517808,
    "unknown": ""
  },
  {
    "effect_key": "ArmorBearer",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 10.289978273912256,
    "unknown": ""
  },
  {
    "effect_key": "Overencumbered",
    "status": "numeric",
    "source": "0",
    "resolved": 0
  },
  {
    "effect_key": "HardFall",
    "status": "numeric",
    "source": "6",
    "resolved": 6
  },
  {
    "effect_key": "MonsterSlayer",
    "status": "numeric",
    "source": "0.5",
    "resolved": 0.5
  },
  {
    "effect_key": "Strength",
    "status": "expression",
    "source": "Target_expected_turns_alive*1",
    "normalized": "Target_expected_turns_alive*1",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "Bounty",
    "status": "numeric",
    "source": "3",
    "resolved": 3
  },
  {
    "effect_key": "AcceptContract",
    "status": "numeric",
    "source": "0",
    "resolved": 0
  },
  {
    "effect_key": "Smolder",
    "status": "expression",
    "source": "Target_expected_turns_alive*1.5",
    "normalized": "Target_expected_turns_alive*1.5",
    "resolved": 9,
    "unknown": ""
  },
  {
    "effect_key": "PayTheToll",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "Ghost",
    "status": "expression",
    "source": "Target_exected_turns_alive*0.5",
    "normalized": "Target_expected_turns_alive*0.5",
    "resolved": 3,
    "unknown": ""
  },
  {
    "effect_key": "Awaken",
    "status": "numeric",
    "source": "0",
    "resolved": 0
  },
  {
    "effect_key": "Link",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "VoidShield",
    "status": "expression",
    "source": "Target_expected_turns_alive*1.5",
    "normalized": "Target_expected_turns_alive*1.5",
    "resolved": 9,
    "unknown": ""
  },
  {
    "effect_key": "Frenzy",
    "status": "expression",
    "source": "Target_expected_turns_alive*1.5",
    "normalized": "Target_expected_turns_alive*1.5",
    "resolved": 9,
    "unknown": ""
  },
  {
    "effect_key": "Lifesteal",
    "status": "expression",
    "source": "Target_expected_turns_alive*1.5",
    "normalized": "Target_expected_turns_alive*1.5",
    "resolved": 9,
    "unknown": ""
  },
  {
    "effect_key": "BloodSuck",
    "status": "expression",
    "source": "Target_expected_turns_alive*0.8",
    "normalized": "Target_expected_turns_alive*0.8",
    "resolved": 4.800000000000001,
    "unknown": ""
  },
  {
    "effect_key": "UndyingRage",
    "status": "numeric",
    "source": "3",
    "resolved": 3
  },
  {
    "effect_key": "Crumble",
    "status": "numeric",
    "source": "-2",
    "resolved": -2
  },
  {
    "effect_key": "MudArmor",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 10.289978273912256,
    "unknown": ""
  },
  {
    "effect_key": "Regeloop",
    "status": "numeric",
    "source": "16",
    "resolved": 16
  },
  {
    "effect_key": "Rejuvenate",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "HealingWater",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "Reap",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "Treachery",
    "status": "expression",
    "source": "Target_expected_turns_alive*Target_Armor",
    "normalized": "Target_expected_turns_alive*Target_Armor",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "Prayer",
    "status": "expression",
    "source": "Target_exepcted_turns_alive*2.5",
    "normalized": "Target_expected_turns_alive*2.5",
    "resolved": 15,
    "unknown": ""
  },
  {
    "effect_key": "PrayerII",
    "status": "expression",
    "source": "Target_exepcted_turns_alive*5",
    "normalized": "Target_expected_turns_alive*5",
    "resolved": 30,
    "unknown": ""
  },
  {
    "effect_key": "DeathPact",
    "status": "expression",
    "source": "Targets_Health",
    "normalized": "Target_Health",
    "resolved": 10,
    "unknown": ""
  },
  {
    "effect_key": "Curse",
    "status": "expression",
    "source": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_Current_ECV - Target_ECV_After_Debuff) + ((Target_Tile_Value_Before - Target_Tile_Value_After_Debuff) * Target_expected_turns_alive * 0.5)",
    "resolved": 6,
    "unknown": ""
  },
  {
    "effect_key": "Counter",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "StaticShock",
    "status": "expression",
    "source": "Target_expected_turns_alive*2",
    "normalized": "Target_expected_turns_alive*2",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "Power",
    "status": "expression",
    "source": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "normalized": "(Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)",
    "resolved": 12,
    "unknown": ""
  },
  {
    "effect_key": "Enraged",
    "status": "expression",
    "source": "((Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)) - 2",
    "normalized": "((Target_ECV_After_Buff - Target_Current_ECV) + ((Target_Tile_Value_After_Buff - Target_Tile_Value_Before) * Target_expected_turns_alive * 0.5)) - 2",
    "resolved": 10,
    "unknown": ""
  },
  {
    "effect_key": "SoulLink",
    "status": "numeric",
    "source": "3",
    "resolved": 3
  },
  {
    "effect_key": "Shackle",
    "status": "numeric",
    "source": "3",
    "resolved": 3
  },
  {
    "effect_key": "Retribution",
    "status": "expression",
    "source": "Target_expected_turns_alive*3",
    "normalized": "Target_expected_turns_alive*3",
    "resolved": 18,
    "unknown": ""
  }
];
