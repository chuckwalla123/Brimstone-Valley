# Alternative Hero Evaluation Formulas

## Current Formula Issues
1. **Armor value doesn't scale with health**: 3 armor on 1 HP unit scores same as 3 armor on 20 HP unit
2. **Tile value assumes 4-turn survival**: Doesn't account for probability of actually living that long
3. **No synergy modeling**: Health and armor work multiplicatively, not additively

---

## Option 1: Effective Health Model
**Concept**: Armor creates "effective HP" by reducing incoming damage

### Formula
```
Effective_HP = Health × (1 + Armor / AvgDamagePerHit)
Hero_Points = Effective_HP + (Tile_Value × Expected_Survival_Turns)
Expected_Survival_Turns = Effective_HP / AvgDamagePerTurn
```

### Parameters
- `AvgDamagePerHit` = 3-4 (calibrate based on typical spell damage)
- `AvgDamagePerTurn` = 5-8 (depends on how many enemy hits per round)

### Example
- Hero: 10 HP, 3 Armor, Tile Value = 20
- Effective_HP = 10 × (1 + 3/3.5) = 10 × 1.86 = 18.6
- Expected_Survival = 18.6 / 6 = 3.1 turns
- Hero_Points = 18.6 + (20 × 3.1) = 18.6 + 62 = 80.6

### Pros
- Armor scales with health naturally
- Survival time affects tile value contribution
- Mathematically sound

### Cons
- Requires calibrating average damage values
- May undervalue high-armor low-HP units (armor breakpoints)

---

## Option 2: Armor Efficiency Curve (Increasing Returns)
**Concept**: Each point of armor becomes MORE valuable as you get more (damage reduction breakpoints)

### Formula
```
Armor_Efficiency = Armor² / (Armor + 2)
Effective_HP = Health × (1 + Armor_Efficiency)
Tile_Contribution aA= Tile_Value × min(Effective_HP / 15, 4)
Hero_Points = Effective_HP + Tile_Contribution
```

### Example
- Hero: 10 HP, 3 Armor, Tile Value = 20
- Armor_Efficiency = 9 / 5 = 1.8
- Effective_HP = 10 × (1 + 1.8) = 28
- Tile_Contribution = 20 × min(28/15, 4) = 20 × 1.87 = 37.4
- Hero_Points = 28 + 37.4 = 65.4

### Comparison (same hero with different armor)
- 1 Armor: EHP = 10 × 1.33 = 13.3
- 2 Armor: EHP = 10 × 2.0 = 20
- 3 Armor: EHP = 10 × 2.8 = 28
- 5 Armor: EHP = 10 × 4.57 = 45.7

### Pros
- Models armor breakpoints (3 armor blocks 3-damage hits completely)
- High armor becomes increasingly valuable
- Caps tile contribution at 4 turns max

### Cons
- Can overvalue armor stacking
- Complex calculation

---

## Option 3: Survival Probability Weighted
**Concept**: Calculate probability of surviving N turns, weight tile value by it

### Formula
```
Turns_To_Kill = (Health + Armor × 2.5) / AvgDamagePerTurn
Survival_Probability(N) = min(Turns_To_Kill / N, 1)
Expected_Output = Σ(Tile_Value × Survival_Probability(turn)) for turn 1-4
Hero_Points = Health + Armor × 3 + Expected_Output
```

### Example
- Hero: 10 HP, 3 Armor, Tile Value = 20, Avg Damage = 6/turn
- Turns_To_Kill = (10 + 7.5) / 6 = 2.92 turns
- Turn 1: 20 × (2.92/1) = 20 × 1.0 = 20
- Turn 2: 20 × (2.92/2) = 20 × 1.0 = 20
- Turn 3: 20 × (2.92/3) = 20 × 0.97 = 19.4
- Turn 4: 20 × (2.92/4) = 20 × 0.73 = 14.6
- Expected_Output = 20 + 20 + 19.4 + 14.6 = 74
- Hero_Points = 10 + 9 + 74 = 93

### Pros
- Directly models the 4-turn assumption
- Smooth degradation for squishier units
- Very intuitive

### Cons
- Requires calibrating average damage per turn
- More computationally expensive

---

## Option 4: Simplified Multiplicative (Recommended)
**Concept**: Keep it simple but multiplicative for health/armor synergy

### Formula
```
Effective_Combat_Value = √(Health × (Health + Armor × 4))
Expected_Turns_Alive = Effective_Combat_Value / 5
Tile_Contribution = Tile_Value × min(Expected_Turns_Alive, 4)
Hero_Points = Effective_Combat_Value + Tile_Contribution
```

### Example
- Hero: 10 HP, 3 Armor, Tile Value = 20
- ECV = √(10 × 22) = √220 = 14.8
- Expected_Turns = 14.8 / 5 = 2.96
- Tile_Contribution = 20 × 2.96 = 59.2
- Hero_Points = 14.8 + 59.2 = 74

### Comparison (various health/armor combos)
| HP | Armor | ECV | Turns | Tile×Turns | Total |
|----|-------|-----|-------|------------|-------|
| 10 | 0 | 10.0 | 2.0 | 40 | 50 |
| 10 | 3 | 14.8 | 2.96 | 59.2 | 74 |
| 5 | 3 | 8.7 | 1.74 | 34.8 | 43.5 |
| 15 | 3 | 19.5 | 3.9 | 78 | 97.5 |
| 10 | 5 | 17.3 | 3.46 | 69.2 | 86.5 |

### Pros
- Simple to calculate (one sqrt)
- Natural scaling between health and armor
- No calibration parameters needed
- Smooth curves, no weird breakpoints

### Cons
- Square root may undervalue extremely tanky units slightly

---

## Option 5: Damage-Based Expected Value
**Concept**: Estimate total damage/healing output before death

### Formula
```
Incoming_DPS = AvgEnemyDamage - Armor (min 0.5)
Survival_Time = Health / Incoming_DPS
Total_Spell_Output = Tile_Value × Survival_Time
Hero_Points = Total_Spell_Output
```

### Example
- Hero: 10 HP, 3 Armor, Tile Value = 20
- Incoming_DPS = max(6 - 3, 0.5) = 3
- Survival_Time = 10 / 3 = 3.33 turns
- Total_Output = 20 × 3.33 = 66.6
- Hero_Points = 66.6

### Pros
- Pure damage-focused evaluation
- Armor creates huge value when it blocks lots of damage
- Very aggressive playstyle

### Cons
- Ignores health value beyond spell output
- Can overvalue glass cannons
- Requires enemy damage calibration

---

## Recommendation

I recommend **Option 4 (Simplified Multiplicative)** because:

1. **No calibration needed** - No average damage parameters to tune
2. **Natural synergy** - Square root of product creates multiplicative relationship
3. **Intuitive scaling** - Doubling health or armor increases value, but not linearly
4. **Computationally cheap** - Just one sqrt operation
5. **Smooth curves** - No weird breakpoints or discontinuities

The formula naturally captures:
- Armor is worthless without health
- Health is better with armor
- High HP + high armor is MORE than the sum of parts
- But prevents runaway exponential scaling

### Implementation
```javascript
function calculateHeroPoints(hero, tileValue) {
  const hp = hero.currentHealth || hero.health || 0;
  const armor = hero.currentArmor || hero.armor || 0;
  
  // Effective combat value (survival potential)
  const ecv = Math.sqrt(hp * (hp + armor * 4));
  
  // Expected turns alive (capped at 4)
  const turnsAlive = Math.min(ecv / 5, 4);
  
  // Tile contribution weighted by survival
  const tileContribution = tileValue * turnsAlive;
  
  return ecv + tileContribution;
}
```

Would you like me to implement this, or would you prefer one of the other options?
